export function assertExistingOwner(user: { role: string; status: string } | null) {
  if (user && (user.role !== "SUPER_ADMIN" || user.status !== "ACTIVE")) {
    throw new Error("Owner setup blocked: the configured email already belongs to an account that is not the active Super Admin. Use the verified owner recovery process; setup cannot grant privileges to an existing account.");
  }
}
