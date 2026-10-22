-- Keyed IP fingerprints only. The invitation hash is part of the fingerprint,
-- so password rotation invalidates every previously admitted network.
CREATE TABLE "ClubAdmission" (
  "key" TEXT NOT NULL PRIMARY KEY CHECK ("key" ~ '^[0-9a-f]{64}$'),
  "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
