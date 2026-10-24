-- Append corrections; never rewrite a receipt, balance or locked principal.
CREATE FUNCTION wallet_admin_adjust_credit(actor TEXT, uid TEXT, delta INTEGER, reason TEXT,
  expected TIMESTAMP(3), expected_balance INTEGER, operation_id TEXT, receipt TEXT, actor_password_hash TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "User"%ROWTYPE; u "User"%ROWTYPE; previous "WalletJournal"%ROWTYPE; op TEXT;
BEGIN
 PERFORM id FROM "User" WHERE id IN (actor,uid) ORDER BY id FOR UPDATE;
 SELECT * INTO a FROM "User" WHERE id=actor;
 SELECT * INTO u FROM "User" WHERE id=uid;
 IF a.id IS NULL OR a.status<>'ACTIVE' OR a.role<>'SUPER_ADMIN'
   OR actor_password_hash IS DISTINCT FROM a."passwordHash" THEN RETURN 'forbidden'; END IF;
 IF u.id IS NULL THEN RETURN 'missing'; END IF;
 IF uid=actor OR u.role='SUPER_ADMIN' THEN RETURN 'forbidden'; END IF;
 IF delta IS NULL OR delta=0 OR abs(delta::bigint)>1000000 OR expected IS NULL
   OR operation_id IS NULL OR operation_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR reason IS NULL OR length(trim(reason)) NOT BETWEEN 10 AND 1000 THEN RETURN 'invalid'; END IF;
 receipt := NULLIF(receipt,''); reason := trim(reason); op := 'adjustment:'||operation_id;
 SELECT * INTO previous FROM "WalletJournal" WHERE "operationKey"=op;
 IF FOUND THEN
   IF previous."userId"=uid AND previous."userDeltaCents"=delta AND previous."paymentId" IS NOT DISTINCT FROM receipt
     AND EXISTS(SELECT 1 FROM "AuditLog" WHERE id=op AND "actorId"=actor AND meta->>'reason'=reason)
     THEN RETURN 'already_saved'; END IF;
   RETURN 'conflict';
 END IF;
 IF u."updatedAt" IS DISTINCT FROM expected OR u."balanceCents" IS DISTINCT FROM expected_balance THEN RETURN 'stale'; END IF;
 IF u.status='CLOSED' OR u."walletFrozen" THEN RETURN 'unavailable'; END IF;
 IF receipt IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Payment" WHERE id=receipt AND "userId"=uid
   AND purpose='WALLET_TOPUP' AND status='CONFIRMED') THEN RETURN 'invalid_receipt'; END IF;
 IF u."balanceCents"::bigint+delta<0 THEN RETURN 'insufficient'; END IF;
 IF u."balanceCents"::bigint+delta>2147483647 THEN RETURN 'invalid'; END IF;
 INSERT INTO "WalletJournal" (id,"userId","paymentId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents")
   VALUES(op,uid,receipt,op,'ADMIN_ADJUSTMENT','Super Admin wallet credit correction',delta,-delta,0);
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta) VALUES(op,actor,'admin.wallet_adjusted',uid,
   jsonb_build_object('deltaCents',delta,'beforeCents',u."balanceCents",'afterCents',u."balanceCents"::bigint+delta,
     'reason',reason,'paymentId',receipt,'operationKey',op));
 INSERT INTO "CrmNote" (id,"subjectId","authorId",body) VALUES(op,uid,actor,
   'Wallet correction: '||CASE WHEN delta>0 THEN '+' ELSE '' END||to_char(delta::numeric/100,'FM999999990.00')||' USD. '
   ||'Available credit: '||to_char(u."balanceCents"::numeric/100,'FM999999990.00')||' → '
   ||to_char((u."balanceCents"::numeric+delta)/100,'FM999999990.00')||' USD. Reason: '||reason
   ||CASE WHEN receipt IS NOT NULL THEN ' Receipt: '||receipt ELSE '' END||' Reference: '||op);
 RETURN 'saved';
END $$;
