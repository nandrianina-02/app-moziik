import nodemailer from "nodemailer";
import { defaultSiteConfig } from "@/config/site";
import { getSiteConfig } from "@/lib/siteConfig";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Lit le nom du site et l'email de support depuis la config admin
 * (`/admin/parametres`) plutôt que les valeurs figées de `config/site.ts` :
 * sans ça, un changement de nom/email de support n'apparaissait jamais
 * dans les emails envoyés. Repli sur les valeurs par défaut si la config
 * n'est pas encore initialisée ou si la base est injoignable.
 */
async function getEmailIdentity() {
  try {
    const config = await getSiteConfig();
    return {
      siteName: config.siteName || defaultSiteConfig.siteName,
      supportEmail: config.supportEmail || defaultSiteConfig.supportEmail,
    };
  } catch {
    return { siteName: defaultSiteConfig.siteName, supportEmail: defaultSiteConfig.supportEmail };
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const { siteName, supportEmail } = await getEmailIdentity();
  await transporter.sendMail({
    from: `"${siteName}" <${supportEmail}>`,
    to,
    subject: "Réinitialise ton mot de passe",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Réinitialisation de mot de passe</h2>
        <p>Tu as demandé à réinitialiser ton mot de passe ${siteName}.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#FF6B4A;color:#fff;border-radius:8px;text-decoration:none;">
          Choisir un nouveau mot de passe
        </a></p>
        <p>Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const { siteName, supportEmail } = await getEmailIdentity();
  await transporter.sendMail({
    from: `"${siteName}" <${supportEmail}>`,
    to,
    subject: `Confirme ton adresse email — ${siteName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Bienvenue sur ${siteName} !</h2>
        <p>Confirme ton adresse email pour activer ton compte et pouvoir te connecter.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#FF6B4A;color:#fff;border-radius:8px;text-decoration:none;">
          Confirmer mon adresse email
        </a></p>
        <p>Ce lien expire dans 24 heures. Si tu n'es pas à l'origine de cette inscription, ignore cet email.</p>
      </div>
    `,
  });
}
