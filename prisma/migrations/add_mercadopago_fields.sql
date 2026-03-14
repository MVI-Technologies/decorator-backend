-- Migration: add_mercadopago_payment_fields
-- Adiciona AWAITING_PAYMENT ao enum ProjectStatus e novos campos de pagamento MP ao Project

-- 1. Adicionar novo valor ao enum ProjectStatus
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT' AFTER 'PROFESSIONAL_ASSIGNED';

-- 2. Adicionar novos campos ao modelo Project
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "selected_professional_id" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_preference_id"    TEXT,
  ADD COLUMN IF NOT EXISTS "payment_checkout_url"     TEXT,
  ADD COLUMN IF NOT EXISTS "payment_id"               TEXT,
  ADD COLUMN IF NOT EXISTS "payment_status"           TEXT,
  ADD COLUMN IF NOT EXISTS "payment_method"           TEXT,
  ADD COLUMN IF NOT EXISTS "installments"             INTEGER,
  ADD COLUMN IF NOT EXISTS "transaction_amount"       DOUBLE PRECISION;
