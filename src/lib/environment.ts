// A public test Worker must opt in explicitly; normal production builds never allow simulated money.
export function walletTestMode() {
  return process.env.APP_ENV === "staging" && process.env.ENABLE_TEST_PAYMENTS === "true" && process.env.PAYMENT_PROVIDER === "mock";
}
