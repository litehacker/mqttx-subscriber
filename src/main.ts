import { mqttClient } from "./mqttClient";
import { mqttConfig } from "./service/config";
import {
  handleAcknowledge,
  handleCheck,
  handleConfig,
  handlePayment,
} from "./service/message-handlers";
import { TerminalMonitorService } from "./online-state-tg";
import { Message } from "./types";

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
export const updatedDataChunks: {
  [key: string]: {
    chunks: string[];
    index: number;
    version: number;
    startTime: Date;
    lastAddress: string;
  };
} = {};
