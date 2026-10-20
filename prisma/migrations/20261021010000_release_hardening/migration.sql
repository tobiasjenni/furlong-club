CREATE TABLE "RateLimit" (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL CHECK (hits > 0),
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
