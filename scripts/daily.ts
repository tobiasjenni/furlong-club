import { runDailyJobs } from "../src/lib/daily";
import { db } from "../src/lib/db";

runDailyJobs()
  .then((result) => console.log(JSON.stringify(result)))
  .catch(() => { console.error("Daily maintenance failed. Check database and delivery configuration securely."); process.exitCode = 1; })
  .finally(() => db.$disconnect());
