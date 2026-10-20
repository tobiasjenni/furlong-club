import { runDailyJobs } from "../src/lib/daily";
import { db } from "../src/lib/db";

runDailyJobs()
  .then((result) => console.log(JSON.stringify(result)))
  .finally(() => db.$disconnect());
