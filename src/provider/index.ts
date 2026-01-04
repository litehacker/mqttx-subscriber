import * as dotenv from "dotenv";
import { MakePaymentResponse } from "../types";
import { MqttClient } from "mqtt";
import { Card, Entry, Family, Firmware, Subscription } from "@prisma/client";
import prisma from "../../prisma/client";
import axios from "axios";
dotenv.config();

const STATUS_CODES = {
  SUCCESS: 200,
  SUCCESS_PAYMENT_RENEWED: 211,
  FAILED_MISSING_CARD: 296,
  FAILED_INACTIVE_CARD: 297,
  FAILED_INSUFFICIENT_BALANCE: 291,
  FAILED_SERVER_ERROR: 599,
  FAILED_TRIGGER_PAYMENT: 598,
  FAILED_CARDS_NOT_PAID: 597,
};
export const checkTerminalUpdate = (terminal: {
  firmwareVersion: number;
  terminalID: string;
}): Promise<{
  update: boolean;
  _firmware?: Firmware;
}> => {
  return new Promise(async (resolve, reject) => {
    // get the latest firmware version (max number)
    try {
      const firmware = await prisma.firmware.findFirst({
        orderBy: { version: "desc" },
      });
      if (!firmware) {
        reject("No firmware found");
      } else if (firmware.version > terminal.firmwareVersion) {
        resolve({ update: true, _firmware: firmware });
      } else {
        reject("No update available");
      }
    } catch (error) {
      console.error("Error getting firmware version:", error);
      reject("Error getting firmware version");
    }
  });
};

export const payForRide = async ({ response }: { response: Response }) => {
  try {
    const paymentResponse = await MakePayment({
      cardID: response.getCardID(),
      terminalID: response.getTerminalID(),
      response,
    });
    if (paymentResponse.status !== "success") {
      response.sendFailed(paymentResponse.statusNumber);
    }
  } catch (e) {
    console.error("Error processing payment:", e);
    response.sendFailed(296);
  }
};

const calculateSubscriptionWithCardsPrice = ({
  family,
  defaultPriceExtraUser,
  defaultPriceMonthly,
}: {
  family?: Family & { cards: Card[] };
  defaultPriceExtraUser: number;
  defaultPriceMonthly: number;
}) => {
  const haveWePaidForCardsAlready = wasPaymentMadeWithinLastMonth(
    family?.lastPayment
  ); // check if we paid for the cards already?
  const familiesPrice =
    (family?.cards?.length && !haveWePaidForCardsAlready
      ? family.cards.length
      : 0) * defaultPriceExtraUser;
  return defaultPriceMonthly + familiesPrice;
};

const calculateCardsOnlyPriceInGel = ({
  family,
  defaultPriceExtraUser,
}: {
  family?: Family & { cards: Card[] };
  defaultPriceExtraUser: number;
}) => {
  const haveWePaidForCardsAlready = wasPaymentMadeWithinLastMonth(
    family?.lastPayment
  ); // check if we paid for the cards already?
  const familiesPrice =
    (family?.cards?.length && !haveWePaidForCardsAlready
      ? family.cards.length
      : 0) * defaultPriceExtraUser;
  return familiesPrice / 100;
};

const wasPaymentMadeWithinLastMonth = (lastPayment?: Date | null) => {
  if (!lastPayment) {
    return false;
  }
  const currentDate = new Date();

  // Calculate the same day of the previous month
  const sameDayPreviousMonth = new Date(currentDate);
  sameDayPreviousMonth.setMonth(currentDate.getMonth() - 1);

  // Check if the date is before the same day of the previous month
  return lastPayment >= sameDayPreviousMonth;
};

const MakePayment = async ({
  cardID,
  terminalID,
  response,
}: {
  cardID: string;
  terminalID: string;
  response: Response;
}): Promise<MakePaymentResponse> => {
  try {
    return await prisma.$transaction(async (prisma) => {
      const card = await getCardWithDetails({ prisma, cardID });

      if (!card) {
        console.error("Card not found");
        return failedResponse(STATUS_CODES.FAILED_MISSING_CARD);
      }
      if (!card.active)
        return failedResponse(STATUS_CODES.FAILED_INACTIVE_CARD);
      if (!process.env.API_URL) {
        failedResponse(599); // server error because of env.
        throw new Error("API_URL is not set in .env");
      }
      const enoughBalanceToPayCosts =
        card.family.balance >=
        calculateSubscriptionWithCardsPrice({
          family: { ...card.family, cards: card.family.cards },
          defaultPriceExtraUser: card.family.subscription.priceExtraUser,
          defaultPriceMonthly: card.family.subscription.priceMonthly,
        });

      if (
        (!isLastCardsPaymentWithinLastMonth({ family: card.family }) ||
          !isLastSubscriptionPaymentWithinLastMonth({
            subscription: card.family.subscription,
          })) &&
        enoughBalanceToPayCosts
      ) {
        // Fire and forget - don't wait for response
        // if the family has enough balance to trigger payment for both the family cards and the subscription

        axios
          .get(`${process.env.API_URL}/api/trigger-payment/${card.pin}`)
          .catch((err) => {
            console.error(
              "Failed to trigger payment:",
              err.message,
              `${process.env.API_URL}/api/trigger-payment/${card.pin}`
            );
          });
        // ask to press the card again to continue
        return failedResponse(STATUS_CODES.SUCCESS_PAYMENT_RENEWED);
      }
      const { family } = card;
      if (isTerminalInTheSameEntry({ entry: family?.entry, terminalID })) {
        // we are in the same terminal where we have subscription
        if (isNextSubscriptionPaymentInFuture({ family })) {
          // we don't need to pay
          response.sendBalance(family.balance);
          await createRide({
            prisma,
            cardID,
            terminalID,
            family,
          });
        } else if (
          !isLastCardsPaymentWithinLastMonth({ family: card.family })
        ) {
          // we need to pay for cards first!
          const enoughToPayForCards =
            family.balance >=
            calculateCardsOnlyPriceInGel({
              family: card.family,
              defaultPriceExtraUser: card.family.subscription.priceExtraUser,
            }) *
              100;
          if (enoughToPayForCards) {
            axios
              .get(`${process.env.API_URL}/api/trigger-payment/${card.pin}`)
              .catch((err) => {
                console.error("Failed to trigger payment:", err.message);
              });
            return failedResponse(STATUS_CODES.SUCCESS_PAYMENT_RENEWED);
          } else {
            return failedResponse(STATUS_CODES.FAILED_INSUFFICIENT_BALANCE);
          }
        } else if (family.balance >= family.subscription.rideFee) {
          response.sendBalance(family.balance - family.subscription.rideFee);
          await processPaymentWithinTheSameEntry({
            prisma,
            cardID,
            terminalID,
            family,
          });
        } else {
          return failedResponse(STATUS_CODES.FAILED_INSUFFICIENT_BALANCE);
        }
      } else {
        // get entry. subscription.rideFee
        const entry = family.entry;
        if (family.balance >= (entry?.subscription?.rideFee || 0)) {
          response.sendBalance(
            family.balance - (entry?.subscription?.rideFee || 0)
          );
          await processPaymentAsGuest({
            prisma,
            cardID,
            terminalID,
            familyId: family.id,
          });
        } else {
          return failedResponse(STATUS_CODES.FAILED_INSUFFICIENT_BALANCE);
        }
      }
      return successResponse(family.balance);
    });
  } catch (error) {
    console.error("Transaction error. Try again.", error);
    return failedResponse(STATUS_CODES.FAILED_SERVER_ERROR);
  }
};

export class Response {
  private fee: number = 0;
  private cardBalance: number = 0;
  constructor(
    private client: MqttClient,
    private terminalID: string,
    private cardID: Card["id"],
    private cardOwner: string,
    private remote: boolean
  ) {}
  setCardOwner(cardOwner: string) {
    this.cardOwner = cardOwner;
  }
  getCardOwner() {
    return this.cardOwner;
  }
  sendProgress() {
    this.sendStatus(202);
  }
  sendPaidWithSubscription() {
    this.sendStatus(210);
  }

  sendFailed(status: number = 500) {
    this.sendStatus(status);
  }
  setFee(fee: number) {
    this.fee = fee;
  }
  setCardBalance(balance: number) {
    this.cardBalance = balance;
  }
  setUserBalance(balance: number) {
    this.cardBalance = balance;
  }
  sendStatus(status: number, callback?: () => void) {
    this.client.publish(
      "t" + this.terminalID,
      "<" + status + "R!",
      {
        qos: 2,
        retain: false,
      },
      callback
    );
  }
  sendBalance(balance: number, callback?: () => void) {
    this.client.publish(
      "t" + this.terminalID,
      "<201," + balance / 100 + "!",
      {
        qos: 2,
        retain: false,
      },
      callback
    );
  }

  getTerminalID() {
    return this.terminalID;
  }
  getCardID() {
    return this.cardID;
  }
  getUserID() {
    return this.cardOwner;
  }
  getFee() {
    return this.fee;
  }
  getIfRemote() {
    return this.remote;
  }
}

async function getCardWithDetails({
  prisma,
  cardID,
}: {
  prisma: any;
  cardID: string;
}): Promise<
  Card & {
    family: Family & {
      subscription: Subscription;
      entry: Entry & {
        id: string;
        terminals: {
          id: string;
        }[];
        subscription: Subscription;
      };
      cards: Card[];
    };
  }
> {
  return prisma.card.findUnique({
    where: { id: cardID },
    include: {
      family: {
        include: {
          subscription: true,
          entry: {
            select: {
              id: true,
              terminals: {
                select: {
                  id: true,
                },
              },
              subscription: true,
            },
          },
          cards: true,
        },
      },
    },
  });
}
function isTerminalInTheSameEntry({
  entry,
  terminalID,
}: {
  entry: Entry & {
    terminals: {
      id: string;
    }[];
  };
  terminalID: string;
}) {
  return entry.terminals.some((t) => t.id === terminalID);
}

function isNextSubscriptionPaymentInFuture({
  family,
}: {
  family: Family & {
    subscription: Subscription;
  };
}) {
  const lastPaymentDate = new Date(family?.subscription?.lastPayment ?? 0);
  const currentDate = new Date();

  // Calculate the same day of the previous month
  const sameDayPreviousMonth = new Date(currentDate);
  sameDayPreviousMonth.setMonth(currentDate.getMonth() - 1);

  const needsToPay = lastPaymentDate < sameDayPreviousMonth;
  return !needsToPay;
}

function isLastCardsPaymentWithinLastMonth({
  family,
}: {
  family: Family & { subscription: Subscription };
}) {
  const lastPaymentDate = new Date(family?.lastPayment ?? 0);
  const currentDate = new Date();

  // Calculate the same day of the previous month
  const sameDayPreviousMonth = new Date(currentDate);
  sameDayPreviousMonth.setMonth(currentDate.getMonth() - 1);

  const needsToPay = lastPaymentDate < sameDayPreviousMonth;
  return !needsToPay;
}

function isLastSubscriptionPaymentWithinLastMonth({
  subscription,
}: {
  subscription: Subscription;
}) {
  const lastPaymentDate = new Date(subscription?.lastPayment ?? 0);
  const currentDate = new Date();

  // Calculate the same day of the previous month
  const sameDayPreviousMonth = new Date(currentDate);
  sameDayPreviousMonth.setMonth(currentDate.getMonth() - 1);

  const needsToPay = lastPaymentDate < sameDayPreviousMonth;
  return !needsToPay;
}

async function createRide({
  prisma,
  cardID,
  terminalID,
  family,
}: {
  prisma: any;
  cardID: string;
  terminalID: string;
  family: Family;
}) {
  await prisma.ride.create({
    data: {
      cardId: cardID,
      terminalId: terminalID,
      familyId: family.id,
      subscriptionId: family.subscriptionId,
      entryId: family.entryId,
    },
  });
}

async function processPaymentWithinTheSameEntry({
  prisma,
  cardID,
  terminalID,
  family,
}: {
  prisma: any;
  cardID: string;
  terminalID: string;
  family: Family & {
    subscription: Subscription;
    entry: Entry & {
      subscription: Subscription;
    };
  };
}) {
  try {
    // Run database operations concurrently
    const [updatedFamily, , ,] = await Promise.all([
      prisma.family.update({
        where: { id: family.id },
        data: { balance: { decrement: family.subscription.rideFee } },
      }),
      prisma.entry.update({
        where: { id: family.entryId },
        data: { balance: { increment: family.subscription.rideFee } },
      }),
      prisma.payment.create({
        data: {
          amount: family.subscription.rideFee,
          description: "Ride fee deduction",
          familyId: family.id,
          subscriptionId: family.subscriptionId,
          terminalId: terminalID,
          entryId: family.entryId,
          type: "RIDE",
        },
      }),
      prisma.ride.create({
        data: {
          cardId: cardID,
          terminalId: terminalID,
          familyId: family.id,
          subscriptionId: family.subscriptionId,
          entryId: family.entryId,
        },
      }),
    ]);

    // Update local balance to reflect changes
    family.balance = updatedFamily.balance;
  } catch (error) {
    console.error("Error processing payment:", error);
    throw new Error("Failed to process payment");
  }
}

async function processPaymentAsGuest({
  prisma,
  cardID,
  terminalID,
  familyId,
}: {
  prisma: any;
  cardID: string;
  terminalID: string;
  familyId: string;
}) {
  try {
    // Run database operations concurrently

    const entry = await prisma.entry.findFirst({
      where: {
        terminals: {
          some: {
            id: terminalID,
          },
        },
      },
      include: {
        subscription: true,
      },
    });

    if (!entry || !entry.subscription) {
      console.error(
        "Entry or subscription not found for terminal:",
        terminalID
      );
      throw new Error("Entry or subscription not found for terminal");
    }

    const [updatedFamily, , ,] = await Promise.all([
      prisma.family.update({
        where: { id: familyId },
        data: { balance: { decrement: entry.subscription.rideFee } },
      }),
      prisma.entry.updateMany({
        where: {
          terminals: {
            some: {
              id: terminalID,
            },
          },
        },
        data: { balance: { increment: entry.subscription.rideFee } },
      }),
      prisma.payment.create({
        data: {
          amount: entry.subscription.rideFee,
          description: "Ride fee deduction guest",
          familyId: familyId,
          subscriptionId: entry.subscription.id,
          terminalId: terminalID,
          entryId: entry.id,
          type: "RIDE",
        },
      }),
      prisma.ride.create({
        data: {
          cardId: cardID,
          terminalId: terminalID,
          familyId: familyId,
          subscriptionId: entry.subscription.id,
          entryId: entry.id,
        },
      }),
    ]);
  } catch (error) {
    console.error("Error processing payment:", error);
    throw new Error("Failed to process payment");
  }
}

function failedResponse(statusNumber: number): MakePaymentResponse {
  return { status: "failed", balance: 0, statusNumber };
}

function successResponse(balance: number): MakePaymentResponse {
  return {
    status: "success",
    balance: balance,
    statusNumber: STATUS_CODES.SUCCESS,
  };
}
