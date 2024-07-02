/*
  Warnings:

  - You are about to drop the column `terminalId` on the `Payment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_terminalId_fkey";

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "balance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "lastPayment" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "terminalId",
ADD COLUMN     "entryId" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastOnline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Terminal" ADD COLUMN     "free" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "Ride" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
