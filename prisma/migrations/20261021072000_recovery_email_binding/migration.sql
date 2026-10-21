DROP FUNCTION auth_issue_token(TEXT,"TokenType",TEXT,TEXT,BIGINT,INTEGER);
CREATE FUNCTION auth_issue_token(uid TEXT, purpose "TokenType", token_id TEXT, digest TEXT, ttl_ms BIGINT, expected_version INTEGER, expected_email TEXT DEFAULT NULL) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR u."sessionVersion"<>expected_version OR (expected_email IS NOT NULL AND u.email<>expected_email) THEN RETURN false; END IF;
 DELETE FROM "AuthToken" WHERE "userId"=uid AND type=purpose AND "usedAt" IS NULL;
 INSERT INTO "AuthToken" (id,"userId",type,"tokenHash","expiresAt","sessionVersion") VALUES (token_id,uid,purpose,digest,(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+ttl_ms*interval '1 millisecond',u."sessionVersion");
 RETURN true;
END $$;

CREATE FUNCTION auth_change_email(uid TEXT, expected_hash TEXT, expected_version INTEGER, next_email TEXT, event_id TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR u.role<>'USER' OR u."passwordHash"<>expected_hash OR u."sessionVersion"<>expected_version THEN RETURN false; END IF;
 UPDATE "User" SET email=next_email,"emailVerifiedAt"=NULL,"sessionVersion"="sessionVersion"+1,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=uid;
 DELETE FROM "AuthToken" WHERE "userId"=uid;
 INSERT INTO "AuditLog" (id,"actorId",action,target,meta) VALUES (event_id,uid,'user.email_changed',uid,jsonb_build_object('from',u.email,'to',next_email));
 RETURN true;
END $$;
