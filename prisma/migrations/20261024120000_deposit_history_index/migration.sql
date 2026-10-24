-- Bound the cost of receipt credit totals and linked correction lookups.
CREATE INDEX "WalletJournal_paymentId_idx" ON "WalletJournal"("paymentId");
