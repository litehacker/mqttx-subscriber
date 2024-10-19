import { mqttClient } from "./mqttClient";
import { mqttConfig } from "./service/config";
import { handleConfig, handlePayment } from "./service/message-handlers";
import { TerminalMonitorService } from "./online-state-tg";
import { Message } from "./types";
import { MqttClient } from "mqtt";
import { send200, sendChunk, sendEnd, sendErase, splitString } from "./utils";
import { checkTerminalUpdate } from "./provider";

const monitorService = new TerminalMonitorService(
  mqttClient,
  mqttConfig.topicToRead
);

mqttClient.on("error", (error) => console.error("MQTT Error:", error));
mqttClient.on("connect", () => {
  monitorService.start();
  mqttClient.subscribe(mqttConfig.topicToRead, (err) => {
    if (err) {
      console.error("Subscription error:", err);
    } else {
      console.log("Connected and subscribed to topic:", mqttConfig.topicToRead);
    }
  });
});

mqttClient.on("message", async (topic, message) => {
  try {
    const data: Message["payload"] = JSON.parse(message.toString("utf-8"));

    switch (data.operationType) {
      case "check":
        handleCheck(mqttClient, data);
        break;
      case "payment":
        handlePayment(mqttClient, data);
        break;
      case "acknowledge":
        handleAcknowledge(mqttClient, data);
        break;
      case "config":
        handleConfig(mqttClient, data);
        break;
      default:
        console.warn("Unknown operation type:", data.operationType);
    }
  } catch (e) {
    console.error("Error parsing message:", e);
  }
});

mqttClient.on("disconnect", () => monitorService.stop());

// Keep track of firmware update data for each terminal
const updatedDataChunks: {
  [key: string]: {
    chunks: string[];
    index: number;
    version: number;
    startTime: Date;
    lastAddress: string;
  };
} = {};

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
            chunks: splitString(response._firmware.Code, 960),
            index: 0,
            version: response._firmware.Version,
            startTime: new Date(),
            lastAddress: response._firmware.LastAddress,
          };
          sendErase(
            client,
            terminal.terminalID,
            response._firmware.LastAddress
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
