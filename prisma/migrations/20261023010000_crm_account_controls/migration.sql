-- CRM edits and account deletion retain the same owner-only, atomic audit boundary.
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
 ELSIF operation='profile' THEN
   IF data->>'status' IS NULL OR data->>'status' NOT IN ('ACTIVE','SUSPENDED','CLOSED')
     OR (data->>'status'='CLOSED' AND u.status<>'CLOSED')
     OR jsonb_typeof(data->'name') IS DISTINCT FROM 'string' OR length(data->>'name')>120
     OR jsonb_typeof(data->'country') IS DISTINCT FROM 'string' OR length(data->>'country')>80
     OR jsonb_typeof(data->'tags') IS DISTINCT FROM 'array'
     OR length(trim(COALESCE(data->>'reason',''))) NOT BETWEEN 10 AND 500
     OR data->>'expectedUpdatedAt' IS NULL THEN RETURN 'invalid'; END IF;
   IF jsonb_array_length(data->'tags')>20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(data->'tags') t
     WHERE jsonb_typeof(t)<>'string' OR length(trim(t #>> '{}')) NOT BETWEEN 1 AND 60) THEN RETURN 'invalid'; END IF;
   IF (data->>'expectedUpdatedAt')::timestamptz IS DISTINCT FROM (u."updatedAt" AT TIME ZONE 'UTC') THEN RETURN 'stale'; END IF;
   next_status := (data->>'status')::"UserStatus";
   changed := next_status<>u.status;
   UPDATE "User" SET name=NULLIF(trim(data->>'name'),''),country=NULLIF(trim(data->>'country'),''),
     tags=ARRAY(SELECT trim(jsonb_array_elements_text(data->'tags'))), status=next_status,
     "closedAt"=CASE WHEN next_status='CLOSED' THEN "closedAt" ELSE NULL END,
     "sessionVersion"="sessionVersion"+CASE WHEN changed THEN 1 ELSE 0 END,
     "updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=uid;
   IF changed THEN DELETE FROM "AuthToken" WHERE "userId"=uid; END IF;
 ELSIF operation='delete' THEN
   IF data->>'passwordHash' IS DISTINCT FROM a."passwordHash" THEN RETURN 'forbidden'; END IF;
   IF lower(trim(COALESCE(data->>'confirmation','')))<>lower(u.email)
     OR length(trim(COALESCE(data->>'reason',''))) NOT BETWEEN 10 AND 500 THEN RETURN 'invalid'; END IF;
   IF u.status='CLOSED' THEN RETURN 'already_closed'; END IF;
   IF u."balanceCents"<>0 OR u."walletFrozen"
     OR EXISTS(SELECT 1 FROM "Payment" WHERE "userId"=uid AND status IN ('PENDING','CONFIRMING','PARTIAL'))
     OR EXISTS(SELECT 1 FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('PENDING','ACTIVE','PAYOUT_READY'))
     OR EXISTS(SELECT 1 FROM "LedgerEntry" WHERE "userId"=uid AND status='PENDING') THEN RETURN 'wallet_unresolved'; END IF;
   IF EXISTS(SELECT 1 FROM "Subscription" s JOIN "Plan" p ON p.id=s."planId"
     WHERE s."userId"=uid AND s.status='ACTIVE' AND s."endsAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND p."priceCents">0) THEN RETURN 'membership_active'; END IF;
   UPDATE "User" SET status='CLOSED',"closedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
     "marketingOptIn"=false,"sessionVersion"="sessionVersion"+1,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=uid;
   DELETE FROM "AuthToken" WHERE "userId"=uid;
 ELSIF operation='account' THEN
   -- Closure now requires the dedicated confirmation and password-checked operation.
   IF data->>'status' IS NULL OR data->>'status' NOT IN ('ACTIVE','SUSPENDED') THEN RETURN 'invalid'; END IF;
   next_status := (data->>'status')::"UserStatus";
   changed := next_status<>u.status;
   UPDATE "User" SET status=next_status,tags=ARRAY(SELECT jsonb_array_elements_text(data->'tags')),
     "closedAt"=NULL,
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
   jsonb_build_object('before',jsonb_build_object('role',u.role,'status',u.status,'sessionVersion',u."sessionVersion",'name',u.name,'country',u.country,'tags',u.tags),
     'after',(SELECT jsonb_build_object('role',role,'status',status,'sessionVersion',"sessionVersion",'name',name,'country',country,'tags',tags) FROM "User" WHERE id=uid),
     'details',data-'passwordHash'-'tokenHash'-'body'-'confirmation'));
 RETURN 'saved';
END $$;

