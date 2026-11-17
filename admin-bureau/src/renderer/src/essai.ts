import { decoder, encoderVersions } from "./encodage";

/**
 * Essai de l'encodeur dans le logiciel construit, lancé par l'intégration
 * continue : la page est chargée depuis le disque (file://) comme chez
 * l'utilisateur, ce qui est justement ce qui peut empêcher un worker de
 * démarrer. On fabrique deux secondes de son, on les décode et on les
 * encode dans les trois qualités ; le résultat part dans le titre de la
 * page, que le processus principal lit.
 */
export async function essaiEncodage() {
  try {
    const source = sinusWav(2, 44_100);
    const canaux = await decoder(source);
    const versions = await encoderVersions(canaux);
    const tailles = Object.entries(versions).map(([q, b]) => `${q} ${b.size} o`);
    const vides = Object.values(versions).some((b) => b.size < 1000);
    document.title = `${vides ? "ECHEC" : "OK"}|encodage : ${tailles.join(", ")}`;
  } catch (e) {
    document.title = `ECHEC|encodage : ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Un WAV stéréo 16 bits : un la à 440 Hz, assez pour exercer décodeur et encodeur. */
function sinusWav(secondes: number, frequence: number): Blob {
  const n = secondes * frequence;
  const donnees = new DataView(new ArrayBuffer(44 + n * 4));
  const texte = (pos: number, s: string) => [...s].forEach((c, i) => donnees.setUint8(pos + i, c.charCodeAt(0)));
  texte(0, "RIFF");
  donnees.setUint32(4, 36 + n * 4, true);
  texte(8, "WAVE");
  texte(12, "fmt ");
  donnees.setUint32(16, 16, true);
  donnees.setUint16(20, 1, true);
  donnees.setUint16(22, 2, true);
  donnees.setUint32(24, frequence, true);
  donnees.setUint32(28, frequence * 4, true);
  donnees.setUint16(32, 4, true);
  donnees.setUint16(34, 16, true);
  texte(36, "data");
  donnees.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / frequence) * 0.5 * 0x7fff);
    donnees.setInt16(44 + i * 4, v, true);
    donnees.setInt16(46 + i * 4, v, true);
  }
  return new Blob([donnees.buffer], { type: "audio/wav" });
}
