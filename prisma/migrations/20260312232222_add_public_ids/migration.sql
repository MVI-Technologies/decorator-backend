/*
  Warnings:

  - A unique constraint covering the columns `[public_id]` on the table `client_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[public_id]` on the table `professional_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[public_id]` on the table `projects` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN     "public_id" TEXT;

-- AlterTable
ALTER TABLE "professional_profiles" ADD COLUMN     "public_id" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "public_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_public_id_key" ON "client_profiles"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_public_id_key" ON "professional_profiles"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_public_id_key" ON "projects"("public_id");
