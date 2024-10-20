import { MqttClient } from "mqtt";
import { TerminalResponseStatus } from "../../constants";
import {
  send200,
  send400,
  sendChunk,
  sendEnd,
  sendErase,
  splitString,
} from "../../utils";
import { checkTerminalUpdate, payForRide } from "../../provider";
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

export function handleAcknowledge(
  client: MqttClient,
  data: Message["payload"]
): void {
  if (data.content.status === "success") {
    // Logic to handle acknowledgment of update
    if (updatedDataChunks[data.content.terminalID]) {
      if (
        updatedDataChunks[data.content.terminalID].chunks.length ===
        updatedDataChunks[data.content.terminalID].index
      ) {
        sendEnd(
          client,
          data.content.terminalID,
          updatedDataChunks[data.content.terminalID].version
        );
        delete updatedDataChunks[data.content.terminalID];
        return;
      }
      sendChunk(
        client,
        data.content.terminalID,
        updatedDataChunks[data.content.terminalID].chunks[
          updatedDataChunks[data.content.terminalID].index
        ],
        () => {
          updatedDataChunks[data.content.terminalID].index++;
        }
      );
    } else {
      send200(client, data.content.terminalID);
    }
  }
}

export function handleCheck(
  client: MqttClient,
  data: Message["payload"]
): void {
  const terminal = {
    firmwareVersion: data.content.firmwareVersion,
    terminalID: data.content.terminalID,
  };
  console.log("Checking for updates for terminal:", terminal.terminalID);
  if (terminal.firmwareVersion && terminal.terminalID) {
    console.log("Checking for updates for terminal:", terminal.terminalID);
    checkTerminalUpdate(terminal)
      .then((response) => {
        if (response.update && response._firmware) {
          updatedDataChunks[terminal.terminalID] = {
            chunks: splitString(response._firmware.software, 960),
            index: 0,
            version: response._firmware.version,
            startTime: new Date(),
            lastAddress: response._firmware.lastAddress,
          };
          sendErase(
            client,
            terminal.terminalID,
            response._firmware.lastAddress
          );
          setTimeout(() => {
            if (
              updatedDataChunks[terminal.terminalID] &&
              updatedDataChunks[terminal.terminalID].index !==
                updatedDataChunks[terminal.terminalID].chunks.length - 1
            ) {
              delete updatedDataChunks[terminal.terminalID];
              return;
            }
          }, 180000);
        } else {
          console.log("No update available for terminal:", terminal.terminalID);
          send200(client, terminal.terminalID);
        }
      })
      .catch((error) => {
        console.error(error);
        send200(client, terminal.terminalID);
      });
  }
}
