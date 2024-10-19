import { PrismaClient } from "@prisma/client";
import { MqttClient } from "mqtt";
import prisma from "../../prisma/client";
import * as dotenv from "dotenv";
import { TelegramNotificationService } from "../service/telegram";

interface TerminalStatus {
  lastSeen: Date;
  isOnline: boolean;
  lastStatusSent: "online" | "offline"; // Keep track of last sent status
}

interface CheckMessage {
  operationType: string;
  content: {
    terminalID: string;
  };
}

dotenv.config();

export class TerminalMonitorService {
  private prisma: PrismaClient;
  private mqttClient: MqttClient;
  private topic: string;
  private terminalStatuses: Map<string, TerminalStatus>;
  private checkInterval!: NodeJS.Timeout;
  private fetchInterval!: NodeJS.Timeout;
  private telegramService: TelegramNotificationService;

  constructor(mqttClient: MqttClient, topic: string) {
    this.prisma = prisma;
    this.mqttClient = mqttClient;
    this.topic = topic;
    this.terminalStatuses = new Map();

    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      throw new Error("Missing environment variables");
    }

    this.telegramService = new TelegramNotificationService(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_CHAT_ID
    );
  }

  public async start(): Promise<void> {
    try {
      await this.fetchActiveTerminals();
      this.subscribeToMqtt();
      this.startIntervals();
    } catch (error) {
      console.error("Error starting terminal monitor service:", error);
      this.stop();
    }
  }

  public stop(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.fetchInterval) clearInterval(this.fetchInterval);
  }

  private async fetchActiveTerminals(): Promise<void> {
    const activeTerminals = await this.prisma.terminal.findMany({
      where: { active: true },
      select: { id: true },
    });

    activeTerminals.forEach((terminal) => {
      if (!this.terminalStatuses.has(terminal.id)) {
        this.terminalStatuses.set(terminal.id, {
          lastSeen: new Date(0), // Set to epoch initially
          isOnline: false,
          lastStatusSent: "offline", // Initial status is offline
        });
      }
    });

    console.log(`Fetched ${activeTerminals.length} active terminals`);
  }

  private subscribeToMqtt(): void {
    console.info("Connected to MQTT broker Tracker");
    this.mqttClient.subscribe(this.topic, (err) => {
      if (err) {
        console.error("Error subscribing to topic Tracker:", err);
      } else {
        console.log("Subscribed to topic Tracker:", this.topic);
      }
    });

    this.mqttClient.on("message", (topic, message) => {
      this.handleMqttMessage(topic, message);
    });
  }

  private async handleMqttMessage(
    topic: string,
    message: Buffer
  ): Promise<void> {
    try {
      const data: CheckMessage = JSON.parse(message.toString("utf-8"));

      if (data.operationType === "check") {
        const terminalId = data.content.terminalID;
        const status = this.terminalStatuses.get(terminalId);

        if (status) {
          const now = new Date();
          status.lastSeen = now;
          status.isOnline = true;

          // If terminal was offline and has just come back online, notify
          if (status.lastStatusSent === "offline") {
            await this.telegramService.sendTerminalStatusUpdate(
              terminalId,
              "online"
            );
            status.lastStatusSent = "online"; // Update last sent status
          }
        } else {
          await this.telegramService.sendMessage(
            `Received check from unknown terminal: ${terminalId}`
          );
          console.log(`Received check from unknown terminal: ${terminalId}`);
        }
      }
    } catch (error) {
      console.error("Error processing MQTT message:", error);
    }
  }

  private startIntervals(): void {
    this.checkInterval = setInterval(
      () => this.checkTerminalStatuses(),
      60000 // Check every minute
    );

    this.fetchInterval = setInterval(
      () => this.fetchActiveTerminals(),
      3600000 // Every hour
    );
  }

  private async checkTerminalStatuses(): Promise<void> {
    const now = new Date();
    const offlineTerminals: string[] = [];

    try {
      // Identify offline terminals
      this.terminalStatuses.forEach((status, terminalId) => {
        const timeSinceLastSeen = now.getTime() - status.lastSeen.getTime();

        // If the terminal has not sent a check message in the last 12 minutes
        if (timeSinceLastSeen > 12 * 60 * 1000) {
          status.isOnline = false;

          // Only send offline status if the last sent status was online
          if (status.lastStatusSent === "online") {
            offlineTerminals.push(terminalId);
            status.lastStatusSent = "offline"; // Update last sent status
          }
        }
      });

      // Send status updates for offline terminals concurrently
      await Promise.all(
        offlineTerminals.map(async (terminalId) => {
          try {
            await this.telegramService.sendTerminalStatusUpdate(
              terminalId,
              "offline"
            );
          } catch (error) {
            console.error(
              `Error sending offline status for terminal ${terminalId}:`,
              error
            );
          }
        })
      );
    } catch (error) {
      console.error("Error checking terminal statuses:", error);
    }
  }
}
