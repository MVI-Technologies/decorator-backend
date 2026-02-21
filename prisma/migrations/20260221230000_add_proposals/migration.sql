-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'NEGOTIATING');

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "professional_profile_id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "package_type" TEXT,
    "estimated_days" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposals_project_id_status_idx" ON "proposals"("project_id", "status");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
