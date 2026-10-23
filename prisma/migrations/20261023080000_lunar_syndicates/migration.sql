-- Operator-selected entry dates: one new-moon and one full-moon entry per UTC calendar month.
-- Dates checked against Royal Observatory of Belgium 2026/2027 tables, converted to UTC dates.
-- Starts are the owner's chosen 00:00 UTC, not the astronomical phase instant.
CREATE TABLE "SyndicateEntry" (
 id TEXT PRIMARY KEY, phase TEXT NOT NULL CHECK(phase IN ('NEW','FULL')),
 "startsAt" TIMESTAMP(3) NOT NULL UNIQUE CHECK("startsAt"=date_trunc('day',"startsAt")),
 accepting BOOLEAN NOT NULL DEFAULT true, revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 UNIQUE(id,"startsAt")
);
CREATE UNIQUE INDEX syndicate_one_phase_per_month ON "SyndicateEntry"(date_trunc('month',"startsAt"),phase);
INSERT INTO "SyndicateEntry"(id,phase,"startsAt") VALUES
 ('moon-2026-10-26-full','FULL','2026-10-26T00:00:00'::timestamp),
 ('moon-2026-11-09-new','NEW','2026-11-09T00:00:00'::timestamp),
 ('moon-2026-11-24-full','FULL','2026-11-24T00:00:00'::timestamp),
 ('moon-2026-12-09-new','NEW','2026-12-09T00:00:00'::timestamp),
 ('moon-2026-12-24-full','FULL','2026-12-24T00:00:00'::timestamp),
 ('moon-2027-01-07-new','NEW','2027-01-07T00:00:00'::timestamp),
 ('moon-2027-01-22-full','FULL','2027-01-22T00:00:00'::timestamp),
 ('moon-2027-02-06-new','NEW','2027-02-06T00:00:00'::timestamp),
 ('moon-2027-02-20-full','FULL','2027-02-20T00:00:00'::timestamp),
 ('moon-2027-03-08-new','NEW','2027-03-08T00:00:00'::timestamp),
 ('moon-2027-03-22-full','FULL','2027-03-22T00:00:00'::timestamp),
 ('moon-2027-04-06-new','NEW','2027-04-06T00:00:00'::timestamp),
 ('moon-2027-04-20-full','FULL','2027-04-20T00:00:00'::timestamp),
 ('moon-2027-05-06-new','NEW','2027-05-06T00:00:00'::timestamp),
 ('moon-2027-05-20-full','FULL','2027-05-20T00:00:00'::timestamp),
 ('moon-2027-06-04-new','NEW','2027-06-04T00:00:00'::timestamp),
 ('moon-2027-06-19-full','FULL','2027-06-19T00:00:00'::timestamp),
 ('moon-2027-07-04-new','NEW','2027-07-04T00:00:00'::timestamp),
 ('moon-2027-07-18-full','FULL','2027-07-18T00:00:00'::timestamp),
 ('moon-2027-08-02-new','NEW','2027-08-02T00:00:00'::timestamp),
 ('moon-2027-08-17-full','FULL','2027-08-17T00:00:00'::timestamp),
 ('moon-2027-09-15-full','FULL','2027-09-15T00:00:00'::timestamp),
 ('moon-2027-09-30-new','NEW','2027-09-30T00:00:00'::timestamp),
 ('moon-2027-10-15-full','FULL','2027-10-15T00:00:00'::timestamp),
 ('moon-2027-10-29-new','NEW','2027-10-29T00:00:00'::timestamp),
 ('moon-2027-11-14-full','FULL','2027-11-14T00:00:00'::timestamp),
 ('moon-2027-11-28-new','NEW','2027-11-28T00:00:00'::timestamp),
 ('moon-2027-12-13-full','FULL','2027-12-13T00:00:00'::timestamp),
 ('moon-2027-12-27-new','NEW','2027-12-27T00:00:00'::timestamp);
CREATE FUNCTION syndicate_guard_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW.phase,NEW."startsAt") IS DISTINCT FROM ROW(OLD.id,OLD.phase,OLD."startsAt") THEN RAISE EXCEPTION 'Published entry dates are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER syndicate_schedule_guard BEFORE UPDATE ON "SyndicateEntry" FOR EACH ROW EXECUTE FUNCTION syndicate_guard_schedule();
CREATE TRIGGER syndicate_entry_no_delete BEFORE DELETE ON "SyndicateEntry" FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
ALTER TABLE "TradingAllocation" ADD COLUMN "syndicateEntryId" TEXT, ADD COLUMN "startsAt" TIMESTAMP(3);
ALTER TABLE "TradingAllocation" ADD CONSTRAINT trading_syndicate_entry FOREIGN KEY("syndicateEntryId","startsAt") REFERENCES "SyndicateEntry"(id,"startsAt") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TradingAllocation" ADD CONSTRAINT trading_entry_fields CHECK(("syndicateEntryId" IS NULL AND "startsAt" IS NULL AND "termsVersion"<>'lunar-v1-2026-10-23') OR ("syndicateEntryId" IS NOT NULL AND "startsAt" IS NOT NULL AND "termsVersion"='lunar-v1-2026-10-23'));
ALTER TABLE "TradingAllocation" DROP CONSTRAINT trading_lock;
ALTER TABLE "TradingAllocation" ADD CONSTRAINT trading_lock CHECK("approvedAt" IS NULL OR ("unlocksAt" IS NOT NULL AND "approvedById" IS NOT NULL AND
 (("startsAt" IS NULL AND "unlocksAt"="approvedAt"+interval '33 days') OR ("startsAt" IS NOT NULL AND "approvedAt"<"startsAt" AND "unlocksAt"="startsAt"+interval '28 days'))));
CREATE FUNCTION trading_guard_entry_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."syndicateEntryId",NEW."startsAt") IS DISTINCT FROM ROW(OLD."syndicateEntryId",OLD."startsAt") THEN RAISE EXCEPTION 'Syndicate selection is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trading_entry_history BEFORE UPDATE ON "TradingAllocation" FOR EACH ROW EXECUTE FUNCTION trading_guard_entry_history();

-- A stale form cannot open another immediate 33-day allocation.
CREATE OR REPLACE FUNCTION trading_request(uid TEXT,aid TEXT,request_key TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT,terms TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN RETURN 'terms_changed'; END $$;
CREATE OR REPLACE FUNCTION trading_request(uid TEXT,aid TEXT,request_key TEXT,cents INTEGER,coin TEXT,chain TEXT,address TEXT,terms TEXT,entry_id TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE u "User"%ROWTYPE; old "TradingAllocation"%ROWTYPE; outstanding BIGINT; entry "SyndicateEntry"%ROWTYPE;
BEGIN
 SELECT * INTO u FROM "User" WHERE id=uid FOR UPDATE;
 IF u.id IS NULL OR u.status<>'ACTIVE' OR (u."emailVerifiedAt" IS NULL AND auth_email_verification_required()) THEN RETURN 'unverified'; END IF;
 SELECT * INTO old FROM "TradingAllocation" WHERE "requestKey"=request_key;
 IF FOUND THEN
  IF old."userId"=uid AND old."principalCents"=cents AND old.currency=coin AND old.network=chain AND old."payoutAddress"=address AND old."termsVersion"=terms AND old."syndicateEntryId"=entry_id THEN RETURN 'duplicate'; END IF;
  RETURN 'request_conflict';
 END IF;
 PERFORM 1 FROM "TradingProgram" WHERE id='harry' AND "enrollmentEnabled" FOR SHARE;
 IF NOT FOUND THEN RETURN 'closed'; END IF;
 SELECT * INTO entry FROM "SyndicateEntry" WHERE id=entry_id FOR SHARE;
 IF entry.id IS NULL OR NOT entry.accepting OR entry."startsAt"<=clock_timestamp() AT TIME ZONE 'UTC' THEN RETURN 'entry_closed'; END IF;
 IF u."walletFrozen" THEN RETURN 'frozen'; END IF;
 IF cents IS NULL OR cents<50000 OR cents>1000000 OR terms IS DISTINCT FROM 'lunar-v1-2026-10-23' OR request_key IS NULL OR length(request_key)>100 THEN RETURN 'invalid'; END IF;
 IF (coin||':'||chain) NOT IN ('USDT:TRC20','USDT:ERC20','USDC:ERC20') OR coin IS NULL OR chain IS NULL OR address IS NULL OR
  (chain='TRC20' AND address !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$') OR (chain='ERC20' AND (address !~ '^0x[0-9a-fA-F]{40}$' OR address ~ '^0x0{40}$')) THEN RETURN 'invalid_address'; END IF;
 IF EXISTS (SELECT 1 FROM "TradingAllocation" WHERE "userId"=uid AND status='PENDING') THEN RETURN 'pending_exists'; END IF;
 SELECT COALESCE(sum("principalCents"),0) INTO outstanding FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('ACTIVE','PAYOUT_READY');
 IF outstanding+cents>1000000 THEN RETURN 'limit'; END IF;
 IF u."balanceCents"<cents THEN RETURN 'insufficient'; END IF;
 INSERT INTO "TradingAllocation" (id,"userId","requestKey","principalCents",currency,network,"payoutAddress","termsVersion","syndicateEntryId","startsAt","termsSnapshot")
 VALUES (aid,uid,request_key,cents,coin,chain,address,terms,entry.id,entry."startsAt",jsonb_build_object('version',terms,'lockDays',28,'lockBegins','scheduled syndicate start','fundsReserved','from Super Admin approval until scheduled start and maturity','syndicateEntryId',entry.id,'phase',entry.phase,'startsAt',to_char(entry."startsAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'unlocksAt',to_char(entry."startsAt"+interval '28 days','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'trader','Rob','membershipRequired',false,'subscriptionSales','coming soon','targetsNonContractual',true,'targetIsProvisional',true,'guaranteed',false,'lossPossible',true,'compounding','none in this app; no daily accrual','payout','manual external crypto transfer after maturity and actual-result review','fees','operator pays outgoing network fees','valuation','one stablecoin token per USD of accounting credit; no market conversion'));
 PERFORM trading_event(aid,uid,'requested',jsonb_build_object('principalCents',cents,'currency',coin,'network',chain,'payoutAddress',address,'termsVersion',terms,'syndicateEntryId',entry.id,'startsAt',entry."startsAt"));
 RETURN 'requested';
END $$;

CREATE OR REPLACE FUNCTION trading_review(aid TEXT,actor TEXT,approve BOOLEAN,note TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "TradingAllocation"%ROWTYPE; u "User"%ROWTYPE; uid TEXT; stamp TIMESTAMP(3); outstanding BIGINT; entry "SyndicateEntry"%ROWTYPE;
BEGIN
 SELECT "userId" INTO uid FROM "TradingAllocation" WHERE id=aid;
 IF uid IS NULL THEN RETURN 'missing'; END IF;
 PERFORM id FROM "User" WHERE id IN (uid,actor) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=actor AND role='SUPER_ADMIN' AND status='ACTIVE') THEN RETURN 'forbidden'; END IF;
 SELECT * INTO a FROM "TradingAllocation" WHERE id=aid FOR UPDATE;
 IF a.status<>'PENDING' THEN RETURN 'not_pending'; END IF;
 IF approve AND (a."termsVersion"<>'lunar-v1-2026-10-23' OR a."syndicateEntryId" IS NULL) THEN RETURN 'terms_changed'; END IF;
 IF approve IS NULL OR note IS NULL OR length(trim(note))<5 OR length(note)>1000 THEN RETURN 'invalid_note'; END IF;
 stamp := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
 IF approve THEN
  PERFORM 1 FROM "TradingProgram" WHERE id='harry' AND "enrollmentEnabled" FOR SHARE;
  IF NOT FOUND THEN RETURN 'closed'; END IF;
  SELECT * INTO entry FROM "SyndicateEntry" WHERE id=a."syndicateEntryId" FOR SHARE;
  stamp := clock_timestamp() AT TIME ZONE 'UTC';
  IF entry.id IS NULL OR NOT entry.accepting OR entry."startsAt"<=stamp THEN RETURN 'entry_closed'; END IF;
  SELECT * INTO u FROM "User" WHERE id=uid;
  IF u.status<>'ACTIVE' OR (u."emailVerifiedAt" IS NULL AND auth_email_verification_required()) OR u."walletFrozen" THEN RETURN 'unavailable'; END IF;
  IF u."balanceCents"<a."principalCents" THEN RETURN 'insufficient'; END IF;
  SELECT COALESCE(sum("principalCents"),0) INTO outstanding FROM "TradingAllocation" WHERE "userId"=uid AND status IN ('ACTIVE','PAYOUT_READY');
  IF outstanding+a."principalCents">1000000 THEN RETURN 'limit'; END IF;
  UPDATE "TradingAllocation" SET status='ACTIVE',"approvedAt"=stamp,"approvedById"=actor,"unlocksAt"=entry."startsAt"+interval '28 days',"reviewedAt"=stamp,"reviewedById"=actor,"reviewNote"=trim(note) WHERE id=aid;
  INSERT INTO "WalletJournal" (id,"userId","allocationId","operationKey",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents","lockedDeltaCents")
   VALUES ('trading:lock:'||aid,uid,aid,'trading:lock:'||aid,'TRADING_LOCK','Syndicate capital reserved until scheduled start and 28-day maturity',-a."principalCents",0,0,a."principalCents");
 ELSE
  UPDATE "TradingAllocation" SET status='REJECTED',"reviewedAt"=stamp,"reviewedById"=actor,"reviewNote"=trim(note) WHERE id=aid;
 END IF;
 PERFORM trading_event(aid,actor,CASE WHEN approve THEN 'approved' ELSE 'rejected' END,jsonb_build_object('note',trim(note),'principalCents',a."principalCents",'syndicateEntryId',a."syndicateEntryId",'startsAt',a."startsAt",'unlocksAt',CASE WHEN approve THEN entry."startsAt"+interval '28 days' ELSE NULL END));
 RETURN CASE WHEN approve THEN 'approved' ELSE 'rejected' END;
END $$;

CREATE FUNCTION syndicate_set_entry(actor TEXT, entry_id TEXT, enabled BOOLEAN, expected_revision INTEGER, note TEXT, event_id TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE previous "SyndicateEntry"%ROWTYPE; saved "SyndicateEntry"%ROWTYPE;
BEGIN
 PERFORM 1 FROM "User" WHERE id=actor AND role='SUPER_ADMIN' AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RETURN 'forbidden'; END IF;
 IF enabled IS NULL OR length(trim(COALESCE(note,''))) NOT BETWEEN 5 AND 1000 THEN RETURN 'invalid'; END IF;
 SELECT * INTO previous FROM "SyndicateEntry" WHERE id=entry_id FOR UPDATE;
 IF previous.id IS NULL OR previous."startsAt"<=clock_timestamp() AT TIME ZONE 'UTC' THEN RETURN 'entry_closed'; END IF;
 IF previous.revision IS DISTINCT FROM expected_revision THEN RETURN 'stale'; END IF;
 UPDATE "SyndicateEntry" SET accepting=enabled,revision=revision+1,"updatedAt"=CURRENT_TIMESTAMP AT TIME ZONE 'UTC' WHERE id=entry_id RETURNING * INTO saved;
 INSERT INTO "AuditLog"(id,"actorId",action,target,meta) VALUES(event_id,actor,'syndicate.entry_updated',entry_id,jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(saved),'note',trim(note)));
 RETURN 'saved';
END $$;

-- Historical reported summaries retain their original 33-day period.
ALTER TABLE "ClubCycleSummary" ADD COLUMN "lockDays" INTEGER NOT NULL DEFAULT 33 CHECK("lockDays" IN (28,33));
ALTER TABLE "ClubCycleSummary" ALTER COLUMN "lockDays" SET DEFAULT 28;
DROP FUNCTION club_save_cycle_summary(TEXT,TEXT,INTEGER,TEXT,INTEGER,BOOLEAN,TEXT);
CREATE FUNCTION club_save_cycle_summary(actor TEXT, end_day TEXT, bps INTEGER, source_note TEXT, expected_revision INTEGER, publish BOOLEAN, event_id TEXT,days INTEGER DEFAULT 33) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE a "User"%ROWTYPE; previous "ClubCycleSummary"%ROWTYPE; saved "ClubCycleSummary"%ROWTYPE; selected_day DATE;
BEGIN
 SELECT * INTO a FROM "User" WHERE id=actor FOR UPDATE;
 IF a.id IS NULL OR a.status<>'ACTIVE' OR a.role<>'SUPER_ADMIN' THEN RETURN 'forbidden'; END IF;
 IF end_day IS NULL OR end_day !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN 'invalid_day'; END IF;
 BEGIN selected_day:=end_day::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN 'invalid_day'; END;
 IF selected_day<'2000-01-01'::date OR selected_day>(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date+365 THEN RETURN 'invalid_day'; END IF;
 IF days IS NULL OR days NOT IN (28,33) OR bps IS NULL OR bps NOT BETWEEN -10000 AND 100000 OR publish IS NULL OR expected_revision IS NULL OR expected_revision<0
   OR length(trim(COALESCE(source_note,''))) NOT BETWEEN 10 AND 1000 THEN RETURN 'invalid'; END IF;
 SELECT * INTO previous FROM "ClubCycleSummary" WHERE id='harry' FOR UPDATE;
 IF expected_revision=0 THEN
   INSERT INTO "ClubCycleSummary"(id,"endDay","profitBps",published,"sourceNote","updatedById","lockDays") VALUES('harry',selected_day,bps,publish,trim(source_note),actor,days)
     ON CONFLICT DO NOTHING RETURNING * INTO saved;
 ELSE
   UPDATE "ClubCycleSummary" SET "endDay"=selected_day,"profitBps"=bps,"lockDays"=days,published=publish,revision=revision+1,
     "sourceNote"=trim(source_note),"updatedById"=actor,"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
     WHERE id='harry' AND revision=expected_revision RETURNING * INTO saved;
 END IF;
 IF saved.id IS NULL THEN RETURN 'stale'; END IF;
 INSERT INTO "AuditLog"(id,"actorId",action,target,meta) VALUES('cycle-summary:'||event_id,actor,'club.cycle_summary_updated','harry',
   jsonb_build_object('before',CASE WHEN previous.id IS NULL THEN NULL ELSE to_jsonb(previous) END,'after',to_jsonb(saved)));
 RETURN 'saved';
END $$;

