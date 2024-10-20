/*
  Warnings:

  - Made the column `version` on table `Firmware` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Firmware" ALTER COLUMN "version" SET NOT NULL;
