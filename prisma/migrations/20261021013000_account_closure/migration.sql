-- Share the wallet's user-row lock so account closure cannot race an invoice or credit.
CREATE FUNCTION wallet_close_account(uid TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE;
BEGIN
  SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
  IF u.id IS NULL OR u.status<>'ACTIVE' THEN RETURN 'inactive'; END IF;
  IF u."balanceCents"<>0 OR u."walletFrozen" OR EXISTS (
    SELECT 1 FROM "Payment" WHERE "userId"=uid AND purpose='WALLET_TOPUP' AND status IN ('PENDING','CONFIRMING','PARTIAL')
  ) THEN RETURN 'wallet_unresolved'; END IF;
  UPDATE "User" SET status='CLOSED', "closedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    "updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), "marketingOptIn"=false, "sessionVersion"="sessionVersion"+1 WHERE id=uid;
  RETURN 'closed';
END $$;
