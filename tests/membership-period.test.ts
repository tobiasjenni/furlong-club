import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("updates current 30-day paid offers while preserving custom periods and purchased access",async()=>{
  const pg=new PGlite();
  try {
    for(const dir of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)&&n<'20261021060000').sort()) await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8'));
    await pg.exec(`INSERT INTO "User"(id,email,"passwordHash","ageConfirmedAt","updatedAt") VALUES('member','member@example.com','hash',now(),now());
      INSERT INTO "Plan"(id,slug,name,tagline,"priceCents",tier,features,"intervalDays") VALUES('standard','standard','Custom name','Custom copy',4200,1,ARRAY['Custom feature'],30),('custom','custom','Custom','Custom',8900,2,ARRAY['Custom'],90);
      INSERT INTO "Subscription"(id,"userId","planId","endsAt",source) VALUES('historic','member','standard','2026-12-01T00:00:00','payment');`);
    await pg.exec(fs.readFileSync('prisma/migrations/20261021060000_membership_33_days/migration.sql','utf8'));
    const plans=(await pg.query<{id:string;intervalDays:number;priceCents:number;features:string[]}>(`SELECT id,"intervalDays","priceCents",features FROM "Plan" ORDER BY id`)).rows;
    expect(plans).toEqual([{id:'custom',intervalDays:90,priceCents:8900,features:['Custom']},{id:'standard',intervalDays:33,priceCents:4200,features:['Custom feature']}]);
    expect((await pg.query<{ends:string}>(`SELECT "endsAt"::text AS ends FROM "Subscription" WHERE id='historic'`)).rows[0].ends).toBe('2026-12-01 00:00:00');
    await pg.exec(`INSERT INTO "Plan"(id,slug,name,tagline,"priceCents",tier,features) VALUES('new','new','New','New',2900,1,ARRAY['New']);`);
    expect((await pg.query<{days:number}>(`SELECT "intervalDays" AS days FROM "Plan" WHERE id='new'`)).rows[0].days).toBe(33);
  } finally { await pg.close(); }
},30000);
