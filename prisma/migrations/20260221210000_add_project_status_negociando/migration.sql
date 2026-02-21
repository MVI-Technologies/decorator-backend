-- AlterEnum (IF NOT EXISTS evita erro se o valor já foi adicionado)
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'NEGOCIANDO' AFTER 'MATCHING';
