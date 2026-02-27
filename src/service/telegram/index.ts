import axios from "axios";
import prisma from "../../../prisma/client";
import { Terminal } from "@prisma/client";

export class TelegramNotificationService {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    if (!botToken || !chatId) {
      throw new Error(
        "Bot token and chat ID are required for Telegram service",
      );
    }
    this.botToken = botToken;
    this.chatId = chatId;
  }

  public async sendMessage(message: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const formattedMessage = this.formatMessage(message);
    try {
      await axios.post(url, {
        chat_id: this.chatId,
        text: formattedMessage,
        parse_mode: "HTML",
      });
      console.log("Message sent successfully to Telegram");
    } catch (error) {
      console.error("Error sending message to Telegram:", error);
    }
  }

  private formatMessage(message: string): string {
    const timestamp = new Date();
    return `${message}\n${timestamp.toLocaleDateString()}`;
  }

  public async sendTerminalStatusUpdate(
    terminalId: string,
    status: "online" | "offline",
  ): Promise<void> {
    const emoji = status === "online" ? "🟢" : "🔴";
    let terminal: Partial<Terminal> & {
      status: "online" | "offline";
    } = {
      id: terminalId,
      status,
    };
    try {
      const terminalData = await prisma.terminal.findUnique({
        where: { id: terminalId },
        include: {
          entry: {
            select: {
              house: {
                select: {
                  address: true,
                },
              },
              title: true,
            },
          },
        },
      });
      if (!terminal) {
        console.error("Terminal not found:", terminalId);
      }
      terminal = {
        ...terminal,
        ...terminalData,
      };
    } catch (error) {
      console.error("Error fetching terminal:", error);
    }
    // @ts-ignore-next-line

    const message = ` ${emoji} <b>${terminal?.entry?.house?.address} - ${terminal?.entry?.title}</b> Terminal with ID
        <code>${terminalId}</code> is now ${status}`;

    await this.sendMessage(message);
  }
}
