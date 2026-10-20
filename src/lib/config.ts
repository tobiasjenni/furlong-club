export const brand = {
  name: "Furlong Club",
  domain: "furlong.club",
  // The site's host: a fictional character with an AI-generated portrait.
  host: { first: "Harry", name: "Harry Whitcombe", page: "/meet-harry" },
  supportEmail: "support@furlong.club",
};

export const walletEnabled = process.env.WALLET_ENABLED === "true";

export const appUrl = process.env.APP_URL ?? "http://localhost:3000";

// Stablecoins and networks offered at checkout. Keep in sync with the provider's supported list.
export const checkoutOptions = [
  { currency: "USDC", network: "POLYGON", label: "USDC · Polygon" },
  { currency: "USDT", network: "TRC20", label: "USDT · Tron (TRC-20)" },
  { currency: "USDT", network: "ERC20", label: "USDT · Ethereum (ERC-20)" },
  { currency: "USDC", network: "ERC20", label: "USDC · Ethereum (ERC-20)" },
] as const;

export type CheckoutOption = (typeof checkoutOptions)[number];
