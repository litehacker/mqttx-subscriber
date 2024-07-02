/*
  Warnings:

  - You are about to drop the column `entryId` on the `Subscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[subscriptionId]` on the table `Entry` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_entryId_fkey";

-- DropIndex
DROP INDEX "Subscription_entryId_key";

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "entryId";

-- CreateIndex
CREATE UNIQUE INDEX "Entry_subscriptionId_key" ON "Entry"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
