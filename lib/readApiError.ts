/**
 * Extrait le message d'erreur d'une réponse API pour l'afficher à
 * l'utilisateur.
 *
 * Quand le serveur n'a pas su être plus précis (500), il joint le type de
 * l'erreur et une référence courte que l'on retrouve dans ses logs (voir
 * lib/apiError.ts) : les afficher est ce qui permet de relier un incident
 * signalé par un utilisateur à sa trace serveur. Sans cela, « Une erreur
 * inattendue est survenue » ne menait nulle part.
 */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as
    | { error?: string; code?: string; ref?: string }
    | null;

  if (!data?.error) return `${fallback} (HTTP ${res.status})`;
  if (data.code && data.ref) return `${data.error} [${data.code} · réf. ${data.ref}]`;
  return data.error;
}
