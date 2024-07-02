/*
  Warnings:

  - You are about to drop the column `lastOnline` on the `Subscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[subscriptionId]` on the table `Family` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "lastOnline";

-- AlterTable
ALTER TABLE "Terminal" ADD COLUMN     "lastOnline" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Family_subscriptionId_key" ON "Family"("subscriptionId");
