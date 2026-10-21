import { z } from "zod";

export const passwordSchema = z.string().min(10, "Password must be at least 10 characters").max(72, "Password is too long")
  .refine(value => new TextEncoder().encode(value).length <= 72, "Password is too long. Please use a shorter passphrase.");

export const newPasswordSchema = z.object({
  password: passwordSchema,
  passwordConfirm: z.string({ required_error: "Please confirm your password" }).min(1, "Please confirm your password"),
}).refine(value => value.password === value.passwordConfirm, {
  path: ["passwordConfirm"], message: "Passwords do not match. Enter the same password again.",
});
