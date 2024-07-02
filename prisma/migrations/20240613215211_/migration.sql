/*
  Warnings:

  - You are about to drop the column `terminalId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionId` on the `Terminal` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[entryId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `entryId` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_terminalId_fkey";

-- DropIndex
DROP INDEX "Subscription_terminalId_key";

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "terminalId",
ADD COLUMN     "entryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Terminal" DROP COLUMN "subscriptionId";

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_entryId_key" ON "Subscription"("entryId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
