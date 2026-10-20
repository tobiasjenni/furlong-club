ALTER TABLE "Payment" ADD COLUMN "submittedAt" TIMESTAMP(3),
 ADD COLUMN "submittedTxHash" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3),
 ADD COLUMN "reviewedById" TEXT, ADD COLUMN "manualReviewNote" TEXT;
CREATE INDEX "Payment_provider_status_submittedAt_idx" ON "Payment"(provider,status,"submittedAt");

-- A chain transaction can support only one credited payment, including across tokens.
-- Reserve both pay-in and provider payout hashes so a payout cannot be reclaimed as a manual deposit.
CREATE TABLE "ReceiptClaim" (
 key TEXT PRIMARY KEY, "paymentId" TEXT NOT NULL REFERENCES "Payment"(id) ON DELETE RESTRICT,
 network TEXT NOT NULL, "txHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE INDEX "ReceiptClaim_paymentId_idx" ON "ReceiptClaim"("paymentId");
CREATE TRIGGER receipt_claim_immutable BEFORE UPDATE OR DELETE ON "ReceiptClaim" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();

CREATE FUNCTION wallet_reserve_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h TEXT; receipt_key TEXT; owner_id TEXT;
BEGIN
 IF NEW.status<>'CONFIRMED' OR NEW.provider='mock' THEN RETURN NEW; END IF;
 IF NEW.provider='manual' AND (NEW."reviewedById" IS NULL OR NEW."reviewedAt" IS NULL OR NEW."payinHash" IS NULL) THEN
  RAISE EXCEPTION 'Manual deposits require an admin review';
 END IF;
 FOREACH h IN ARRAY ARRAY[NEW."payinHash",NEW."payoutHash"] LOOP
  h := lower(regexp_replace(COALESCE(h,''),'^0x','','i'));
  IF h !~ '^[0-9a-f]{64}$' THEN CONTINUE; END IF;
  receipt_key := NEW.network || ':' || h;
  INSERT INTO "ReceiptClaim" (key,"paymentId",network,"txHash") VALUES (receipt_key,NEW.id,NEW.network,h)
   ON CONFLICT (key) DO NOTHING;
  SELECT "paymentId" INTO owner_id FROM "ReceiptClaim" WHERE key=receipt_key;
  IF owner_id<>NEW.id THEN RAISE EXCEPTION 'receipt_already_used'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_reserve_receipt BEFORE INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION wallet_reserve_receipt();

-- Reserve genuine historical hashes without rewriting any financial journal.
INSERT INTO "ReceiptClaim" (key,"paymentId",network,"txHash")
 SELECT DISTINCT ON (p.network,h.hash) p.network||':'||h.hash,p.id,p.network,h.hash
 FROM "Payment" p CROSS JOIN LATERAL (
  SELECT lower(regexp_replace(x,'^0x','','i')) AS hash FROM unnest(ARRAY[p."payinHash",p."payoutHash"]) AS x
 ) h WHERE p.status='CONFIRMED' AND p.provider<>'mock' AND h.hash ~ '^[0-9a-f]{64}$'
 ORDER BY p.network,h.hash,p."confirmedAt",p.id;

CREATE FUNCTION wallet_create_manual_deposit(uid TEXT,pid TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR u."emailVerifiedAt" IS NULL THEN RETURN 'unverified'; END IF;
 IF u."walletFrozen" THEN RETURN 'frozen'; END IF;
 IF cents<2000 OR cents>100000 OR (coin||':'||chain) NOT IN ('USDT:TRC20','USDT:ERC20','USDC:ERC20','USDC:POLYGON')
  OR address IS NULL OR length(address)<10 OR length(address)>200 THEN RETURN 'invalid'; END IF;
 IF (SELECT count(*) FROM "Payment" WHERE "userId"=uid AND provider='manual' AND status IN ('PENDING','CONFIRMING','PARTIAL'))>=3 THEN RETURN 'too_many_open'; END IF;
 INSERT INTO "Payment" (id,"userId",purpose,"amountCents",currency,network,provider,"providerRef","payAddress","payAmount","poolAddress","settlementStatus","providerStatus","updatedAt")
  VALUES (pid,uid,'WALLET_TOPUP',cents,coin,chain,'manual',pid,address,(cents::numeric/100)::text,address,'AWAITING_TRANSFER','awaiting_transfer',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
 INSERT INTO "PaymentEvent" (id,"paymentId","eventKey",source,payload,decision)
  VALUES (pid||':created',pid,'created','member',jsonb_build_object('userId',uid,'amountCents',cents,'currency',coin,'network',chain,'address',address),'deposit created');
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta)
  VALUES (pid||':created',uid,'manual_deposit.created',pid,jsonb_build_object('amountCents',cents,'currency',coin,'network',chain));
 RETURN 'created';
END $$;

CREATE FUNCTION wallet_report_manual_deposit(pid TEXT,uid TEXT,hash TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE p "Payment"%ROWTYPE; normalized TEXT;
BEGIN
 PERFORM 1 FROM "User" WHERE id=uid AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 SELECT * INTO p FROM "Payment" WHERE id=pid AND "userId"=uid AND provider='manual' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 IF p.status='CONFIRMING' THEN RETURN 'duplicate'; END IF;
 IF p.status NOT IN ('PENDING','EXPIRED') AND NOT (p.status='FAILED' AND p."providerStatus"='cancelled') THEN RETURN 'closed'; END IF;
 normalized := lower(regexp_replace(hash,'^0x','','i'));
 IF normalized IS NULL OR normalized !~ '^[0-9a-f]{64}$' THEN RETURN 'invalid_hash'; END IF;
 IF p.network<>'TRC20' THEN normalized := '0x'||normalized; END IF;
 UPDATE "Payment" SET status='CONFIRMING',"settlementStatus"='MANUAL_REVIEW',"providerStatus"='member_reported',
  "submittedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"submittedTxHash"=normalized,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=pid;
 INSERT INTO "PaymentEvent" (id,"paymentId","eventKey",source,payload,decision)
  VALUES (pid||':sent',pid,'sent','member',jsonb_build_object('userId',uid,'transactionHash',normalized),'awaiting admin approval');
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta) VALUES (pid||':sent',uid,'manual_deposit.reported_sent',pid,jsonb_build_object('transactionHash',normalized));
 RETURN 'submitted';
END $$;

CREATE FUNCTION wallet_cancel_manual_deposit(pid TEXT,uid TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "User" WHERE id=uid FOR UPDATE;
 PERFORM 1 FROM "Payment" WHERE id=pid AND "userId"=uid AND provider='manual' AND status='PENDING' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unavailable'; END IF;
 UPDATE "Payment" SET status='FAILED',"providerStatus"='cancelled',"settlementStatus"='CANCELLED',"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=pid;
 INSERT INTO "PaymentEvent" (id,"paymentId","eventKey",source,payload,decision)
  VALUES (pid||':cancelled',pid,'cancelled','member',jsonb_build_object('userId',uid),'cancelled before reporting transfer');
 RETURN 'cancelled';
END $$;

CREATE FUNCTION wallet_review_manual_deposit(pid TEXT,actor TEXT,approve BOOLEAN,hash TEXT,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE p "Payment"%ROWTYPE; uid TEXT; normalized TEXT; verified_amount NUMERIC;
BEGIN
 SELECT "userId" INTO uid FROM "Payment" WHERE id=pid;
 -- Consistent user ordering also makes competing reviews by different admins safe.
 PERFORM 1 FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
 SELECT * INTO p FROM "Payment" WHERE id=pid AND provider='manual' AND purpose='WALLET_TOPUP' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 IF p.status='CONFIRMED' THEN RETURN 'already_approved'; END IF;
 IF p.status<>'CONFIRMING' OR p."submittedAt" IS NULL THEN RETURN 'not_pending'; END IF;
 IF note IS NULL OR length(trim(note))<5 OR length(note)>1000 THEN RETURN 'invalid_note'; END IF;
 IF approve IS NULL THEN RETURN 'invalid'; END IF;
 IF approve THEN
  normalized := lower(regexp_replace(hash,'^0x','','i'));
  IF normalized IS NULL OR normalized !~ '^[0-9a-f]{64}$' THEN RETURN 'invalid_hash'; END IF;
  IF p.network<>'TRC20' THEN normalized := '0x'||normalized; END IF;
  verified_amount := p."amountCents"::numeric/100;
  UPDATE "Payment" SET status='CONFIRMED',"settlementStatus"='SETTLED',"providerStatus"='admin_approved',
   "payinHash"=normalized,"receivedAmount"=verified_amount,"outcomeAmount"=verified_amount,
   "outcomeCurrency"=p.currency,"confirmedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
   "reviewedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"reviewedById"=actor,"manualReviewNote"=trim(note),
   "reviewReason"=NULL,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=pid;
  INSERT INTO "WalletJournal" (id,"userId","paymentId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents")
   VALUES ('credit:'||pid,uid,pid,'credit:'||pid,'MANUAL_TOPUP','Crypto deposit approved',p."amountCents",-p."amountCents",0);
 ELSE
  UPDATE "Payment" SET status='FAILED',"settlementStatus"='REJECTED',"providerStatus"='admin_rejected',
   "reviewedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"reviewedById"=actor,"manualReviewNote"=trim(note),
   "reviewReason"=trim(note),"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=pid;
 END IF;
 INSERT INTO "PaymentEvent" (id,"paymentId","eventKey",source,payload,decision)
  VALUES (pid||':reviewed',pid,'reviewed','admin-manual-review',jsonb_build_object('adminId',actor,'approved',approve,'verifiedTransactionHash',normalized,
   'amountCents',p."amountCents",'currency',p.currency,'network',p.network,'address',p."poolAddress",'note',trim(note)),CASE WHEN approve THEN 'approved' ELSE 'rejected' END);
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta)
  VALUES (pid||':reviewed',actor,CASE WHEN approve THEN 'manual_deposit.approved' ELSE 'manual_deposit.rejected' END,pid,
   jsonb_build_object('userId',uid,'amountCents',p."amountCents",'currency',p.currency,'network',p.network,'transactionHash',normalized,'note',trim(note)));
 RETURN CASE WHEN approve THEN 'approved' ELSE 'rejected' END;
END $$;
