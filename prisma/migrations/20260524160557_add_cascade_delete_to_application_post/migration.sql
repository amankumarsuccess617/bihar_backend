-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_postId_fkey";

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
