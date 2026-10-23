import { usd } from "./format";
import type { PortalSnapshot } from "./portal-metrics";

type JourneySnapshot = Pick<PortalSnapshot, "availableCents" | "pendingCount" | "activeCount" | "payoutDueCents" | "pendingDepositCount">;
export type JourneyDeposit = { id: string; status: string } | null;
export type TradingJourney = { stage: number; title: string; description: string; href: string; action: string };

// Guidance only. Approval, eligibility, balances and deadlines remain server enforced.
export function tradingJourney({ snapshot, deposit, frozen, emailReady, accepting }: {
  snapshot: JourneySnapshot; deposit: JourneyDeposit; frozen: boolean; emailReady: boolean; accepting: boolean;
}): TradingJourney {
  if (frozen) return { stage: -1, title: "Your wallet needs a review", description: "Funding and allocation actions are paused. Contact the club before sending any more funds.", href: "/support", action: "Contact support" };
  if (!emailReady) return { stage: -1, title: "Confirm your email first", description: "Confirm your registered email before funding your wallet or requesting an allocation.", href: "/account", action: "Open account settings" };
  if (snapshot.pendingCount > 0) return { stage: 1, title: "Your allocation request is awaiting review", description: "Your request does not reserve funds. Keep enough credit available until Super Admin approval. Check its selected entry and review status in your allocation records.", href: "/allocations#allocations", action: "Review your request" };
  if (snapshot.activeCount > 0) return snapshot.payoutDueCents > 0
    ? { stage: 3, title: "Your recorded payout is awaiting payment", description: "The result is recorded. The club will manually send the amount due to your saved external wallet and record the verified transaction. Maturity alone does not confirm payment.", href: "/allocations#allocations", action: "Track your payout" }
    : { stage: 2, title: "Follow your approved allocation", description: "Your capital is reserved. Your allocation records show its scheduled start, saved maturity and result or payout status. Existing approved locks keep their original dates.", href: "/allocations#allocations", action: "View your allocation" };
  if (!accepting) return { stage: -1, title: "The next entry is not accepting requests", description: "New requests are paused or no future entry is currently open. Your existing records remain available. Check the schedule or contact the club before adding funds for trading.", href: "/support", action: "Ask about the next entry" };
  if (snapshot.availableCents >= 50000) return { stage: 1, title: "Your credit is ready for an allocation request", description: `You have ${usd(snapshot.availableCents)} available. Choose a published moon entry, confirm your external payout wallet and request approval. A deposit alone does not create an allocation.`, href: "/allocations#request", action: "Choose your entry" };
  if (deposit) return deposit.status === "PENDING"
    ? { stage: 0, title: "Finish your deposit request", description: "Open the saved receipt for the exact token, network and address. After sending, report the transaction ID there. If you already sent it, do not send it again.", href: `/deposits/${encodeURIComponent(deposit.id)}`, action: "Open your deposit receipt" }
    : { stage: 0, title: "Your deposit is awaiting verification", description: "Your reported transfer is being reviewed. Credit becomes available after Super Admin verifies receipt. Do not send the same payment again.", href: `/deposits/${encodeURIComponent(deposit.id)}`, action: "Track your deposit" };
  if (snapshot.pendingDepositCount > 0) return { stage: 0, title: "Check your pending deposits", description: "A pending deposit is not available credit. Open your wallet to report a transfer or check its review status before creating another request.", href: "/wallet", action: "Review your deposits" };
  return { stage: 0, title: snapshot.availableCents > 0 ? "Top up to the allocation minimum" : "Start with your club wallet", description: `An allocation needs at least $500 in approved credit. You have ${usd(snapshot.availableCents)} available and need ${usd(50000 - snapshot.availableCents)} more. Create a deposit request, then send and report your transfer for review.`, href: "/wallet?for=trading#add-funds", action: "Fund your allocation" };
}
