import "server-only";
import { cookies } from "next/headers";
import { CLUB_COOKIE, clubGateEnabled, verifyClubAdmission } from "./club-gate";

// Signup must enforce invitation itself: Next server actions can also be posted
// to the public login URL, whose password/recovery flows intentionally stay open.
export async function hasClubInvitation() {
  if (!clubGateEnabled()) return true;
  return verifyClubAdmission((await cookies()).get(CLUB_COOKIE)?.value);
}
