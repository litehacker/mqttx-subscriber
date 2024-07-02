export type Message = {
  topic: string;
  payload: {
    operationType:
      | "check"
      | "payment"
      | "acknowledge"
      | "makepayment"
      | "makepayment_remotely"
      | "payment_remotely"
      | "config";
    content: {
      cardID?: string;
      userID?: string;
      terminalID: string;
      firmwareVersion: number;
      status?: "success" | "fail";
    };
  };
  qos: number;
  retain: boolean;
  dup: boolean;
};
export type MakePaymentResponse = {
  status: "success" | "failed";
  balance: number;
  statusNumber: number;
};
