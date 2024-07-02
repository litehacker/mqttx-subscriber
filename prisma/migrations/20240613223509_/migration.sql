/*
  Warnings:

  - A unique constraint covering the columns `[terminalId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "terminalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_terminalId_key" ON "Subscription"("terminalId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
