/*
  Warnings:

  - You are about to drop the column `subscriptionId` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `terminalId` on the `Subscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[subscriptionId]` on the table `Terminal` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_terminalId_fkey";

-- DropIndex
DROP INDEX "Subscription_terminalId_key";

-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "subscriptionId";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "terminalId";

-- AlterTable
ALTER TABLE "Terminal" ADD COLUMN     "subscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Terminal_subscriptionId_key" ON "Terminal"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
