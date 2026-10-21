CREATE TABLE "AdminPasskey" (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 2048),
 "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "publicKey" TEXT NOT NULL CHECK(length("publicKey") BETWEEN 1 AND 4096),
 counter BIGINT NOT NULL DEFAULT 0 CHECK(counter BETWEEN 0 AND 4294967295),
 transports TEXT[] NOT NULL DEFAULT '{}', label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 80),
 "backedUp" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), "lastUsedAt" TIMESTAMP(3), "verifiedAt" TIMESTAMP(3)
);
CREATE INDEX ON "AdminPasskey"("userId");
CREATE TABLE "AdminSecurityChallenge" (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 challenge TEXT NOT NULL CHECK(length(challenge) BETWEEN 32 AND 128),
 purpose TEXT NOT NULL CHECK(purpose IN ('register','authenticate')),
 "sessionHash" TEXT NOT NULL CHECK("sessionHash" ~ '^[a-f0-9]{64}$'),
 "sessionVersion" INTEGER NOT NULL, initial BOOLEAN NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3)
);
CREATE INDEX ON "AdminSecurityChallenge"("expiresAt");
CREATE TABLE "AdminRecoveryCode" (
 hash TEXT PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'),
 "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), "usedAt" TIMESTAMP(3)
);
CREATE INDEX ON "AdminRecoveryCode"("userId");

CREATE FUNCTION admin_security_challenge(uid TEXT, version INTEGER, sid TEXT, purpose TEXT, cid TEXT, nonce TEXT, allow_enrolled BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE n INTEGER; stamp TIMESTAMP := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
BEGIN
 PERFORM 1 FROM "User" WHERE id=uid AND status='ACTIVE' AND role IN ('ADMIN','SUPER_ADMIN') AND "sessionVersion"=version FOR UPDATE;
 IF NOT FOUND OR purpose IS NULL OR purpose NOT IN ('register','authenticate') THEN RETURN false; END IF;
 SELECT count(*) INTO n FROM "AdminPasskey" WHERE "userId"=uid;
 IF (purpose='register' AND (n>=5 OR (n>0 AND NOT COALESCE(allow_enrolled,false)))) OR (purpose='authenticate' AND n=0) THEN RETURN false; END IF;
 DELETE FROM "AdminSecurityChallenge" WHERE "userId"=uid AND ("sessionHash"=sid OR "expiresAt"<=stamp);
 INSERT INTO "AdminSecurityChallenge"(id,"userId",challenge,purpose,"sessionHash","sessionVersion",initial,"expiresAt")
 VALUES(cid,uid,nonce,purpose,sid,version,n=0,stamp+interval '5 minutes');
 RETURN true;
END $$;

CREATE FUNCTION admin_consume_challenge(uid TEXT, version INTEGER, sid TEXT, cid TEXT, kind TEXT)
RETURNS TABLE(challenge TEXT, initial BOOLEAN) LANGUAGE plpgsql AS $$
DECLARE c "AdminSecurityChallenge"%ROWTYPE;
BEGIN
 PERFORM 1 FROM "User" WHERE id=uid AND status='ACTIVE' AND role IN ('ADMIN','SUPER_ADMIN') AND "sessionVersion"=version FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO c FROM "AdminSecurityChallenge" WHERE id=cid AND "userId"=uid AND "sessionHash"=sid AND "sessionVersion"=version AND purpose=kind FOR UPDATE;
 IF c.id IS NULL OR c."usedAt" IS NOT NULL OR c."expiresAt"<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN RETURN; END IF;
 UPDATE "AdminSecurityChallenge" SET "usedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=cid;
 RETURN QUERY SELECT c.challenge,c.initial;
END $$;

-- Crypto verification is performed by the server library. This function rechecks
-- authority, versions and counters while committing security changes atomically.
CREATE FUNCTION admin_security_commit(uid TEXT, version INTEGER, operation TEXT, data JSONB, codes JSONB, event_id TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE k "AdminPasskey"%ROWTYPE; n INTEGER; digest TEXT; stamp TIMESTAMP := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
BEGIN
 PERFORM 1 FROM "User" WHERE id=uid AND status='ACTIVE' AND role IN ('ADMIN','SUPER_ADMIN') AND "sessionVersion"=version FOR UPDATE;
 IF NOT FOUND THEN RETURN 'changed'; END IF;
 SELECT count(*) INTO n FROM "AdminPasskey" WHERE "userId"=uid;
 IF operation='register' THEN
  IF n>=5 THEN RETURN 'limit'; END IF;
  IF (COALESCE((data->>'initial')::boolean,false) AND n<>0) OR (NOT COALESCE((data->>'initial')::boolean,false) AND n=0) THEN RETURN 'changed'; END IF;
  IF n=0 AND (codes IS NULL OR jsonb_typeof(codes)<>'array' OR jsonb_array_length(codes)<>8) THEN RETURN 'invalid'; END IF;
  INSERT INTO "AdminPasskey"(id,"userId","publicKey",counter,transports,label,"backedUp") VALUES
   (data->>'id',uid,data->>'publicKey',(data->>'counter')::bigint,ARRAY(SELECT jsonb_array_elements_text(data->'transports')),data->>'label',(data->>'backedUp')::boolean);
 ELSIF operation='authenticate' THEN
  SELECT * INTO k FROM "AdminPasskey" WHERE id=data->>'id' AND "userId"=uid FOR UPDATE;
  IF k.id IS NULL OR k.counter<>(data->>'oldCounter')::bigint OR (k.counter>0 AND (data->>'counter')::bigint<=k.counter) THEN RETURN 'changed'; END IF;
  UPDATE "AdminPasskey" SET counter=(data->>'counter')::bigint,"lastUsedAt"=stamp,"verifiedAt"=COALESCE("verifiedAt",stamp),"backedUp"=(data->>'backedUp')::boolean WHERE id=k.id;
 ELSIF operation='recover' THEN
  IF n=0 THEN RETURN 'invalid'; END IF;
  UPDATE "AdminRecoveryCode" SET "usedAt"=stamp WHERE hash=data->>'hash' AND "userId"=uid AND "usedAt" IS NULL;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
 ELSIF operation='remove' THEN
  IF n<=1 THEN RETURN 'last_key'; END IF;
  IF EXISTS(SELECT 1 FROM "AdminPasskey" WHERE id=data->>'id' AND "userId"=uid AND "verifiedAt" IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM "AdminPasskey" WHERE id<>data->>'id' AND "userId"=uid AND "verifiedAt" IS NOT NULL) THEN RETURN 'last_key'; END IF;
  DELETE FROM "AdminPasskey" WHERE id=data->>'id' AND "userId"=uid;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
 ELSIF operation='rotate_codes' THEN
  IF n=0 OR codes IS NULL OR jsonb_typeof(codes)<>'array' OR jsonb_array_length(codes)<>8 THEN RETURN 'invalid'; END IF;
  DELETE FROM "AdminRecoveryCode" WHERE "userId"=uid;
 ELSE RETURN 'invalid'; END IF;
 IF (operation='register' AND n=0) OR operation='rotate_codes' THEN
  FOR digest IN SELECT jsonb_array_elements_text(codes) LOOP
   INSERT INTO "AdminRecoveryCode"(hash,"userId") VALUES(digest,uid);
  END LOOP;
 END IF;
 IF operation<>'authenticate' THEN
  UPDATE "User" SET "sessionVersion"="sessionVersion"+1,"updatedAt"=stamp WHERE id=uid;
  DELETE FROM "AuthToken" WHERE "userId"=uid;
  DELETE FROM "AdminSecurityChallenge" WHERE "userId"=uid AND "usedAt" IS NULL;
 END IF;
 INSERT INTO "AuditLog"(id,"actorId",action,target,meta) VALUES(event_id,uid,'admin.security_'||operation,uid,
  jsonb_build_object('passkeyLabel',CASE WHEN operation='register' THEN data->>'label' ELSE NULL END));
 RETURN 'saved';
END $$;
