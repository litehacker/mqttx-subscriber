import axios from "axios";

export class TelegramNotificationService {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    if (!botToken || !chatId) {
      throw new Error(
        "Bot token and chat ID are required for Telegram service"
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
    return `<b>Terminal Status Update</b>\n${timestamp}\n\n${message}`;
  }

  public async sendTerminalStatusUpdate(
    terminalId: string,
    status: "online" | "offline"
  ): Promise<void> {
    const emoji = status === "online" ? "🟢" : "🔴";
    const message = `Terminal <code>${terminalId}</code> is now ${status} ${emoji}`;
    await this.sendMessage(message);
  }
}
