import * as dotenv from "dotenv";

dotenv.config();

export const mqttConfig = {
  topicToRead: process.env.TOPICTOREAD!,
  brokerUrl: process.env.MQTT_BROKER_URL!,
  brokerPort: process.env.MQTT_BROKER_PORT!,
  username: process.env.MQTT_BROKER_USERNAME!,
  password: process.env.MQTT_BROKER_PASSWORD!,
};
