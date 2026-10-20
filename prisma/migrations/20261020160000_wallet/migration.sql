ALTER TABLE "User" ADD COLUMN "walletFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD CONSTRAINT "wallet_nonnegative" CHECK ("balanceCents" >= 0);
ALTER TABLE "Payment" ALTER COLUMN "planId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
 ADD COLUMN "planName" TEXT, ADD COLUMN "planDays" INTEGER,
 ADD COLUMN "poolAddress" TEXT,
 ADD COLUMN "settlementStatus" TEXT NOT NULL DEFAULT 'LEGACY',
 ADD COLUMN "receivedAmount" DECIMAL(36,18), ADD COLUMN "outcomeAmount" DECIMAL(36,18),
 ADD COLUMN "outcomeCurrency" TEXT, ADD COLUMN "payinHash" TEXT, ADD COLUMN "payoutHash" TEXT,
 ADD COLUMN "providerStatus" TEXT, ADD COLUMN "providerUpdatedAt" TIMESTAMP(3),
 ADD COLUMN "lastCheckedAt" TIMESTAMP(3), ADD COLUMN "reviewReason" TEXT;
UPDATE "Payment" p SET "planName" = x.name, "planDays" = x."intervalDays" FROM "Plan" x WHERE x.id = p."planId";
ALTER TABLE "Payment" ADD CONSTRAINT "payment_purpose" CHECK (
 (purpose = 'SUBSCRIPTION' AND "planId" IS NOT NULL AND "planDays" > 0) OR
 (purpose = 'WALLET_TOPUP' AND "planId" IS NULL));

CREATE TABLE "WalletJournal" (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "paymentId" TEXT REFERENCES "Payment"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "planId" TEXT REFERENCES "Plan"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "operationKey" TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, description TEXT NOT NULL,
 currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
 "userDeltaCents" INTEGER NOT NULL, "clearingDeltaCents" INTEGER NOT NULL, "revenueDeltaCents" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 CONSTRAINT balanced_posting CHECK ("userDeltaCents"::bigint + "clearingDeltaCents"::bigint + "revenueDeltaCents"::bigint = 0)
);
CREATE INDEX "WalletJournal_userId_createdAt_idx" ON "WalletJournal"("userId", "createdAt");
CREATE TABLE "PaymentEvent" (
 id TEXT PRIMARY KEY, "paymentId" TEXT NOT NULL REFERENCES "Payment"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "eventKey" TEXT NOT NULL, source TEXT NOT NULL, payload JSONB NOT NULL, decision TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 UNIQUE ("paymentId", "eventKey")
);
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON "PaymentEvent"("paymentId", "createdAt");

-- Preserve pre-existing displayed balances explicitly; do not invent historical on-chain receipts.
INSERT INTO "WalletJournal" (id,"userId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents")
 SELECT 'opening:' || id,id,'opening:' || id,'OPENING','Balance carried forward before wallet ledger',"balanceCents",-"balanceCents",0
 FROM "User" WHERE "balanceCents" <> 0;

CREATE FUNCTION wallet_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Financial records are append-only'; END $$;
CREATE TRIGGER journal_immutable BEFORE UPDATE OR DELETE ON "WalletJournal" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE ON "PaymentEvent" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();

CREATE FUNCTION wallet_post_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "User" SET "balanceCents" = "balanceCents" + NEW."userDeltaCents", "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id = NEW."userId";
 RETURN NEW;
END $$;
CREATE TRIGGER journal_balance AFTER INSERT ON "WalletJournal" FOR EACH ROW EXECUTE FUNCTION wallet_post_balance();
CREATE FUNCTION wallet_guard_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."balanceCents" <> OLD."balanceCents" AND pg_trigger_depth() < 2 THEN
  RAISE EXCEPTION 'Balance changes require a balanced journal posting';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER user_balance_guard BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION wallet_guard_balance();

-- Caller holds the user's row lock. Shared by crypto checkout and balance checkout.
CREATE FUNCTION wallet_grant_plan(u TEXT, p TEXT, days INTEGER, src TEXT, sid TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE existing_id TEXT;
BEGIN
 SELECT id INTO existing_id FROM "Subscription" WHERE "userId"=u AND "planId"=p AND status='ACTIVE' AND "endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ORDER BY "endsAt" DESC LIMIT 1 FOR UPDATE;
 IF existing_id IS NULL THEN
  INSERT INTO "Subscription" (id,"userId","planId",status,"startsAt","endsAt",source,"createdAt")
   VALUES (sid,u,p,'ACTIVE',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + make_interval(days=>days),src,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
 ELSE
  UPDATE "Subscription" SET "endsAt"="endsAt" + make_interval(days=>days),"reminderSentAt"=NULL WHERE id=existing_id;
 END IF;
END $$;

-- One PostgreSQL statement is atomic on both normal Postgres and Neon's stateless HTTP driver.
-- All operations lock User before Payment, so spending cannot race a credit or refund freeze.
CREATE FUNCTION wallet_apply_payment(pid TEXT, event_key TEXT, src TEXT, e JSONB) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE p "Payment"%ROWTYPE; uid TEXT; decision TEXT; new_status "PaymentStatus"; stamp TIMESTAMP(3);
BEGIN
 SELECT "userId" INTO uid FROM "Payment" WHERE id=pid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM 1 FROM "User" WHERE id=uid FOR UPDATE;
 SELECT * INTO p FROM "Payment" WHERE id=pid FOR UPDATE;
 UPDATE "Payment" SET "lastCheckedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=pid;
 IF EXISTS (SELECT 1 FROM "PaymentEvent" WHERE "paymentId"=pid AND "eventKey"=event_key) THEN RETURN 'duplicate'; END IF;
 stamp := (e->>'updatedAt')::timestamp;
 decision := CASE
  WHEN stamp IS NOT NULL AND p."providerUpdatedAt" IS NOT NULL AND stamp < p."providerUpdatedAt" THEN 'stale'
  WHEN e->>'validationError' IS NOT NULL THEN 'review: ' || (e->>'validationError')
  ELSE 'accepted' END;
 INSERT INTO "PaymentEvent" (id,"paymentId","eventKey",source,payload,decision)
  VALUES (pid || ':' || event_key,pid,event_key,src,e,decision);
 IF decision='stale' THEN RETURN decision; END IF;
 IF decision <> 'accepted' THEN
  UPDATE "Payment" SET "reviewReason"=decision,"settlementStatus"='REVIEW' WHERE id=pid;
  IF p.status='CONFIRMED' THEN UPDATE "User" SET "walletFrozen"=true WHERE id=uid; END IF;
  RETURN decision;
 END IF;
 -- Once credited, never regress or repeat fulfillment. Reversals freeze spending for reconciliation.
 IF p.status='CONFIRMED' THEN
  IF e->>'providerStatus' IN ('refunded','failed','partially_paid') THEN
   UPDATE "User" SET "walletFrozen"=true WHERE id=uid;
   UPDATE "Payment" SET "reviewReason"='Reversal after fulfillment',"settlementStatus"='REVIEW' WHERE id=pid;
  END IF;
  RETURN 'already fulfilled';
 END IF;
 new_status := (e->>'status')::"PaymentStatus";
 -- Missing timestamps cannot roll confirming/partial receipts back to waiting.
 IF new_status='PENDING' AND p.status IN ('CONFIRMING','PARTIAL','FAILED','EXPIRED') THEN RETURN 'ignored regression'; END IF;
 UPDATE "Payment" SET status=new_status,"providerStatus"=e->>'providerStatus',
  "providerUpdatedAt"=COALESCE(stamp,"providerUpdatedAt"),
  "receivedAmount"=GREATEST("receivedAmount",(e->>'receivedAmount')::numeric),
  "outcomeAmount"=COALESCE((e->>'outcomeAmount')::numeric,"outcomeAmount"),
  "outcomeCurrency"=COALESCE(e->>'outcomeCurrency',"outcomeCurrency"),
  "payinHash"=COALESCE(e->>'payinHash',"payinHash"),"payoutHash"=COALESCE(e->>'payoutHash',"payoutHash"),
  "settlementStatus"=CASE WHEN new_status='CONFIRMED' THEN 'SETTLED'
   WHEN e->>'providerStatus' IN ('confirmed','sending') THEN 'TRANSFERRING'
   WHEN new_status='PARTIAL' THEN 'REVIEW' ELSE 'PENDING' END,
  "reviewReason"=CASE WHEN new_status='PARTIAL' THEN 'Underpayment: review or finish payment with provider support' ELSE NULL END,
  "confirmedAt"=CASE WHEN new_status='CONFIRMED' THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE NULL END,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  WHERE id=pid;
 IF new_status <> 'CONFIRMED' THEN RETURN 'recorded'; END IF;
 IF p.purpose='WALLET_TOPUP' THEN
  INSERT INTO "WalletJournal" (id,"userId","paymentId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents")
   VALUES ('credit:'||pid,uid,pid,'credit:'||pid,'TOPUP','Wallet top-up',p."amountCents",-p."amountCents",0);
 ELSE
  INSERT INTO "WalletJournal" (id,"userId","paymentId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents")
   VALUES ('sale:'||pid,uid,pid,'sale:'||pid,'CRYPTO_PURCHASE',p."planName",0,-p."amountCents",p."amountCents");
  PERFORM wallet_grant_plan(uid,p."planId",p."planDays",'payment','sub:'||pid);
 END IF;
 INSERT INTO "AuditLog" (id,action,target,meta,"createdAt") VALUES ('wallet:'||pid,'payment.fulfilled',pid,jsonb_build_object('purpose',p.purpose,'amountCents',p."amountCents"),(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
 RETURN 'fulfilled';
END $$;

CREATE FUNCTION wallet_grant_subscription(uid TEXT, plan_id TEXT, days INTEGER, src TEXT, sid TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "User" WHERE id=uid FOR UPDATE;
 PERFORM wallet_grant_plan(uid,plan_id,days,src,sid);
 RETURN 'granted';
END $$;

CREATE FUNCTION wallet_buy_plan(uid TEXT, plan_id TEXT, expected_price INTEGER, request_key TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE; p "Plan"%ROWTYPE; op TEXT;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status <> 'ACTIVE' OR u."emailVerifiedAt" IS NULL THEN RETURN 'unverified'; END IF;
 op := 'purchase:' || uid || ':' || request_key;
 IF EXISTS (SELECT 1 FROM "WalletJournal" WHERE "operationKey"=op) THEN
  IF EXISTS (SELECT 1 FROM "WalletJournal" WHERE "operationKey"=op AND "planId"=plan_id AND "userDeltaCents"=-expected_price) THEN RETURN 'duplicate'; END IF;
  RETURN 'request_conflict';
 END IF;
 IF u."walletFrozen" THEN RETURN 'frozen'; END IF;
 SELECT * INTO p FROM "Plan" WHERE id=plan_id FOR SHARE;
 IF p.id IS NULL OR NOT p.active OR p."priceCents"<=0 OR p."priceCents"<>expected_price THEN RETURN 'price_changed'; END IF;
 IF u."balanceCents"<p."priceCents" THEN RETURN 'insufficient'; END IF;
 INSERT INTO "WalletJournal" (id,"userId","planId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents")
  VALUES (op,uid,p.id,op,'PURCHASE',p.name,-p."priceCents",0,p."priceCents");
 PERFORM wallet_grant_plan(uid,p.id,p."intervalDays",'wallet','sub:'||op);
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta,"createdAt")
  VALUES (op,uid,'wallet.purchase',p.id,jsonb_build_object('amountCents',p."priceCents"),(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
 RETURN 'purchased';
END $$;
