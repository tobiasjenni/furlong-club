BEGIN;
-- Update the current offer without changing prices, periods or purchased access.
INSERT INTO "AuditLog" (id,action,target,meta)
 SELECT 'trading-membership-feature:'||id,'plan.benefits_updated',id,
 jsonb_build_object('previousTagline',tagline,'previousFeatures',features,
   'addedFeature','Planned Trading with Harry access',
   'reason','Owner made Trading with Harry the main planned paid membership benefit; allocations remain separate and enrollment remains closed')
 FROM "Plan" WHERE slug IN ('form','inner-circle')
 AND NOT (features @> ARRAY['Planned Trading with Harry access']);

UPDATE "Plan" SET features=array_prepend('Planned Trading with Harry access',features)
 WHERE slug IN ('form','inner-circle')
 AND NOT (features @> ARRAY['Planned Trading with Harry access']);
UPDATE "Plan" SET tagline='Trading with Harry at the heart of your membership'
 WHERE slug='form' AND tagline IN ('Build your racing foundations','The full training library');
COMMIT;
