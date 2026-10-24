import { Prisma } from '@prisma/client';

export const depositHistoryStatuses = {
  CONFIRMED: 'Confirmed deposits', unfinished: 'Unfinished requests', all: 'All requests', CONFIRMING: 'Awaiting review',
  PENDING: 'Awaiting transfer', PARTIAL: 'Needs review', FAILED: 'Rejected / cancelled / failed', EXPIRED: 'Expired',
} as const;
export type DepositHistoryStatus = keyof typeof depositHistoryStatuses;
export type AdminDeposit = {
  id: string; userId: string; name: string | null; email: string; amountCents: number; currency: string; network: string;
  status: string; providerStatus: string | null; createdAt: string; submittedAt: string | null; confirmedAt: string | null;
  transactionHash: string | null; creditCents: number | null; correctionCents: number;
};
export type DepositSummary = {
  confirmedCount: number; depositCents: number; correctionCents: number; creditCents: number;
  reviewCount: number; reviewCents: number; pendingCount: number; pendingCents: number;
};
export type AdminDepositPage = { total: number; reviewCount: number; historyCount: number; summary: DepositSummary; rows: AdminDeposit[] };

export function adminDepositsQuery(view: 'review' | 'history', search: string, status: DepositHistoryStatus, page: number) {
  const pattern = `%${search.replace(/[\\%_]/g, c => '\\' + c)}%`;
  const condition = view === 'review' ? Prisma.sql`provider='manual' AND status='CONFIRMING'`
    : Prisma.sql`(${status}='all' OR status::text=${status} OR (${status}='unfinished' AND status IN ('PENDING','CONFIRMING','PARTIAL')))`;
  const order = view === 'review' ? Prisma.sql`"submittedAt" ASC NULLS LAST,id ASC` : Prisma.sql`"createdAt" DESC,id DESC`;
  return Prisma.sql`WITH scope AS (
    SELECT p.id,p."userId",u.name,u.email,p."amountCents",p.currency,p.network,p.status,p.provider,p."providerStatus",
      p."createdAt",p."submittedAt",p."confirmedAt",COALESCE(p."payinHash",p."submittedTxHash") AS hash
    FROM "Payment" p JOIN "User" u ON u.id=p."userId" WHERE p.purpose='WALLET_TOPUP'
      AND (${view}='review' OR ${search}='' OR u.name ILIKE ${pattern} OR u.email ILIKE ${pattern}
        OR p.id ILIKE ${pattern} OR p."payinHash" ILIKE ${pattern} OR p."submittedTxHash" ILIKE ${pattern})
  ), matches AS (SELECT * FROM scope WHERE ${condition}),
  selected AS (SELECT * FROM matches ORDER BY ${order} LIMIT 25 OFFSET ${(page-1)*25}),
  postings AS (
    SELECT COALESCE(sum(j."userDeltaCents") FILTER (WHERE j.kind IN ('TOPUP','MANUAL_TOPUP')),0) AS deposited,
      COALESCE(sum(j."userDeltaCents") FILTER (WHERE j.kind='ADMIN_ADJUSTMENT'),0) AS corrected,
      COALESCE(sum(j."userDeltaCents"),0) AS credited
    FROM "WalletJournal" j JOIN scope s ON s.id=j."paymentId"
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM matches),
    'reviewCount',(SELECT count(*) FROM "Payment" WHERE purpose='WALLET_TOPUP' AND provider='manual' AND status='CONFIRMING'),
    'historyCount',(SELECT count(*) FROM "Payment" WHERE purpose='WALLET_TOPUP'),
    'summary',jsonb_build_object(
      'confirmedCount',(SELECT count(*) FROM scope WHERE status='CONFIRMED'),
      'depositCents',(SELECT deposited FROM postings),'correctionCents',(SELECT corrected FROM postings),
      'creditCents',(SELECT credited FROM postings),
      'reviewCount',(SELECT count(*) FROM scope WHERE status IN ('CONFIRMING','PARTIAL')),
      'reviewCents',(SELECT COALESCE(sum("amountCents"),0) FROM scope WHERE status IN ('CONFIRMING','PARTIAL')),
      'pendingCount',(SELECT count(*) FROM scope WHERE status='PENDING'),
      'pendingCents',(SELECT COALESCE(sum("amountCents"),0) FROM scope WHERE status='PENDING')),
    'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'userId',m."userId",'name',m.name,'email',m.email,
      'amountCents',m."amountCents",'currency',m.currency,'network',m.network,'status',m.status,'providerStatus',m."providerStatus",
      'createdAt',to_char(m."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'submittedAt',to_char(m."submittedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'confirmedAt',to_char(m."confirmedAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'transactionHash',m.hash,
      'creditCents',(SELECT sum(j."userDeltaCents") FROM "WalletJournal" j WHERE j."paymentId"=m.id),
      'correctionCents',(SELECT COALESCE(sum(j."userDeltaCents"),0) FROM "WalletJournal" j WHERE j."paymentId"=m.id AND j.kind='ADMIN_ADJUSTMENT')
    ) ORDER BY ${order}) FROM selected m),'[]'::jsonb)) AS data`;
}

export function adminDepositStatus(payment: Pick<AdminDeposit, 'status' | 'providerStatus'>) {
  if (payment.status === 'CONFIRMED') return 'Credited';
  if (payment.status === 'PENDING') return 'Awaiting transfer · no credit';
  if (payment.status === 'FAILED' && payment.providerStatus === 'cancelled') return 'Cancelled';
  if (payment.status === 'FAILED' && payment.providerStatus === 'admin_rejected') return 'Rejected';
  if (payment.status === 'FAILED') return 'Not completed';
  return depositHistoryStatuses[payment.status as DepositHistoryStatus] ?? 'Needs review';
}
