/**
 * Lit une réponse NDJSON (une ligne = un objet JSON) et remet chaque objet
 * au fur et à mesure, sans attendre la fin de la réponse.
 *
 * Le découpage se fait sur le tampon accumulé, pas sur chaque bloc reçu :
 * rien ne garantit qu'un bloc réseau se termine sur une fin de ligne, une
 * ligne peut donc arriver coupée en deux. `decode(..., { stream: true })`
 * traite le même problème au niveau des octets, pour les caractères
 * multi-octets (accents) coupés entre deux blocs.
 */
export async function readNdjson<T>(response: Response, onEvent: (event: T) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Flux non pris en charge par ce navigateur.");

  const decoder = new TextDecoder();
  let buffer = "";

  function flushLines(final: boolean) {
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as T);
      newline = buffer.indexOf("\n");
    }
    // Dernière ligne éventuellement non terminée par un saut de ligne.
    if (final) {
      const rest = buffer.trim();
      buffer = "";
      if (rest) onEvent(JSON.parse(rest) as T);
    }
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushLines(false);
  }

  buffer += decoder.decode();
  flushLines(true);
}
