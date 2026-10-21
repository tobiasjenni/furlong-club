export type AccountRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export const isAdmin = (role: string | undefined) => role === "ADMIN" || role === "SUPER_ADMIN";
export const canManageUser = (actor: { id: string; role: string }, target: { id: string; role: string }) =>
  actor.id !== target.id && target.role !== "SUPER_ADMIN" &&
  (actor.role === "SUPER_ADMIN" || (actor.role === "ADMIN" && target.role === "USER"));
export const roleLabel = (role: string) => role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Admin" : "Member";
