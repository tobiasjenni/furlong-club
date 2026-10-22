-- Admin is an observer. Only the existing Super Admin owner may change club records.
CREATE OR REPLACE FUNCTION admin_manage_user(actor TEXT, uid TEXT, operation TEXT, data JSONB, event_id TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "User"%ROWTYPE; u "User"%ROWTYPE; next_role "Role"; next_status "UserStatus"; changed BOOLEAN; sub_uid TEXT;
BEGIN
 PERFORM id FROM "User" WHERE id IN (actor,uid) ORDER BY id FOR UPDATE;
 SELECT * INTO a FROM "User" WHERE id=actor;
 SELECT * INTO u FROM "User" WHERE id=uid;
 IF a.id IS NULL OR u.id IS NULL OR a.status<>'ACTIVE' OR a.role<>'SUPER_ADMIN' OR actor=uid OR u.role='SUPER_ADMIN' THEN RETURN 'forbidden'; END IF;
 IF operation='role' THEN
   IF a.role<>'SUPER_ADMIN' OR data->>'passwordHash' IS DISTINCT FROM a."passwordHash" THEN RETURN 'forbidden'; END IF;
   IF data->>'role' IS NULL OR data->>'role' NOT IN ('USER','ADMIN') OR length(trim(COALESCE(data->>'reason','')))<10 THEN RETURN 'invalid'; END IF;
   next_role := (data->>'role')::"Role";
   IF next_role='ADMIN' AND (u.status<>'ACTIVE' OR u."emailVerifiedAt" IS NULL OR u."lastLoginAt" IS NULL) THEN RETURN 'not_ready'; END IF;
   IF next_role=u.role THEN RETURN 'unchanged'; END IF;
   UPDATE "User" SET role=next_role,"sessionVersion"="sessionVersion"+1,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=uid;
   DELETE FROM "AuthToken" WHERE "userId"=uid;
 ELSIF operation='account' THEN
   IF data->>'status' IS NULL OR data->>'status' NOT IN ('ACTIVE','SUSPENDED','CLOSED') THEN RETURN 'invalid'; END IF;
   next_status := (data->>'status')::"UserStatus";
   IF next_status='CLOSED' AND (u."balanceCents"<>0 OR u."walletFrozen" OR EXISTS(SELECT 1 FROM "Payment" WHERE "userId"=uid AND status IN ('PENDING','CONFIRMING','PARTIAL'))
     OR EXISTS(SELECT 1 FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('PENDING','ACTIVE','PAYOUT_READY'))) THEN RETURN 'wallet_unresolved'; END IF;
   changed := next_status<>u.status;
   UPDATE "User" SET status=next_status,tags=ARRAY(SELECT jsonb_array_elements_text(data->'tags')),
     "closedAt"=CASE WHEN next_status='CLOSED' THEN COALESCE("closedAt",(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) ELSE NULL END,
     "marketingOptIn"=CASE WHEN next_status='CLOSED' THEN false ELSE "marketingOptIn" END,
     "sessionVersion"="sessionVersion"+CASE WHEN changed THEN 1 ELSE 0 END,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=uid;
   IF changed THEN DELETE FROM "AuthToken" WHERE "userId"=uid; END IF;
 ELSIF operation='signout' THEN
   UPDATE "User" SET "sessionVersion"="sessionVersion"+1,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=uid;
   DELETE FROM "AuthToken" WHERE "userId"=uid;
 ELSIF operation='email' THEN
   IF a.role<>'SUPER_ADMIN' OR u.status<>'ACTIVE' OR length(trim(COALESCE(data->>'reason','')))<10 THEN RETURN 'forbidden'; END IF;
   UPDATE "User" SET "emailVerifiedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=uid;
 ELSIF operation='reset' THEN
   IF a.role<>'SUPER_ADMIN' OR u.status<>'ACTIVE' OR data->>'passwordHash' IS DISTINCT FROM a."passwordHash" THEN RETURN 'forbidden'; END IF;
   DELETE FROM "AuthToken" WHERE "userId"=uid AND type='RESET_PASSWORD';
   INSERT INTO "AuthToken" (id,"userId",type,"tokenHash","expiresAt","sessionVersion")
     VALUES (event_id,uid,'RESET_PASSWORD',data->>'tokenHash',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '1 hour',u."sessionVersion");
 ELSIF operation='grant' THEN
   IF u.status<>'ACTIVE' OR (data->>'days')::integer NOT BETWEEN 1 AND 366 OR NOT EXISTS(SELECT 1 FROM "Plan" WHERE id=data->>'planId' AND active) THEN RETURN 'invalid'; END IF;
   PERFORM wallet_grant_plan(uid,data->>'planId',(data->>'days')::integer,'admin',event_id);
 ELSIF operation='cancel' THEN
   UPDATE "Subscription" SET status='CANCELLED' WHERE id=data->>'subscriptionId' AND "userId"=uid;
 ELSIF operation='note' THEN
   IF length(trim(COALESCE(data->>'body','')))=0 THEN RETURN 'invalid'; END IF;
   INSERT INTO "CrmNote" (id,"subjectId","authorId",body) VALUES (event_id,uid,actor,left(data->>'body',4000));
 ELSE RETURN 'invalid'; END IF;
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta) VALUES ('manage:'||event_id,actor,'admin.user_'||operation,uid,
   jsonb_build_object('before',jsonb_build_object('role',u.role,'status',u.status,'sessionVersion',u."sessionVersion"),
     'after',(SELECT jsonb_build_object('role',role,'status',status,'sessionVersion',"sessionVersion") FROM "User" WHERE id=uid),
     'details',data-'passwordHash'-'tokenHash'-'body'));
 RETURN 'saved';
END $$;

CREATE OR REPLACE FUNCTION wallet_review_manual_deposit(pid TEXT,actor TEXT,approve BOOLEAN,hash TEXT,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE p "Payment"%ROWTYPE; uid TEXT; normalized TEXT; verified_amount NUMERIC;
BEGIN
 SELECT "userId" INTO uid FROM "Payment" WHERE id=pid;
 -- Consistent user ordering also makes competing reviews by different admins safe.
 PERFORM 1 FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='SUPER_ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
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

CREATE OR REPLACE FUNCTION trading_review(aid TEXT,actor TEXT,approve BOOLEAN,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "TradingAllocation"%ROWTYPE; u "User"%ROWTYPE; uid TEXT; stamp TIMESTAMP(3); outstanding BIGINT;
BEGIN
 SELECT "userId" INTO uid FROM "TradingAllocation" WHERE id=aid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM id FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='SUPER_ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
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

CREATE OR REPLACE FUNCTION trading_record_result(aid TEXT,actor TEXT,profit INTEGER,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "TradingAllocation"%ROWTYPE; uid TEXT; payout BIGINT;
BEGIN
 SELECT "userId" INTO uid FROM "TradingAllocation" WHERE id=aid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM id FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='SUPER_ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
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

CREATE OR REPLACE FUNCTION trading_record_payout(aid TEXT,actor TEXT,expected_cents INTEGER,hash TEXT,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "TradingAllocation"%ROWTYPE; uid TEXT; normalized TEXT;
BEGIN
 SELECT "userId" INTO uid FROM "TradingAllocation" WHERE id=aid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM id FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='SUPER_ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
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
