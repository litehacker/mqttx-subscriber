-- CreateTable
CREATE TABLE "Firmware" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "lastAddress" TEXT NOT NULL,
    "software" TEXT NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "Firmware_pkey" PRIMARY KEY ("id")
);
