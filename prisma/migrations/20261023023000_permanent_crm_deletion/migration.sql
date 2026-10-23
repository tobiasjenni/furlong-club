-- Physical removal is for unused accounts. Financial and staff history stays protected.
CREATE FUNCTION admin_permanently_delete_user(actor TEXT, uid TEXT, data JSONB, event_id TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "User"%ROWTYPE; u "User"%ROWTYPE;
BEGIN
 PERFORM id FROM "User" WHERE id IN (actor,uid) ORDER BY id FOR UPDATE;
 SELECT * INTO a FROM "User" WHERE id=actor;
 IF a.id IS NULL OR a.status<>'ACTIVE' OR a.role<>'SUPER_ADMIN' OR actor=uid
   OR data->>'passwordHash' IS DISTINCT FROM a."passwordHash" THEN RETURN 'forbidden'; END IF;
 SELECT * INTO u FROM "User" WHERE id=uid;
 IF u.id IS NULL THEN RETURN 'missing'; END IF;
 IF u.role='SUPER_ADMIN' THEN RETURN 'forbidden'; END IF;
 IF u.role='ADMIN' THEN RETURN 'staff_account'; END IF;
 IF lower(trim(COALESCE(data->>'confirmation','')))<>lower(u.email)
   OR data->>'acknowledgement' IS DISTINCT FROM 'DELETE'
   OR length(trim(COALESCE(data->>'reason',''))) NOT BETWEEN 10 AND 500 THEN RETURN 'invalid'; END IF;
 IF u."balanceCents"<>0 OR u."walletFrozen" THEN RETURN 'wallet_unresolved'; END IF;
 IF EXISTS(SELECT 1 FROM "Payment" WHERE "userId"=uid)
   OR EXISTS(SELECT 1 FROM "WalletJournal" WHERE "userId"=uid)
   OR EXISTS(SELECT 1 FROM "LedgerEntry" WHERE "userId"=uid)
   OR EXISTS(SELECT 1 FROM "TradingAllocation" WHERE "userId"=uid)
   OR EXISTS(SELECT 1 FROM "Subscription" s JOIN "Plan" p ON p.id=s."planId"
     WHERE s."userId"=uid AND p."priceCents">0 AND (s.source<>'admin' OR (s.status='ACTIVE' AND s."endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))) THEN RETURN 'financial_history'; END IF;
 IF EXISTS(SELECT 1 FROM "CrmNote" WHERE "authorId"=uid AND "subjectId"<>uid) THEN RETURN 'staff_history'; END IF;
 -- Retain security/accountability logs, without copying credentials or CRM note bodies.
 INSERT INTO "AuditLog"(id,"actorId",action,target,meta) VALUES ('purge:'||event_id,actor,'admin.user_permanently_deleted',uid,
   jsonb_build_object('email',u.email,'name',u.name,'previousStatus',u.status,'reason',trim(data->>'reason')));
 -- Explicit removal handles notes authored by the subject as well as the subject FK cascade.
 DELETE FROM "CrmNote" WHERE "subjectId"=uid;
 DELETE FROM "User" WHERE id=uid;
 RETURN 'deleted';
END $$;
