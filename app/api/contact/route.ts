import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSiteConfig } from "@/lib/siteConfig";
import { withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { parseOrThrow, contactSchema } from "@/lib/validation";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export const POST = withApiErrors(async (req: Request) => {
  // 5 messages max / 15 min / IP : limite le spam du formulaire de
  // contact (et donc l'abus de la boîte mail configurée).
  checkRateLimitByIp("contact", { limit: 5, windowMs: 15 * 60 * 1000 });

  const { name, email, subject, message, attachmentUrl } = parseOrThrow(contactSchema, await req.json());

  const config = await getSiteConfig();

  await transporter.sendMail({
    from: `"${config.siteName} — Contact" <${config.supportEmail}>`,
    to: config.supportEmail,
    replyTo: email,
    subject: subject ? `[${subject}] Nouveau message de contact — ${name}` : `Nouveau message de contact — ${name}`,
    html: `
      <div style="font-family: sans-serif;">
        <p><strong>De :</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
        ${subject ? `<p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>` : ""}
        <p><strong>Message :</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
        ${attachmentUrl ? `<p><strong>Pièce jointe :</strong> <a href="${escapeHtml(attachmentUrl)}">${escapeHtml(attachmentUrl)}</a></p>` : ""}
      </div>
    `,
  });

  return NextResponse.json({ message: "Message envoyé." });
});

// Zod valide déjà le format email et la longueur des champs (ce qui
// couvre l'essentiel du risque d'injection d'en-têtes SMTP), mais on
// échappe en plus le HTML injecté dans le corps de l'email pour éviter
// qu'un message contenant `<script>` ou des balises ne s'affiche de
// façon inattendue dans le client mail de destination.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
