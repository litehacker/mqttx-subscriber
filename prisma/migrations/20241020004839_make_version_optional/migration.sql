-- AlterTable
CREATE SEQUENCE firmware_version_seq;
ALTER TABLE "Firmware" ALTER COLUMN "version" DROP NOT NULL,
ALTER COLUMN "version" SET DEFAULT nextval('firmware_version_seq');
ALTER SEQUENCE firmware_version_seq OWNED BY "Firmware"."version";
