-- Migration: add_professional_subscriptions

-- 1. Create Enum
CREATE TYPE "ProfessionalSubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAST_DUE', 'CANCELED');

-- 2. Add columns to professional_profiles
ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "subscription_status"     "ProfessionalSubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
  ADD COLUMN IF NOT EXISTS "subscription_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mp_subscription_id"      TEXT,
  ADD COLUMN IF NOT EXISTS "mp_preapproval_plan_id"  TEXT;

-- 3. Add default system config for subscription fee if not exists
INSERT INTO "system_config" ("id", "key", "value", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'PROFESSIONAL_MONTHLY_FEE', '21.90', now(), now())
ON CONFLICT ("key") DO NOTHING;

-- 4. Add default system config for platform fee if not exists
INSERT INTO "system_config" ("id", "key", "value", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'PLATFORM_FEE_PERCENTAGE', '15', now(), now())
ON CONFLICT ("key") DO NOTHING;
