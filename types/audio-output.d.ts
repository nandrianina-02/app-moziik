/**
 * `AudioContext.setSinkId()` n'est pas encore décrit dans lib.dom.d.ts
 * (TypeScript 5.5) alors que Chrome/Edge 110+ l'implémentent.
 *
 * À ne pas confondre avec `HTMLMediaElement.setSinkId()`, lui bien typé :
 * dès qu'un `<audio>` est branché sur un `createMediaElementSource()` —
 * ce que fait notre égaliseur (voir components/player/hooks/useAudioEngine.ts) —
 * son signal sort par l'AudioContext, et le sinkId de l'élément est ignoré.
 * C'est donc bien cette API-ci qui pilote la sortie audio de Moziik.
 *
 * Méthode déclarée optionnelle : elle est absente sur Firefox et Safari,
 * il faut tester sa présence avant tout appel.
 */
interface AudioSinkOptions {
  type: "none";
}

interface AudioContext {
  readonly sinkId?: string | AudioSinkOptions;
  setSinkId?(sinkId: string | AudioSinkOptions): Promise<void>;
}
