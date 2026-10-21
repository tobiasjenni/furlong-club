BEGIN;
ALTER TABLE "Plan" ALTER COLUMN "intervalDays" SET DEFAULT 33;
-- Change the current offer, preserving historical subscriptions and payment snapshots.
INSERT INTO "AuditLog" (id,action,target,meta)
 SELECT 'membership-33-days:'||id,'plan.period_updated',id,
 jsonb_build_object('previousDays',"intervalDays",'newDays',33,'reason','Owner requested 33-day membership periods')
 FROM "Plan" WHERE "priceCents">0 AND "intervalDays"=30;
UPDATE "Plan" SET "intervalDays"=33 WHERE "priceCents">0 AND "intervalDays"=30;

-- Refresh untouched starter copy only. Preserve custom names, prices and benefits.
UPDATE "Plan" SET features=ARRAY['Free member dashboard','Video catalogue previews','Optional club updates']
 WHERE slug='paddock' AND features=ARRAY['Intro videos with Harry','Glossary of racing terms','Weekly newsletter'];
UPDATE "Plan" SET tagline='Build your racing foundations' WHERE slug='form' AND tagline='The full training library';
UPDATE "Plan" SET features=ARRAY['Everything in Paddock','Form and race-card lessons','Going, draw and staking discipline','Access to published Form Room videos']
 WHERE slug='form' AND features=ARRAY['Everything in Paddock','Full training video library','Weekly race-card breakdowns','Reading the form & going'];
UPDATE "Plan" SET tagline='Go deeper into race-day analysis' WHERE slug='inner-circle' AND tagline='Daily tips and live sessions';
UPDATE "Plan" SET features=ARRAY['Everything in Form Room','Published Inner Circle race-day videos','Detailed race-card analysis','One-off access with no automatic renewal']
 WHERE slug='inner-circle' AND features=ARRAY['Everything in Form Room','Daily race-day tip videos','Monthly live Q&A','Early access to new series'];
COMMIT;
