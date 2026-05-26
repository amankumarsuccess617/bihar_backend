/*
  Warnings:

  - You are about to drop the column `resultPublished` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `resultPublishedAt` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `Result` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AdmitCard_rollNo_idx";

-- DropIndex
DROP INDEX "Application_userId_postId_key";

-- DropIndex
DROP INDEX "Result_publishedAt_idx";

-- DropIndex
DROP INDEX "Result_rank_idx";

-- DropIndex
DROP INDEX "Result_status_idx";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "resultPublished",
DROP COLUMN "resultPublishedAt";

-- AlterTable
ALTER TABLE "Result" DROP COLUMN "isPublished",
DROP COLUMN "remarks";
