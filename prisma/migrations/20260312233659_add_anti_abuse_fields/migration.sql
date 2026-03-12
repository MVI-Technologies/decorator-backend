-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "block_reason" TEXT,
ADD COLUMN     "is_blocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "professional_profiles" ADD COLUMN     "instagram" TEXT;
