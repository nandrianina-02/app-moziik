// Intégration MVola (paiement mobile money, marché malgache).
// Basé sur l'API marchande MVola (OAuth client_credentials puis
// transaction de type "merchantpay"). Les identifiants et le
// certificat marchand sont fournis par MVola lors de l'inscription
// professionnelle — à renseigner en variables d'environnement.

const MVOLA_BASE_URL =
  process.env.MVOLA_ENV === "production"
    ? "https://api.mvola.mg"
    : "https://devapi.mvola.mg"; // bac à sable MVola pour les tests

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getMvolaToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const credentials = Buffer.from(
    `${process.env.MVOLA_CONSUMER_KEY}:${process.env.MVOLA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await fetch(`${MVOLA_BASE_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE",
  });

  if (!res.ok) throw new Error("Échec de l'authentification MVola.");
  const data = await res.json();

  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

export async function initiateMvolaPayment({
  amountMGA,
  payerMsisdn, // numéro de téléphone du payeur, format 034/032/033XXXXXXX
  reference,
  callbackUrl,
}: {
  amountMGA: number;
  payerMsisdn: string;
  reference: string;
  callbackUrl: string;
}) {
  const token = await getMvolaToken();

  const res = await fetch(
    `${MVOLA_BASE_URL}/mvola/mm/transactions/type/merchantpay/1.0.0/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Version: "1.0",
        "X-CorrelationID": reference,
        UserLanguage: "FR",
        UserAccountIdentifier: `msisdn;${process.env.MVOLA_MERCHANT_MSISDN}`,
        partnerName: "Moziik",
        "X-Callback-URL": callbackUrl,
      },
      body: JSON.stringify({
        amount: amountMGA.toString(),
        currency: "Ar",
        descriptionText: "Abonnement Moziik",
        requestingOrganisationTransactionReference: reference,
        requestDate: new Date().toISOString(),
        originalTransactionReference: reference,
        debitParty: [{ key: "msisdn", value: payerMsisdn }],
        creditParty: [{ key: "msisdn", value: process.env.MVOLA_MERCHANT_MSISDN }],
      }),
    }
  );

  if (!res.ok) throw new Error("Échec de l'initiation du paiement MVola.");
  return res.json(); // contient serverCorrelationId : à suivre via le callback
}

/**
 * Revérifie le statut réel d'une transaction directement auprès de MVola
 * (plutôt que de faire confiance au contenu d'un webhook entrant, qui
 * n'est pas signé/authentifié par MVola sur cette intégration). À
 * appeler depuis le handler de `/api/webhooks/mvola` avant d'activer un
 * abonnement.
 */
export async function getMvolaTransactionStatus(serverCorrelationId: string): Promise<{
  status: "pending" | "completed" | "failed" | string;
  raw: unknown;
}> {
  const token = await getMvolaToken();

  const res = await fetch(
    `${MVOLA_BASE_URL}/mvola/mm/transactions/type/merchantpay/1.0.0/status/${serverCorrelationId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "1.0",
        "X-CorrelationID": serverCorrelationId,
        UserLanguage: "FR",
        UserAccountIdentifier: `msisdn;${process.env.MVOLA_MERCHANT_MSISDN}`,
        partnerName: "Moziik",
        "Cache-Control": "no-cache",
      },
    }
  );

  if (!res.ok) throw new Error("Échec de la vérification du statut MVola.");
  const data = await res.json();
  return { status: data.status, raw: data };
}
