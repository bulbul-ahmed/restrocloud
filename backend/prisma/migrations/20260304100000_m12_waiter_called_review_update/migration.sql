-- M12: Add WAITER_CALLED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WAITER_CALLED';

-- M12.14: Make Review.customerId optional (allow anonymous QR feedback)
ALTER TABLE "reviews" ALTER COLUMN "customerId" DROP NOT NULL;

-- M12.14: Add channel field to Review
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "channel" TEXT;

-- M12.14: Update FK to use SET NULL on customer delete
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_customerId_fkey";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
