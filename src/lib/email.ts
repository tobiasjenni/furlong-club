import { appUrl, brand } from "./config";

export type Email = { to: string; subject: string; text: string; html: string };

// EMAIL_PROVIDER=console prints emails to the server log (development). EMAIL_PROVIDER=resend sends through Resend.
export async function sendEmail(email: Email) {
  // Resend is used as soon as its key is configured; otherwise emails are only logged.
  const provider = process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "console");
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      // Replies to any site email land in the support inbox.
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? `${brand.name} <no-reply@${brand.domain}>`, reply_to: brand.supportEmail, ...email }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured");
  console.log(`\n[email] to=${email.to} subject="${email.subject}"\n${email.text}\n`);
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(heading: string, body: string, cta?: { href: string; label: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${escape(cta.href)}" style="background:#e9c46a;color:#06140f;padding:12px 22px;border-radius:999px;font-weight:600;text-decoration:none">${escape(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#06140f;font-family:Arial,sans-serif;color:#f6f1e7">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:18px;font-weight:bold;color:#e9c46a">${escape(brand.name)}</p>
<h1 style="font-size:22px">${escape(heading)}</h1>
<p style="line-height:1.6;color:#d8d2c4">${escape(body)}</p>${button}
<p style="font-size:12px;color:#8a9a90;margin-top:32px">18+ only. Betting carries risk. Help: GamCare</p>
</div></body></html>`;
}

export function verifyEmailMessage(to: string, token: string): Email {
  const link = `${appUrl}/verify-email?token=${token}`;
  const body = "Please confirm your email address to finish setting up your account. The link is valid for 24 hours.";
  return { to, subject: `Confirm your email for ${brand.name}`, text: `${body}\n\n${link}`, html: layout("Confirm your email", body, { href: link, label: "Confirm email" }) };
}

export function resetPasswordMessage(to: string, token: string): Email {
  const link = `${appUrl}/reset-password?token=${token}`;
  const body = "Someone asked to reset the password for this account. If that was you, use the link below within the next hour. If not, you can ignore this email.";
  return { to, subject: `Reset your ${brand.name} password`, text: `${body}\n\n${link}`, html: layout("Reset your password", body, { href: link, label: "Choose a new password" }) };
}

export function renewalReminderMessage(to: string, planName: string, endsAt: Date, planSlug: string): Email {
  const link = `${appUrl}/checkout/${planSlug}`;
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(endsAt);
  const body = `Your ${planName} access ends on ${when}. Plans don't renew automatically, so if you'd like to keep watching, you can extend it for another period.`;
  return { to, subject: `Your ${planName} access ends on ${when}`, text: `${body}\n\n${link}`, html: layout("Your plan is ending soon", body, { href: link, label: `Extend ${planName}` }) };
}

export function inviteMessage(to: string, token: string): Email {
  const link = `${appUrl}/reset-password?token=${token}`;
  const body = `You've been given a ${brand.name} account. Choose a password to sign in. The link is valid for 3 days.`;
  return { to, subject: `Your ${brand.name} account is ready`, text: `${body}\n\n${link}`, html: layout("Welcome to the club", body, { href: link, label: "Choose a password" }) };
}

export function emailDelivers() {
  return Boolean(process.env.RESEND_API_KEY) && process.env.EMAIL_PROVIDER !== "console";
}

export function passwordChangedMessage(to: string): Email {
  const body = `The password for your ${brand.name} account was just changed. If this wasn't you, reset your password straight away and contact ${brand.supportEmail}.`;
  return { to, subject: "Your password was changed", text: body, html: layout("Your password was changed", body) };
}
