/*
  Warnings:

  - A unique constraint covering the columns `[userId,postId]` on the table `Application` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "resultPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resultPublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remarks" TEXT;

-- CreateIndex
CREATE INDEX "AdmitCard_rollNo_idx" ON "AdmitCard"("rollNo");

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_postId_key" ON "Application"("userId", "postId");

-- CreateIndex
CREATE INDEX "Result_status_idx" ON "Result"("status");

-- CreateIndex
CREATE INDEX "Result_rank_idx" ON "Result"("rank");

-- CreateIndex
CREATE INDEX "Result_publishedAt_idx" ON "Result"("publishedAt");
