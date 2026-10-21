import { z } from "zod";
import bcrypt from "bcryptjs";

// bcrypt otherwise silently accepts a suffix after its 72-byte input limit.
export async function matchesPassword(value: string, hash: string) {
  return value.length > 0 && value.length <= 72 && new TextEncoder().encode(value).length <= 72
    && await bcrypt.compare(value, hash);
}

export const passwordSchema = z.string().min(15, "Password must be at least 15 characters").max(72, "Password is too long")
  .refine(value => new TextEncoder().encode(value).length <= 72, "Password is too long. Please use a shorter passphrase.");

export const newPasswordSchema = z.object({
  password: passwordSchema,
  passwordConfirm: z.string({ required_error: "Please confirm your password" }).min(1, "Please confirm your password"),
}).refine(value => value.password === value.passwordConfirm, {
  path: ["passwordConfirm"], message: "Passwords do not match. Enter the same password again.",
});
