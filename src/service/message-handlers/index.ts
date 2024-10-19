import { MqttClient } from "mqtt";
import { TerminalResponseStatus } from "../../constants";
import { send400 } from "../../utils";
import { payForRide } from "../../provider";
import { Message } from "../../types";
import { Response } from "../../provider";
import { getSubscriptionFee } from "../config/send-terminal-config";

export function handlePayment(client: MqttClient, data: Message["payload"]) {
  if (!data.content.cardID) {
    console.error("Missing card ID:", data.content);
    send400(client, data.content.terminalID);
    return;
  }

  const response = new Response(
    client,
    data.content.terminalID,
    data.content.cardID ?? "unknown",
    data.content.userID ?? "unknown",
    false
  );
  payForRide({ response });
}

const updatedDataChunks: {
  [key: string]: {
    chunks: string[];
    index: number;
    version: number;
    startTime: Date;
    lastAddress: string;
  };
} = {};

export function handleConfig(
  client: MqttClient,
  data: Message["payload"]
): void {
  getSubscriptionFee(data.content.terminalID)
    .then((fee) => {
      client.publish("t" + data.content.terminalID, `<222,${fee}!`, {
        qos: 2,
        retain: false,
      });
      console.log("Fee sent", fee);
    })
    .catch((e) => {
      client.publish(
        "t" + data.content.terminalID,
        TerminalResponseStatus["494"].value,
        {
          qos: 2,
          retain: false,
        }
      );
      console.error(e);
    });
}
