import { connect, MqttClient } from "mqtt";
import { mqttConfig } from "./service/config";

export const mqttClient: MqttClient = connect(
  `mqtts://${mqttConfig.brokerUrl}:${mqttConfig.brokerPort}`,
  {
    clientId: `emqx_nodejs_${Math.random().toString(16).substring(2, 8)}`,
    username: mqttConfig.username,
    password: mqttConfig.password,
    clean: true,
  }
);
