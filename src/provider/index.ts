import * as dotenv from "dotenv";
import { MakePaymentResponse } from "../types";
import { MqttClient } from "mqtt";
import { Card, Entry, Family, Firmware, Subscription } from "@prisma/client";
import prisma from "../../prisma/client";
dotenv.config();

const STATUS_CODES = {
  SUCCESS: 200,
  FAILED_MISSING_CARD: 296,
  FAILED_INACTIVE_CARD: 297,
  FAILED_INSUFFICIENT_BALANCE: 291,
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
      const { family } = card;
      if (isNextPaymentInFuture({ family })) {
        if (isTerminalInTheSameEntry({ entry: family?.entry, terminalID })) {
          // we are in the same terminal where we have subscription
          await createRide({
            prisma,
            cardID,
            terminalID,
            family,
          });
          response.sendBalance(family.balance);
        } else {
          if (family.balance >= family.subscription.rideFee) {
            response.sendBalance(family.balance - family.subscription.rideFee);
            await processPayment({
              prisma,
              cardID,
              terminalID,
              family,
            });
          } else {
            return failedResponse(STATUS_CODES.FAILED_INSUFFICIENT_BALANCE);
          }
        }
      } else if (family.balance >= family.subscription.rideFee) {
        response.sendBalance(family.balance - family.subscription.rideFee);
        await processPayment({
          prisma,
          cardID,
          terminalID,
          family,
        });
      } else {
        return failedResponse(STATUS_CODES.FAILED_INSUFFICIENT_BALANCE);
      }

      return successResponse(family.balance);
    });
  } catch (error) {
    throw new Error("Transaction error. Try again.");
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
      };
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
            },
          },
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

function isNextPaymentInFuture({
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

async function processPayment({
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
  };
}) {
  const updatedFamily = await prisma.family.update({
    where: { id: family.id },
    data: { balance: { decrement: family.subscription.rideFee } },
  });

  await prisma.entry.update({
    where: { id: family.entryId },
    data: { balance: { increment: family.subscription.rideFee } },
  });

  await prisma.payment.create({
    data: {
      amount: family.subscription.rideFee,
      description: "Ride fee deduction",
      familyId: family.id,
      subscriptionId: family.subscriptionId,
      terminalId: terminalID,
      entryId: family.entryId,
    },
  });

  await createRide({ prisma, cardID, terminalID, family });
  family.balance = updatedFamily.balance; // Update local balance to reflect changes
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
