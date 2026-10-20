-- Enrollment stays closed in production while commercial terms are a draft.
CREATE TABLE "TradingProgram" (id TEXT PRIMARY KEY, "enrollmentEnabled" BOOLEAN NOT NULL DEFAULT false);
INSERT INTO "TradingProgram" (id) VALUES ('harry');
CREATE TABLE "TradingAllocation" (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "requestKey" TEXT NOT NULL UNIQUE, "principalCents" INTEGER NOT NULL CHECK ("principalCents" BETWEEN 50000 AND 1000000),
 currency TEXT NOT NULL, network TEXT NOT NULL, "payoutAddress" TEXT NOT NULL,
 "termsVersion" TEXT NOT NULL, "termsSnapshot" JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','PAYOUT_READY','PAID','REJECTED','CANCELLED')),
 "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 "approvedAt" TIMESTAMP(3), "approvedById" TEXT, "unlocksAt" TIMESTAMP(3),
 "reviewedAt" TIMESTAMP(3), "reviewedById" TEXT, "reviewNote" TEXT,
 "profitCents" INTEGER, "payoutCents" INTEGER, "resultAt" TIMESTAMP(3), "resultById" TEXT, "resultNote" TEXT,
 "paidAt" TIMESTAMP(3), "paidById" TEXT, "payoutTxHash" TEXT, "payoutNote" TEXT,
 CONSTRAINT trading_network CHECK ((currency||':'||network) IN ('USDT:TRC20','USDT:ERC20','USDC:ERC20')),
 CONSTRAINT trading_address CHECK ((network='TRC20' AND "payoutAddress" ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$') OR
   (network='ERC20' AND "payoutAddress" ~ '^0x[0-9a-fA-F]{40}$' AND "payoutAddress" !~ '^0x0{40}$')),
 CONSTRAINT trading_lock CHECK ("approvedAt" IS NULL OR ("unlocksAt" IS NOT NULL AND "unlocksAt"="approvedAt"+interval '33 days' AND "approvedById" IS NOT NULL)),
 CONSTRAINT trading_result CHECK ("profitCents" IS NULL OR ("payoutCents" IS NOT NULL AND "payoutCents"::bigint="principalCents"::bigint+"profitCents"::bigint AND "payoutCents">=0 AND "resultAt">="unlocksAt" AND "resultById" IS NOT NULL AND length("resultNote")>=5)),
 CONSTRAINT trading_state CHECK (
  (status='PENDING' AND "approvedAt" IS NULL AND "reviewedAt" IS NULL AND "profitCents" IS NULL AND "paidAt" IS NULL) OR
  (status IN ('REJECTED','CANCELLED') AND "approvedAt" IS NULL AND "reviewedAt" IS NOT NULL AND "profitCents" IS NULL AND "paidAt" IS NULL) OR
  (status='ACTIVE' AND "approvedAt" IS NOT NULL AND "profitCents" IS NULL AND "paidAt" IS NULL) OR
  (status='PAYOUT_READY' AND "approvedAt" IS NOT NULL AND "profitCents" IS NOT NULL AND "paidAt" IS NULL) OR
  (status='PAID' AND "approvedAt" IS NOT NULL AND "profitCents" IS NOT NULL AND "paidAt">="resultAt" AND "paidById" IS NOT NULL AND length("payoutNote")>=5 AND ("payoutCents"=0 OR "payoutTxHash" ~ '^(0x)?[0-9a-f]{64}$')))
);
CREATE INDEX "TradingAllocation_userId_requestedAt_idx" ON "TradingAllocation"("userId","requestedAt");
CREATE INDEX "TradingAllocation_status_unlocksAt_idx" ON "TradingAllocation"(status,"unlocksAt");
CREATE TABLE "TradingEvent" (
 id TEXT PRIMARY KEY, "allocationId" TEXT NOT NULL REFERENCES "TradingAllocation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "actorId" TEXT NOT NULL, action TEXT NOT NULL, payload JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE INDEX "TradingEvent_allocationId_createdAt_idx" ON "TradingEvent"("allocationId","createdAt");
CREATE TRIGGER trading_event_immutable BEFORE UPDATE OR DELETE ON "TradingEvent" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
CREATE TRIGGER trading_allocation_no_delete BEFORE DELETE ON "TradingAllocation" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
CREATE FUNCTION trading_guard_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW."userId",NEW."requestKey",NEW."principalCents",NEW.currency,NEW.network,NEW."payoutAddress",NEW."termsVersion",NEW."termsSnapshot",NEW."requestedAt")
  IS DISTINCT FROM ROW(OLD.id,OLD."userId",OLD."requestKey",OLD."principalCents",OLD.currency,OLD.network,OLD."payoutAddress",OLD."termsVersion",OLD."termsSnapshot",OLD."requestedAt") THEN RAISE EXCEPTION 'Trading terms and destination are immutable'; END IF;
 IF OLD.status<>NEW.status AND NOT ((OLD.status='PENDING' AND NEW.status IN ('ACTIVE','REJECTED','CANCELLED')) OR (OLD.status='ACTIVE' AND NEW.status='PAYOUT_READY') OR (OLD.status='PAYOUT_READY' AND NEW.status='PAID')) THEN RAISE EXCEPTION 'Invalid trading transition'; END IF;
 IF OLD."approvedAt" IS NOT NULL AND ROW(NEW."approvedAt",NEW."approvedById",NEW."unlocksAt") IS DISTINCT FROM ROW(OLD."approvedAt",OLD."approvedById",OLD."unlocksAt") THEN RAISE EXCEPTION 'Lock history is immutable'; END IF;
 IF OLD."reviewedAt" IS NOT NULL AND ROW(NEW."reviewedAt",NEW."reviewedById",NEW."reviewNote") IS DISTINCT FROM ROW(OLD."reviewedAt",OLD."reviewedById",OLD."reviewNote") THEN RAISE EXCEPTION 'Review history is immutable'; END IF;
 IF OLD."resultAt" IS NOT NULL AND ROW(NEW."profitCents",NEW."payoutCents",NEW."resultAt",NEW."resultById",NEW."resultNote") IS DISTINCT FROM ROW(OLD."profitCents",OLD."payoutCents",OLD."resultAt",OLD."resultById",OLD."resultNote") THEN RAISE EXCEPTION 'Result history is immutable'; END IF;
 IF OLD."paidAt" IS NOT NULL THEN RAISE EXCEPTION 'Completed payouts are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trading_history_guard BEFORE UPDATE ON "TradingAllocation" FOR EACH ROW EXECUTE FUNCTION trading_guard_history();

-- Available club credit, locked trading principal, clearing, membership sales and
-- actual trading results are separate accounts. Old postings retain zero new legs.
ALTER TABLE "WalletJournal" ADD COLUMN "lockedDeltaCents" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "tradingResultDeltaCents" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "allocationId" TEXT REFERENCES "TradingAllocation"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletJournal" DROP CONSTRAINT balanced_posting;
ALTER TABLE "WalletJournal" ADD CONSTRAINT balanced_posting CHECK (
 "userDeltaCents"::bigint+"clearingDeltaCents"::bigint+"revenueDeltaCents"::bigint+"lockedDeltaCents"::bigint+"tradingResultDeltaCents"::bigint=0);

CREATE TABLE "TradingPayoutClaim" (
 key TEXT PRIMARY KEY, "allocationId" TEXT NOT NULL UNIQUE REFERENCES "TradingAllocation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 network TEXT NOT NULL, "txHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE TRIGGER trading_payout_claim_immutable BEFORE UPDATE OR DELETE ON "TradingPayoutClaim" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
-- One unique registry serializes incoming/outgoing hash claims, even across users
-- and simultaneous Neon HTTP sessions. Never use a trading payout as a deposit.
CREATE TABLE "ChainTransferClaim" (
 key TEXT PRIMARY KEY, "paymentId" TEXT REFERENCES "Payment"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "allocationId" TEXT REFERENCES "TradingAllocation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CHECK (("paymentId" IS NOT NULL)::integer+("allocationId" IS NOT NULL)::integer=1)
);
INSERT INTO "ChainTransferClaim" (key,"paymentId") SELECT key,"paymentId" FROM "ReceiptClaim";
CREATE TRIGGER chain_transfer_claim_immutable BEFORE UPDATE OR DELETE ON "ChainTransferClaim" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
CREATE FUNCTION trading_claim_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_payment TEXT; owner_allocation TEXT;
BEGIN
 IF TG_TABLE_NAME='ReceiptClaim' THEN
  INSERT INTO "ChainTransferClaim" (key,"paymentId") VALUES (NEW.key,NEW."paymentId") ON CONFLICT DO NOTHING;
  SELECT "paymentId" INTO owner_payment FROM "ChainTransferClaim" WHERE key=NEW.key;
  IF owner_payment IS DISTINCT FROM NEW."paymentId" THEN RAISE EXCEPTION 'receipt_already_used'; END IF;
 ELSE
  INSERT INTO "ChainTransferClaim" (key,"allocationId") VALUES (NEW.key,NEW."allocationId") ON CONFLICT DO NOTHING;
  SELECT "allocationId" INTO owner_allocation FROM "ChainTransferClaim" WHERE key=NEW.key;
  IF owner_allocation IS DISTINCT FROM NEW."allocationId" THEN RAISE EXCEPTION 'receipt_already_used'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_global_claim BEFORE INSERT ON "ReceiptClaim" FOR EACH ROW EXECUTE FUNCTION trading_claim_transfer();
CREATE TRIGGER payout_global_claim BEFORE INSERT ON "TradingPayoutClaim" FOR EACH ROW EXECUTE FUNCTION trading_claim_transfer();

CREATE FUNCTION trading_event(aid TEXT,actor TEXT,verb TEXT,data JSONB) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "TradingEvent" (id,"allocationId","actorId",action,payload) VALUES (aid||':'||verb,aid,actor,verb,data);
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta) VALUES (aid||':'||verb,actor,'trading.'||verb,aid,data);
END $$;

CREATE FUNCTION trading_request(uid TEXT,aid TEXT,request_key TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT,terms TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE; old "TradingAllocation"%ROWTYPE; outstanding BIGINT;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR u."emailVerifiedAt" IS NULL THEN RETURN 'unverified'; END IF;
 SELECT * INTO old FROM "TradingAllocation" WHERE "requestKey"=request_key;
 IF FOUND THEN
  IF old."userId"=uid AND old."principalCents"=cents AND old.currency=coin AND old.network=chain AND old."payoutAddress"=address AND old."termsVersion"=terms THEN RETURN 'duplicate'; END IF;
  RETURN 'request_conflict';
 END IF;
 PERFORM 1 FROM "TradingProgram" WHERE id='harry' AND "enrollmentEnabled" FOR SHARE;
 IF NOT FOUND THEN RETURN 'closed'; END IF;
 IF u."walletFrozen" THEN RETURN 'frozen'; END IF;
 IF cents IS NULL OR cents<50000 OR cents>1000000 OR terms IS DISTINCT FROM 'draft-v1' OR request_key IS NULL OR length(request_key)>100 THEN RETURN 'invalid'; END IF;
 IF (coin||':'||chain) NOT IN ('USDT:TRC20','USDT:ERC20','USDC:ERC20') OR coin IS NULL OR chain IS NULL OR address IS NULL OR
  (chain='TRC20' AND address !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$') OR (chain='ERC20' AND (address !~ '^0x[0-9a-fA-F]{40}$' OR address ~ '^0x0{40}$')) THEN RETURN 'invalid_address'; END IF;
 IF EXISTS (SELECT 1 FROM "TradingAllocation" WHERE "userId"=uid AND status='PENDING') THEN RETURN 'pending_exists'; END IF;
 SELECT COALESCE(sum("principalCents"),0) INTO outstanding FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('ACTIVE','PAYOUT_READY');
 IF outstanding+cents>1000000 THEN RETURN 'limit'; END IF;
 IF u."balanceCents"<cents THEN RETURN 'insufficient'; END IF;
 INSERT INTO "TradingAllocation" (id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot")
 VALUES (aid,uid,request_key,cents,coin,chain,address,terms,jsonb_build_object('version',terms,'lockDays',33,'lockBegins','admin approval','targetDailyMinPercent',2,'targetDailyMaxPercent',3,'targetIsProvisional',true,'guaranteed',false,'lossPossible',true,'compounding','not defined; no accrual','payout','manual external crypto transfer after maturity and actual-result review','fees','operator pays outgoing network fees','valuation','one stablecoin token per USD of accounting credit; no market conversion'));
 PERFORM trading_event(aid,uid,'requested',jsonb_build_object('principalCents',cents,'currency',coin,'network',chain,'payoutAddress',address,'termsVersion',terms));
 RETURN 'requested';
END $$;

CREATE FUNCTION trading_cancel(aid TEXT,uid TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "User" WHERE id=uid FOR UPDATE;
 PERFORM 1 FROM "TradingAllocation" WHERE id=aid AND "userId"=uid AND status='PENDING' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'not_pending'; END IF;
 UPDATE "TradingAllocation" SET status='CANCELLED',"reviewedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"reviewedById"=uid,"reviewNote"='Cancelled by member before approval' WHERE id=aid;
 PERFORM trading_event(aid,uid,'cancelled','{}'); RETURN 'cancelled';
END $$;

CREATE FUNCTION trading_review(aid TEXT,actor TEXT,approve BOOLEAN,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "TradingAllocation"%ROWTYPE; u "User"%ROWTYPE; uid TEXT; stamp TIMESTAMP(3); outstanding BIGINT;
BEGIN
 SELECT "userId" INTO uid FROM "TradingAllocation" WHERE id=aid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM id FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
 SELECT * INTO a FROM "TradingAllocation" WHERE id=aid FOR UPDATE;
 IF a.status<>'PENDING' THEN RETURN 'not_pending'; END IF;
 IF approve IS NULL OR note IS NULL OR length(trim(note))<5 OR length(note)>1000 THEN RETURN 'invalid_note'; END IF;
 stamp := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
 IF approve THEN
  PERFORM 1 FROM "TradingProgram" WHERE id='harry' AND "enrollmentEnabled" FOR SHARE;
  IF NOT FOUND THEN RETURN 'closed'; END IF;
  SELECT * INTO u FROM "User" WHERE id=uid;
  IF u.status<>'ACTIVE' OR u."emailVerifiedAt" IS NULL OR u."walletFrozen" THEN RETURN 'unavailable'; END IF;
  IF u."balanceCents"<a."principalCents" THEN RETURN 'insufficient'; END IF;
  SELECT COALESCE(sum("principalCents"),0) INTO outstanding FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('ACTIVE','PAYOUT_READY');
  IF outstanding+a."principalCents">1000000 THEN RETURN 'limit'; END IF;
  UPDATE "TradingAllocation" SET status='ACTIVE',"approvedAt"=stamp,"approvedById"=actor,"unlocksAt"=stamp+interval '33 days',"reviewedAt"=stamp,"reviewedById"=actor,"reviewNote"=trim(note) WHERE id=aid;
  INSERT INTO "WalletJournal" (id,"userId","allocationId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents","lockedDeltaCents")
   VALUES ('trading:lock:'||aid,uid,aid,'trading:lock:'||aid,'TRADING_LOCK','Trading principal locked for 33 days',-a."principalCents",0,0,a."principalCents");
 ELSE
  UPDATE "TradingAllocation" SET status='REJECTED',"reviewedAt"=stamp,"reviewedById"=actor,"reviewNote"=trim(note) WHERE id=aid;
 END IF;
 PERFORM trading_event(aid,actor,CASE WHEN approve THEN 'approved' ELSE 'rejected' END,jsonb_build_object('note',trim(note),'principalCents',a."principalCents"));
 RETURN CASE WHEN approve THEN 'approved' ELSE 'rejected' END;
END $$;

CREATE FUNCTION trading_record_result(aid TEXT,actor TEXT,profit INTEGER,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "TradingAllocation"%ROWTYPE; uid TEXT; payout BIGINT;
BEGIN
 SELECT "userId" INTO uid FROM "TradingAllocation" WHERE id=aid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM id FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
 SELECT * INTO a FROM "TradingAllocation" WHERE id=aid FOR UPDATE;
 IF a.status<>'ACTIVE' THEN RETURN 'not_active'; END IF;
 IF (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')<a."unlocksAt" THEN RETURN 'locked'; END IF;
 IF EXISTS (SELECT 1 FROM "User" WHERE id=uid AND "walletFrozen") THEN RETURN 'frozen'; END IF;
 payout:=a."principalCents"::bigint+profit::bigint;
 IF profit IS NULL OR payout<0 OR payout>100000000 OR note IS NULL OR length(trim(note))<5 OR length(note)>1000 THEN RETURN 'invalid_result'; END IF;
 UPDATE "TradingAllocation" SET status='PAYOUT_READY',"profitCents"=profit,"payoutCents"=payout::integer,"resultAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"resultById"=actor,"resultNote"=trim(note) WHERE id=aid;
 PERFORM trading_event(aid,actor,'result_recorded',jsonb_build_object('profitCents',profit,'payoutCents',payout,'note',trim(note)));
 RETURN 'recorded';
END $$;

CREATE FUNCTION trading_record_payout(aid TEXT,actor TEXT,expected_cents INTEGER,hash TEXT,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "TradingAllocation"%ROWTYPE; uid TEXT; normalized TEXT;
BEGIN
 SELECT "userId" INTO uid FROM "TradingAllocation" WHERE id=aid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM id FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
 SELECT * INTO a FROM "TradingAllocation" WHERE id=aid FOR UPDATE;
 IF a.status='PAID' THEN RETURN 'already_paid'; END IF;
 IF a.status<>'PAYOUT_READY' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')<a."unlocksAt" THEN RETURN 'not_ready'; END IF;
 IF EXISTS (SELECT 1 FROM "User" WHERE id=uid AND "walletFrozen") THEN RETURN 'frozen'; END IF;
 IF expected_cents IS DISTINCT FROM a."payoutCents" OR note IS NULL OR length(trim(note))<5 OR length(note)>1000 THEN RETURN 'invalid_payout'; END IF;
 normalized:=lower(regexp_replace(COALESCE(hash,''),'^0x','','i'));
 IF a."payoutCents">0 THEN
  IF normalized !~ '^[0-9a-f]{64}$' THEN RETURN 'invalid_hash'; END IF;
  INSERT INTO "TradingPayoutClaim" (key,"allocationId",network,"txHash") VALUES (a.network||':'||normalized,aid,a.network,normalized);
  IF a.network<>'TRC20' THEN normalized:='0x'||normalized; END IF;
 ELSE
  IF normalized<>'' THEN RETURN 'invalid_hash'; END IF;
  normalized:=NULL;
 END IF;
 UPDATE "TradingAllocation" SET status='PAID',"paidAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"paidById"=actor,"payoutTxHash"=normalized,"payoutNote"=trim(note) WHERE id=aid;
 INSERT INTO "WalletJournal" (id,"userId","allocationId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents","lockedDeltaCents","tradingResultDeltaCents")
  VALUES ('trading:payout:'||aid,uid,aid,'trading:payout:'||aid,'TRADING_PAYOUT',CASE WHEN a."payoutCents"=0 THEN 'Trading closed with total principal loss' ELSE 'Manual external trading payout recorded' END,0,a."payoutCents",0,-a."principalCents",-a."profitCents");
 PERFORM trading_event(aid,actor,'paid',jsonb_build_object('payoutCents',a."payoutCents",'profitCents',a."profitCents",'transactionHash',normalized,'address',a."payoutAddress",'network',a.network,'currency',a.currency,'note',trim(note)));
 RETURN 'paid';
END $$;

-- A member cannot erase an open trading request or unpaid allocation by closing.
CREATE OR REPLACE FUNCTION wallet_close_account(uid TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' THEN RETURN 'inactive'; END IF;
 IF u."balanceCents"<>0 OR u."walletFrozen" OR EXISTS (SELECT 1 FROM "Payment" WHERE "userId"=uid AND purpose='WALLET_TOPUP' AND status IN ('PENDING','CONFIRMING','PARTIAL'))
  OR EXISTS (SELECT 1 FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('PENDING','ACTIVE','PAYOUT_READY')) THEN RETURN 'wallet_unresolved'; END IF;
 UPDATE "User" SET status='CLOSED',"closedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"marketingOptIn"=false,"sessionVersion"="sessionVersion"+1 WHERE id=uid;
 RETURN 'closed';
END $$;

-- Admin account-status changes must also preserve open trading obligations.
CREATE FUNCTION trading_guard_account_closure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='CLOSED' AND OLD.status<>'CLOSED' AND EXISTS (
  SELECT 1 FROM "TradingAllocation" WHERE "userId"=OLD.id AND status IN ('PENDING','ACTIVE','PAYOUT_READY')
 ) THEN RAISE EXCEPTION 'Resolve trading obligations before closing this account'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trading_account_closure BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION trading_guard_account_closure();

-- Raise manual deposit capacity to support a single $10,000 allocation.
CREATE OR REPLACE FUNCTION wallet_create_manual_deposit(uid TEXT,pid TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR u."emailVerifiedAt" IS NULL THEN RETURN 'unverified'; END IF;
 IF u."walletFrozen" THEN RETURN 'frozen'; END IF;
 IF cents<2000 OR cents>1000000 OR (coin||':'||chain) NOT IN ('USDT:TRC20','USDT:ERC20','USDC:ERC20','USDC:POLYGON')
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

