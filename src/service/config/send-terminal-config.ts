import prisma from "../../../prisma/client";
export const getSubscriptionFee = async (
  terminalID: string
): Promise<number> => {
  try {
    // Step 1: Find the terminal by ID to get the subscriptionId
    const terminal = await prisma.terminal.findUnique({
      where: {
        id: terminalID,
      },
      select: {
        subscriptionId: true, // Only fetch the subscriptionId
      },
    });

    if (!terminal || !terminal.subscriptionId) {
      throw new Error("Subscription not found for the given terminal ID");
    }

    // Step 2: Use the subscriptionId to get the subscription's rideFee
    const subscription = await prisma.subscription.findUnique({
      where: {
        id: terminal.subscriptionId,
      },
      select: {
        rideFee: true, // Only fetch the rideFee
      },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    return subscription.rideFee;
  } catch (error) {
    console.error("Error in getSubscriptionFee", error);
    throw new Error("ტერმინალი ვერ მოიძებნა");
  }
};
