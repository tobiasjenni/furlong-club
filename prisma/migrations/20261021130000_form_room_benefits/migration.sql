BEGIN;
-- Owner-requested offer copy; purchased access, price and period remain unchanged.
INSERT INTO "AuditLog" (id,action,target,meta)
 SELECT 'form-room-benefits-v2:'||id,'plan.benefits_updated',id,
 jsonb_build_object('previousFeatures',features,'newFeatures',ARRAY['Everything in Paddock','Form and race-card lessons','Trading with Harry'],
 'reason','Owner requested these three Form Room benefits; separate allocation and enrollment terms are unchanged')
 FROM "Plan" WHERE slug='form' AND features IS DISTINCT FROM ARRAY['Everything in Paddock','Form and race-card lessons','Trading with Harry'];
UPDATE "Plan" SET features=ARRAY['Everything in Paddock','Form and race-card lessons','Trading with Harry']
 WHERE slug='form' AND features IS DISTINCT FROM ARRAY['Everything in Paddock','Form and race-card lessons','Trading with Harry'];
COMMIT;
