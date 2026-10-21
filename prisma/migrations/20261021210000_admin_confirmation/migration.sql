-- Confirmation must be checked against the current account inside the database.
CREATE FUNCTION auth_confirm_admin(uid TEXT, expected_hash TEXT, expected_version INTEGER, event_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "User" WHERE id=uid AND status='ACTIVE' AND role IN ('ADMIN','SUPER_ADMIN')
   AND "passwordHash"=expected_hash AND "sessionVersion"=expected_version FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO "AuditLog" (id,"actorId",action,target) VALUES (event_id,uid,'admin.access_confirmed',uid);
 RETURN true;
END $$;
