CREATE TABLE "ClubDailyResult" (
 day DATE PRIMARY KEY,
 "returnBps" INTEGER NOT NULL CHECK ("returnBps" BETWEEN -10000 AND 100000),
 published BOOLEAN NOT NULL DEFAULT true,
 revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0),
 "sourceNote" TEXT NOT NULL CHECK (length(trim("sourceNote")) BETWEEN 10 AND 1000),
 "updatedById" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE TRIGGER club_daily_result_no_delete BEFORE DELETE ON "ClubDailyResult" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();

-- Reported club performance is separate from every member's wallet and allocation ledger.
-- Corrections/retractions append history; a stale form cannot overwrite newer figures.
CREATE FUNCTION club_save_daily_result(actor TEXT, result_day TEXT, bps INTEGER, source_note TEXT, expected_revision INTEGER, publish BOOLEAN, event_id TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "User"%ROWTYPE; previous "ClubDailyResult"%ROWTYPE; saved "ClubDailyResult"%ROWTYPE; selected_day DATE;
BEGIN
 SELECT * INTO a FROM "User" WHERE id=actor FOR UPDATE;
 IF a.id IS NULL OR a.status<>'ACTIVE' OR a.role<>'SUPER_ADMIN' THEN RETURN 'forbidden'; END IF;
 IF result_day IS NULL OR result_day !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN 'invalid_day'; END IF;
 BEGIN selected_day:=result_day::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN 'invalid_day'; END;
 IF selected_day<'2000-01-01'::date OR selected_day>(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date THEN RETURN 'invalid_day'; END IF;
 IF bps IS NULL OR bps NOT BETWEEN -10000 AND 100000 OR publish IS NULL OR expected_revision IS NULL OR expected_revision<0
   OR length(trim(COALESCE(source_note,''))) NOT BETWEEN 10 AND 1000 THEN RETURN 'invalid'; END IF;
 SELECT * INTO previous FROM "ClubDailyResult" WHERE day=selected_day FOR UPDATE;
 IF expected_revision=0 THEN
   IF NOT publish THEN RETURN 'missing'; END IF;
   INSERT INTO "ClubDailyResult"(day,"returnBps","sourceNote","updatedById") VALUES(selected_day,bps,trim(source_note),actor)
     ON CONFLICT DO NOTHING RETURNING * INTO saved;
 ELSE
   UPDATE "ClubDailyResult" SET "returnBps"=CASE WHEN publish THEN bps ELSE "returnBps" END,
     published=publish,revision=revision+1,"sourceNote"=trim(source_note),"updatedById"=actor,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
     WHERE day=selected_day AND revision=expected_revision RETURNING * INTO saved;
 END IF;
 IF saved.day IS NULL THEN RETURN 'stale'; END IF;
 INSERT INTO "AuditLog"(id,"actorId",action,target,meta) VALUES ('daily-result:'||event_id,actor,
   CASE WHEN publish THEN 'club.daily_result_published' ELSE 'club.daily_result_retracted' END,result_day,
   jsonb_build_object('before',CASE WHEN previous.day IS NULL THEN NULL ELSE to_jsonb(previous) END,'after',to_jsonb(saved)));
 RETURN 'saved';
END $$;

CREATE TABLE "ClubCycleSummary" (
 id TEXT PRIMARY KEY CHECK(id='harry'),
 "endDay" DATE NOT NULL,
 "profitBps" INTEGER NOT NULL CHECK("profitBps" BETWEEN -10000 AND 100000),
 published BOOLEAN NOT NULL DEFAULT true,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 "sourceNote" TEXT NOT NULL CHECK(length(trim("sourceNote")) BETWEEN 10 AND 1000),
 "updatedById" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
CREATE TRIGGER club_cycle_summary_no_delete BEFORE DELETE ON "ClubCycleSummary" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();

CREATE FUNCTION club_save_cycle_summary(actor TEXT, end_day TEXT, bps INTEGER, source_note TEXT, expected_revision INTEGER, publish BOOLEAN, event_id TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "User"%ROWTYPE; previous "ClubCycleSummary"%ROWTYPE; saved "ClubCycleSummary"%ROWTYPE; selected_day DATE;
BEGIN
 SELECT * INTO a FROM "User" WHERE id=actor FOR UPDATE;
 IF a.id IS NULL OR a.status<>'ACTIVE' OR a.role<>'SUPER_ADMIN' THEN RETURN 'forbidden'; END IF;
 IF end_day IS NULL OR end_day !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN 'invalid_day'; END IF;
 BEGIN selected_day:=end_day::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN 'invalid_day'; END;
 IF selected_day<'2000-01-01'::date OR selected_day>(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date+365 THEN RETURN 'invalid_day'; END IF;
 IF bps IS NULL OR bps NOT BETWEEN -10000 AND 100000 OR publish IS NULL OR expected_revision IS NULL OR expected_revision<0
   OR length(trim(COALESCE(source_note,''))) NOT BETWEEN 10 AND 1000 THEN RETURN 'invalid'; END IF;
 SELECT * INTO previous FROM "ClubCycleSummary" WHERE id='harry' FOR UPDATE;
 IF expected_revision=0 THEN
   INSERT INTO "ClubCycleSummary"(id,"endDay","profitBps",published,"sourceNote","updatedById") VALUES('harry',selected_day,bps,publish,trim(source_note),actor)
     ON CONFLICT DO NOTHING RETURNING * INTO saved;
 ELSE
   UPDATE "ClubCycleSummary" SET "endDay"=selected_day,"profitBps"=bps,published=publish,revision=revision+1,
     "sourceNote"=trim(source_note),"updatedById"=actor,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
     WHERE id='harry' AND revision=expected_revision RETURNING * INTO saved;
 END IF;
 IF saved.id IS NULL THEN RETURN 'stale'; END IF;
 INSERT INTO "AuditLog"(id,"actorId",action,target,meta) VALUES('cycle-summary:'||event_id,actor,'club.cycle_summary_updated','harry',
   jsonb_build_object('before',CASE WHEN previous.id IS NULL THEN NULL ELSE to_jsonb(previous) END,'after',to_jsonb(saved)));
 RETURN 'saved';
END $$;

-- The owner supplied this aggregate figure. No daily values or payouts are invented.
-- Empty databases (CI) have no owner and receive no historical claim.
INSERT INTO "ClubCycleSummary"(id,"endDay","profitBps","sourceNote","updatedById")
 SELECT 'harry','2026-10-25'::date,14800,'Owner reported 148% net profit for the 33-day cycle ending 25 October 2026. Actual daily figures have not been supplied; no payout is confirmed by this summary.',id
 FROM "User" WHERE role='SUPER_ADMIN' AND status='ACTIVE' ORDER BY "createdAt",id LIMIT 1;
INSERT INTO "AuditLog"(id,"actorId",action,target,meta)
 SELECT 'club-cycle:2026-10-25:owner-report',"updatedById",'club.cycle_summary_owner_reported','harry',to_jsonb(c)
 FROM "ClubCycleSummary" c WHERE id='harry';
