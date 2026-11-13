import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useSession } from "../session";
import { Bouton, Carte, Champ, EnTete } from "../composants";

export function Reglages() {
  const { site, changerSite, etat } = useSession();
  const [saisi, setSaisi] = useState(site);
  const [version, setVersion] = useState("");
  useEffect(() => {
    void window.bureau.version().then(setVersion);
  }, []);
  const utilisateur = etat.phase === "connecte" ? etat.utilisateur : null;

  return (
    <>
      <EnTete titre="Réglages" />
      <div className="grid max-w-[720px] gap-4">
        <Carte titre="Site administré">
          <p className="mb-3 text-[13px] text-texte-2">
            L'adresse du site Moziik auquel ce logiciel se connecte. La changer ferme la session : les comptes ne sont pas les mêmes d'un site à l'autre.
          </p>
          <div className="flex items-end gap-2">
            <Champ libelle="Adresse" value={saisi} onChange={(e) => setSaisi(e.target.value)} className="flex-1" />
            <Bouton variante="trait" disabled={saisi.trim().replace(/\/+$/, "") === site} onClick={() => void changerSite(saisi)}>
              Enregistrer
            </Bouton>
          </div>
        </Carte>
        <Carte titre="Compte">
          <p className="text-[13px]">
            {utilisateur?.name} <span className="text-texte-3">({utilisateur?.email})</span>
          </p>
          <p className="mt-1 text-[12px] text-texte-3">La session reste ouverte sur ce PC, chiffrée par Windows pour votre compte utilisateur. Déconnectez-vous depuis la barre latérale sur un PC partagé.</p>
        </Carte>
        <Carte titre="À propos">
          <p className="text-[13px]">Moziik Admin {version}</p>
          <p className="mt-1 text-[12px] text-texte-3">Construit par GitHub Actions. Les fonctions qui ne sont pas encore ici restent accessibles sur le site.</p>
          <div className="mt-3 flex gap-3 text-[13px]">
            <button onClick={() => void window.bureau.ouvrirExterne(`${site}/admin`)} className="inline-flex items-center gap-1 text-accent hover:underline">
              Administration du site <ExternalLink size={13} />
            </button>
            <button onClick={() => void window.bureau.ouvrirExterne("https://github.com/nandrianina-02/app-moziik/releases")} className="inline-flex items-center gap-1 text-accent hover:underline">
              Versions <ExternalLink size={13} />
            </button>
          </div>
        </Carte>
      </div>
    </>
  );
}
