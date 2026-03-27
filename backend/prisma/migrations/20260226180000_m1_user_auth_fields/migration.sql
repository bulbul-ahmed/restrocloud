-- M1 Auth Fields: email verification, password reset, 2FA pending flag
ALTER TABLE "users"
  ADD COLUMN "twoFaPending"         BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "emailVerifyToken"     TEXT,
  ADD COLUMN "emailVerifyExpires"   TIMESTAMP(3),
  ADD COLUMN "passwordResetToken"   TEXT,
  ADD COLUMN "passwordResetExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_emailVerifyToken_key"   ON "users"("emailVerifyToken");
CREATE UNIQUE INDEX "users_passwordResetToken_key" ON "users"("passwordResetToken");
