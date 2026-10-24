-- Unreported manual requests are not receipts. Retain their audit trail after 60 minutes.
CREATE FUNCTION wallet_expire_manual_deposits(target_user TEXT DEFAULT NULL) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE p RECORD; expired_count INTEGER := 0;
BEGIN
 FOR p IN
  UPDATE "Payment" SET status='EXPIRED',"providerStatus"='unreported_timeout',"settlementStatus"='EXPIRED',
    "updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  WHERE provider='manual' AND purpose='WALLET_TOPUP' AND status='PENDING'
    AND (target_user IS NULL OR "userId"=target_user)
    AND "createdAt"+interval '60 minutes'<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    AND "submittedAt" IS NULL AND "submittedTxHash" IS NULL AND "payinHash" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "WalletJournal" j WHERE j."paymentId"="Payment".id)
  RETURNING id,"userId"
 LOOP
  INSERT INTO "PaymentEvent"(id,"paymentId","eventKey",source,payload,decision)
   VALUES (p.id||':auto-expired',p.id,'auto-expired','system','{"timeoutMinutes":60}'::jsonb,'unreported request expired');
  INSERT INTO "AuditLog"(id,action,target,meta)
   VALUES (p.id||':auto-expired','manual_deposit.auto_expired',p.id,'{"timeoutMinutes":60,"creditChanged":false}'::jsonb);
  expired_count := expired_count+1;
 END LOOP;
 RETURN expired_count;
END $$;

CREATE FUNCTION wallet_manual_deposit_deadline() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.provider='manual' AND NEW.purpose='WALLET_TOPUP' THEN
  NEW."expiresAt" := NEW."createdAt"+interval '60 minutes';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_manual_deadline BEFORE INSERT ON "Payment" FOR EACH ROW EXECUTE FUNCTION wallet_manual_deposit_deadline();

UPDATE "Payment" SET "expiresAt"="createdAt"+interval '60 minutes'
 WHERE provider='manual' AND purpose='WALLET_TOPUP' AND status='PENDING' AND "submittedAt" IS NULL;
SELECT wallet_expire_manual_deposits();

CREATE OR REPLACE FUNCTION wallet_create_manual_deposit(uid TEXT,pid TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR (u."emailVerifiedAt" IS NULL AND auth_email_verification_required()) THEN RETURN 'unverified'; END IF;
 IF u."walletFrozen" THEN RETURN 'frozen'; END IF;
 IF cents<2000 OR cents>1000000 OR (coin||':'||chain) NOT IN ('USDT:TRC20','USDT:ERC20','USDC:ERC20','USDC:POLYGON')
  OR address IS NULL OR length(address)<10 OR length(address)>200 THEN RETURN 'invalid'; END IF;
 PERFORM wallet_expire_manual_deposits(uid);
 IF (SELECT count(*) FROM "Payment" WHERE "userId"=uid AND provider='manual' AND status IN ('PENDING','CONFIRMING','PARTIAL'))>=3 THEN RETURN 'too_many_open'; END IF;
 INSERT INTO "Payment" (id,"userId",purpose,"amountCents",currency,network,provider,"providerRef","payAddress","payAmount","poolAddress","settlementStatus","providerStatus","updatedAt")
  VALUES (pid,uid,'WALLET_TOPUP',cents,coin,chain,'manual',pid,address,(cents::numeric/100)::text,address,'AWAITING_TRANSFER','awaiting_transfer',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
 INSERT INTO "PaymentEvent" (id,"paymentId","eventKey",source,payload,decision)
  VALUES (pid||':created',pid,'created','member',jsonb_build_object('userId',uid,'amountCents',cents,'currency',coin,'network',chain,'address',address),'deposit created');
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta)
  VALUES (pid||':created',uid,'manual_deposit.created',pid,jsonb_build_object('amountCents',cents,'currency',coin,'network',chain));
 RETURN 'created';
END $$;
