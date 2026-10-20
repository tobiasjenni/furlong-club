import { db } from "../src/lib/db";
import { reconcileRecentPayments } from "../src/lib/payments";

reconcileRecentPayments().then(result => {
  console.log(result);
  if (result.failed) process.exitCode = 1;
}).catch(() => {
  console.error("Payment reconciliation failed"); process.exitCode = 1;
}).finally(() => db.$disconnect());
