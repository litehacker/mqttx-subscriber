/*
  Warnings:

  - You are about to drop the column `name` on the `Family` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `House` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Terminal` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pin]` on the table `Card` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[subscriptionId]` on the table `Family` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subscriptionId` to the `Family` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Family` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `House` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Terminal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_familyId_fkey";

-- DropForeignKey
ALTER TABLE "Terminal" DROP CONSTRAINT "Terminal_entryId_fkey";

-- DropForeignKey
ALTER TABLE "Terminal" DROP CONSTRAINT "Terminal_ownerId_fkey";

-- AlterTable
ALTER TABLE "Card" ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "content" DROP NOT NULL,
ALTER COLUMN "familyId" DROP NOT NULL,
ALTER COLUMN "balance" SET DEFAULT 0,
ALTER COLUMN "active" SET DEFAULT false,
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Family" DROP COLUMN "name",
ADD COLUMN     "subscriptionId" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "House" DROP COLUMN "name",
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "name";

-- AlterTable
ALTER TABLE "Terminal" DROP COLUMN "name",
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "entryId" DROP NOT NULL,
ALTER COLUMN "balance" SET DEFAULT 0,
ALTER COLUMN "ownerId" DROP NOT NULL,
ALTER COLUMN "subscriptionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "fullName" TEXT NOT NULL,
ALTER COLUMN "balance" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Card_pin_key" ON "Card"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "Family_subscriptionId_key" ON "Family"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
