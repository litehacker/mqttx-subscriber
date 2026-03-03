import prisma from "../../../prisma/client";

function isPrismaConnectionError(
  error: unknown
): error is { code?: string; message?: string } {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    return code === "P1001" || code === "P1017"; // Can't reach DB / connection closed
  }
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message)
      : "";
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("postgres.railway.internal")
  );
}

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
    if (isPrismaConnectionError(error)) {
      console.error(
        "Error in getSubscriptionFee: database unreachable (P1001). Use Railway public DATABASE_URL and ?connection_limit=5.",
        error
      );
      throw new Error(
        "Database connection unavailable. Check DATABASE_URL (use public URL, not postgres.railway.internal)."
      );
    }
    console.error("Error in getSubscriptionFee", error);
    throw new Error("ტერმინალი ვერ მოიძებნა");
  }
};
