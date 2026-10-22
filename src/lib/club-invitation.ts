import "server-only";
import { cookies, headers } from "next/headers";
import { CLUB_COOKIE, clubGateEnabled, verifyClubAdmission } from "./club-gate";
import { clubNetworkKey } from "./club-network";
import { clubNetworkAdmitted } from "./club-network-store";

// Signup must enforce invitation itself: Next server actions can also be posted
// to the public login URL, whose password/recovery flows intentionally stay open.
export async function hasClubInvitation() {
  const admitted = await verifyClubAdmission((await cookies()).get(CLUB_COOKIE)?.value);
  if (!clubGateEnabled()) return true;
  if (admitted) return true;
  const network = await clubNetworkKey(await headers());
  return network ? clubNetworkAdmitted(network) : false;
}
