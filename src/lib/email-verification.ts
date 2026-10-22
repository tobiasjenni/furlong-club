// Email ownership stays unconfirmed when the owner temporarily pauses verification.
// Missing configuration keeps verification required.
export function emailVerificationRequired() {
  return process.env.EMAIL_VERIFICATION_REQUIRED !== "false";
}

export function memberEmailReady(confirmedAt: Date | null) {
  return Boolean(confirmedAt) || !emailVerificationRequired();
}
