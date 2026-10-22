-- Member email policy is separate from real proof of email ownership.
-- Defaults remain strict until the deployment explicitly applies the owner's setting.
CREATE TABLE "AuthPolicy" (
 id TEXT PRIMARY KEY CHECK (id='members'),
 "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT true,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "AuthPolicy" (id) VALUES ('members');

CREATE FUNCTION auth_email_verification_required() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT "emailVerificationRequired" FROM "AuthPolicy" WHERE id='members'),true)
$$;

CREATE OR REPLACE FUNCTION wallet_buy_plan(uid TEXT, plan_id TEXT, expected_price INTEGER, request_key TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE; p "Plan"%ROWTYPE; op TEXT;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status <> 'ACTIVE' OR (u."emailVerifiedAt" IS NULL AND auth_email_verification_required()) THEN RETURN 'unverified'; END IF;
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

CREATE OR REPLACE FUNCTION wallet_create_manual_deposit(uid TEXT,pid TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR (u."emailVerifiedAt" IS NULL AND auth_email_verification_required()) THEN RETURN 'unverified'; END IF;
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

CREATE OR REPLACE FUNCTION trading_request(uid TEXT,aid TEXT,request_key TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT,terms TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE; old "TradingAllocation"%ROWTYPE; outstanding BIGINT; membership RECORD;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR (u."emailVerifiedAt" IS NULL AND auth_email_verification_required()) THEN RETURN 'unverified'; END IF;
 SELECT * INTO old FROM "TradingAllocation" WHERE "requestKey"=request_key;
 IF FOUND THEN
  IF old."userId"=uid AND old."principalCents"=cents AND old.currency=coin AND old.network=chain AND old."payoutAddress"=address AND old."termsVersion"=terms THEN RETURN 'duplicate'; END IF;
  RETURN 'request_conflict';
 END IF;
 PERFORM 1 FROM "TradingProgram" WHERE id='harry' AND "enrollmentEnabled" FOR SHARE;
 IF NOT FOUND THEN RETURN 'closed'; END IF;
 IF u."walletFrozen" THEN RETURN 'frozen'; END IF;
 IF cents IS NULL OR cents<50000 OR cents>1000000 OR terms IS DISTINCT FROM 'manual-v1-2026-10-22' OR request_key IS NULL OR length(request_key)>100 THEN RETURN 'invalid'; END IF;
 IF (coin||':'||chain) NOT IN ('USDT:TRC20','USDT:ERC20','USDC:ERC20') OR coin IS NULL OR chain IS NULL OR address IS NULL OR
  (chain='TRC20' AND address !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$') OR (chain='ERC20' AND (address !~ '^0x[0-9a-fA-F]{40}$' OR address ~ '^0x0{40}$')) THEN RETURN 'invalid_address'; END IF;
 IF EXISTS (SELECT 1 FROM "TradingAllocation" WHERE "userId"=uid AND status='PENDING') THEN RETURN 'pending_exists'; END IF;
 SELECT COALESCE(sum("principalCents"),0) INTO outstanding FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('ACTIVE','PAYOUT_READY');
 IF outstanding+cents>1000000 THEN RETURN 'limit'; END IF;
 IF u."balanceCents"<cents THEN RETURN 'insufficient'; END IF;
 SELECT s."planId",p.name,p.slug INTO membership FROM "Subscription" s JOIN "Plan" p ON p.id=s."planId"
 WHERE s."userId"=uid AND s.status='ACTIVE' AND s."endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND p.slug IN ('form','inner-circle') AND p."priceCents">0 ORDER BY p.tier DESC,s."endsAt" DESC LIMIT 1;
 IF NOT FOUND THEN RETURN 'membership_required'; END IF;
 INSERT INTO "TradingAllocation" (id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot")
 VALUES (aid,uid,request_key,cents,coin,chain,address,terms,jsonb_build_object('version',terms,'lockDays',33,'lockBegins','admin approval','membershipPlanId',membership."planId",'membershipPlan',membership.name,'membershipSlug',membership.slug,'targetsNonContractual',true,'targetIsProvisional',true,'guaranteed',false,'lossPossible',true,'compounding','none in this app; no daily accrual','payout','manual external crypto transfer after maturity and actual-result review','fees','operator pays outgoing network fees','valuation','one stablecoin token per USD of accounting credit; no market conversion'));
 PERFORM trading_event(aid,uid,'requested',jsonb_build_object('principalCents',cents,'currency',coin,'network',chain,'payoutAddress',address,'termsVersion',terms));
 RETURN 'requested';
END $$;

CREATE OR REPLACE FUNCTION trading_review(aid TEXT,actor TEXT,approve BOOLEAN,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "TradingAllocation"%ROWTYPE; u "User"%ROWTYPE; uid TEXT; stamp TIMESTAMP(3); outstanding BIGINT;
BEGIN
 SELECT "userId" INTO uid FROM "TradingAllocation" WHERE id=aid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM id FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='SUPER_ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
 SELECT * INTO a FROM "TradingAllocation" WHERE id=aid FOR UPDATE;
 IF a.status<>'PENDING' THEN RETURN 'not_pending'; END IF;
 IF approve AND a."termsVersion"<>'manual-v1-2026-10-22' THEN RETURN 'terms_changed'; END IF;
 IF approve AND NOT EXISTS(SELECT 1 FROM "Subscription" s JOIN "Plan" p ON p.id=s."planId" WHERE s."userId"=uid AND s.status='ACTIVE' AND s."endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND p.slug IN ('form','inner-circle') AND p."priceCents">0) THEN RETURN 'membership_required'; END IF;
 IF approve IS NULL OR note IS NULL OR length(trim(note))<5 OR length(note)>1000 THEN RETURN 'invalid_note'; END IF;
 stamp := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
 IF approve THEN
  PERFORM 1 FROM "TradingProgram" WHERE id='harry' AND "enrollmentEnabled" FOR SHARE;
  IF NOT FOUND THEN RETURN 'closed'; END IF;
  SELECT * INTO u FROM "User" WHERE id=uid;
  IF u.status<>'ACTIVE' OR (u."emailVerifiedAt" IS NULL AND auth_email_verification_required()) OR u."walletFrozen" THEN RETURN 'unavailable'; END IF;
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
