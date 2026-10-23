-- Paid subscriptions are coming soon. Existing records and payment reconciliation remain intact.
-- New trading requests use v2 terms without a paid-membership prerequisite.
CREATE OR REPLACE FUNCTION wallet_buy_plan(uid TEXT,plan_id TEXT,expected_price INTEGER,request_key TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
 RETURN 'sales_paused';
END $$;

-- Reject new subscription invoices from stale application instances too.
CREATE FUNCTION subscription_sales_paused() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.purpose='SUBSCRIPTION' THEN RAISE EXCEPTION 'Subscription sales are paused'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER subscription_sales_paused BEFORE INSERT ON "Payment"
FOR EACH ROW EXECUTE FUNCTION subscription_sales_paused();

CREATE OR REPLACE FUNCTION trading_request(uid TEXT,aid TEXT,request_key TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT,terms TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE; old "TradingAllocation"%ROWTYPE; outstanding BIGINT;
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
 IF cents IS NULL OR cents<50000 OR cents>1000000 OR terms IS DISTINCT FROM 'manual-v2-2026-10-23' OR request_key IS NULL OR length(request_key)>100 THEN RETURN 'invalid'; END IF;
 IF (coin||':'||chain) NOT IN ('USDT:TRC20','USDT:ERC20','USDC:ERC20') OR coin IS NULL OR chain IS NULL OR address IS NULL OR
  (chain='TRC20' AND address !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$') OR (chain='ERC20' AND (address !~ '^0x[0-9a-fA-F]{40}$' OR address ~ '^0x0{40}$')) THEN RETURN 'invalid_address'; END IF;
 IF EXISTS (SELECT 1 FROM "TradingAllocation" WHERE "userId"=uid AND status='PENDING') THEN RETURN 'pending_exists'; END IF;
 SELECT COALESCE(sum("principalCents"),0) INTO outstanding FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('ACTIVE','PAYOUT_READY');
 IF outstanding+cents>1000000 THEN RETURN 'limit'; END IF;
 IF u."balanceCents"<cents THEN RETURN 'insufficient'; END IF;
 INSERT INTO "TradingAllocation" (id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","termsSnapshot")
 VALUES (aid,uid,request_key,cents,coin,chain,address,terms,jsonb_build_object('version',terms,'lockDays',33,'lockBegins','admin approval','membershipRequired',false,'subscriptionSales','coming soon','targetsNonContractual',true,'targetIsProvisional',true,'guaranteed',false,'lossPossible',true,'compounding','none in this app; no daily accrual','payout','manual external crypto transfer after maturity and actual-result review','fees','operator pays outgoing network fees','valuation','one stablecoin token per USD of accounting credit; no market conversion'));
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
 IF approve AND a."termsVersion" NOT IN ('manual-v1-2026-10-22','manual-v2-2026-10-23') THEN RETURN 'terms_changed'; END IF;
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
