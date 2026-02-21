-- AlterTable
ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "document_url" TEXT;
ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "link_url" TEXT;
