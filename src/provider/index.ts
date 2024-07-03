import axios from "axios";
import * as dotenv from "dotenv";
import { MakePaymentResponse, Message } from "../types";
import { MqttClient } from "mqtt";
import { EventEmitter } from "node:events";
import {
  Card,
  Entry,
  Family,
  Payment,
  Subscription,
  Terminal,
  User,
} from "@prisma/client";
import prisma from "../../prisma/client";
dotenv.config();
const STATUS_CODES = {
  SUCCESS: 200,
  FAILED_MISSING_CARD: 296,
  FAILED_INACTIVE_CARD: 297,
  FAILED_INSUFFICIENT_BALANCE: 291,
};
export const checkTerminalUpdate = (
  terminal: Message["payload"]["content"]
): Promise<{
  update: boolean;
  _firmware?: {
    LastAddress: string;
    Version: number;
    Code: string;
    Date: Date;
    Name: string;
  };
}> => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(terminal);
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url:
        process.env.UPDATE_CHECK_URL ??
        "https://us-central1-lift-os.cloudfunctions.net/checkFirmwareUpdate",
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
    };
    axios
      .request(config)
      .then(
        (response: {
          data: {
            update: boolean;
            _firmware?: {
              LastAddress: string;
              Version: number;
              Code: string;
              Date: Date;
              Name: string;
            };
          };
        }) => {
          resolve(response.data);
        }
      )
      .catch((error) => {
        reject(error);
      });
  });
};

export const payForRide = async ({ response }: { response: Response }) => {
  try {
    const paymentResponse = await MakePayment({
      cardID: response.getCardID(),
      terminalID: response.getTerminalID(),
      response,
    });
    if (paymentResponse.status === "success") {
      response.sendBalance(paymentResponse.balance);
    } else {
      response.sendFailed(paymentResponse.statusNumber);
    }
  } catch (e) {
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
      if (!card) return failedResponse(STATUS_CODES.FAILED_MISSING_CARD);
      if (!card.active)
        return failedResponse(STATUS_CODES.FAILED_INACTIVE_CARD);
      const { family } = card;
      if (isNextPaymentInFuture({ family })) {
        await createRide({
          prisma,
          cardID,
          terminalID,
          family,
        });
        response.sendBalance(family.balance);
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
    console.error("Transaction error:", error);
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
    };
  }
> {
  return prisma.card.findUnique({
    where: { id: cardID },
    include: { family: { include: { subscription: true } } },
  });
}

function isNextPaymentInFuture({
  family,
}: {
  family: Family & {
    subscription: Subscription;
  };
}) {
  return family?.nextPayment && new Date(family?.nextPayment) > new Date();
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
