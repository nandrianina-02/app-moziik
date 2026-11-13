import { useEffect, useState, type FormEvent } from "react";
import { Activity, FolderInput, Library, LogOut, Settings, ShieldCheck, Users } from "lucide-react";
import { FournisseurSession, useSession } from "./session";
import { Bouton, Champ, Chargement, Erreur } from "./composants";
import { TableauDeBord } from "./ecrans/TableauDeBord";
import { Import } from "./ecrans/Import";
import { Catalogue } from "./ecrans/Catalogue";
import { Moderation } from "./ecrans/Moderation";
import { Comptes } from "./ecrans/Comptes";
import { Reglages } from "./ecrans/Reglages";
import clsx from "./clsx";

type Page = "tableau" | "import" | "catalogue" | "moderation" | "comptes" | "reglages";

const PAGES: { cle: Page; libelle: string; icone: typeof Activity }[] = [
  { cle: "tableau", libelle: "Tableau de bord", icone: Activity },
  { cle: "import", libelle: "Importer", icone: FolderInput },
  { cle: "catalogue", libelle: "Catalogue", icone: Library },
  { cle: "moderation", libelle: "Modération", icone: ShieldCheck },
  { cle: "comptes", libelle: "Comptes", icone: Users },
];

export function App() {
  return (
    <FournisseurSession>
      <Racine />
    </FournisseurSession>
  );
}

function Racine() {
  const { etat } = useSession();
  if (etat.phase === "demarrage") return <div className="grid h-full place-items-center"><Chargement texte="Ouverture de la session" /></div>;
  if (etat.phase === "deconnecte") return <Connexion message={etat.message} />;
  return <Coquille />;
}

function Connexion({ message }: { message?: string }) {
  const { ouvrir, site, changerSite } = useSession();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(message ?? null);
  const [enCours, setEnCours] = useState(false);
  const [reglerSite, setReglerSite] = useState(false);
  const [siteSaisi, setSiteSaisi] = useState(site);
  useEffect(() => setSiteSaisi(site), [site]);

  async function valider(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await ouvrir(email.trim(), motDePasse);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="grid h-full place-items-center p-6">
      <form onSubmit={valider} className="animate-monter w-[360px] space-y-4">
        <div>
          <div className="text-[22px] font-semibold tracking-tight">Moziik Admin</div>
          <p className="mt-1 text-[13px] text-texte-2">Connectez-vous avec votre compte administrateur du site.</p>
        </div>
        <Champ libelle="Adresse e-mail" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        <Champ libelle="Mot de passe" type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
        <Erreur message={erreur} />
        <Bouton type="submit" enCours={enCours} disabled={!email || !motDePasse} className="w-full justify-center">
          Se connecter
        </Bouton>
        <div className="text-[12px] text-texte-3">
          {reglerSite ? (
            <div className="flex items-end gap-2">
              <Champ libelle="Adresse du site" value={siteSaisi} onChange={(e) => setSiteSaisi(e.target.value)} className="flex-1" />
              <Bouton variante="trait" onClick={() => void changerSite(siteSaisi).then(() => setReglerSite(false))}>
                Enregistrer
              </Bouton>
            </div>
          ) : (
            <>
              Site : {site} ·{" "}
              <button type="button" className="underline hover:text-texte" onClick={() => setReglerSite(true)}>
                changer
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function Coquille() {
  const { etat, fermer, site } = useSession();
  const [page, setPage] = useState<Page>("tableau");
  const [version, setVersion] = useState("");
  useEffect(() => {
    void window.bureau.version().then(setVersion);
  }, []);
  const utilisateur = etat.phase === "connecte" ? etat.utilisateur : null;

  return (
    <div className="flex h-full">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-filet bg-surface">
        <div className="px-4 pt-4 pb-3">
          <div className="text-[15px] font-semibold tracking-tight">Moziik Admin</div>
          <div className="truncate text-[11px] text-texte-3">{site.replace(/^https?:\/\//, "")}</div>
        </div>
        <nav className="flex-1 px-2">
          {PAGES.map((p) => (
            <button
              key={p.cle}
              onClick={() => setPage(p.cle)}
              aria-current={page === p.cle ? "page" : undefined}
              className={clsx(
                "mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px]",
                page === p.cle ? "bg-surface-2 font-medium text-texte" : "text-texte-2 hover:bg-surface-2 hover:text-texte",
              )}
            >
              <p.icone size={16} className={page === p.cle ? "text-accent" : undefined} /> {p.libelle}
            </button>
          ))}
        </nav>
        <div className="border-t border-filet px-2 py-2">
          <button
            onClick={() => setPage("reglages")}
            className={clsx("flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px]", page === "reglages" ? "bg-surface-2 text-texte" : "text-texte-2 hover:bg-surface-2 hover:text-texte")}
          >
            <Settings size={16} /> Réglages
          </button>
          <div className="mt-1 flex items-center justify-between px-2.5 py-1.5">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium">{utilisateur?.name}</div>
              <div className="truncate text-[11px] text-texte-3">{utilisateur?.email}</div>
            </div>
            <button onClick={() => void fermer()} title="Se déconnecter" className="rounded-md p-1.5 text-texte-3 hover:bg-surface-2 hover:text-texte">
              <LogOut size={15} />
            </button>
          </div>
          {version && <div className="px-2.5 pb-1 text-[11px] text-texte-3">Version {version}</div>}
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6" key={page}>
        <div className="animate-paraitre mx-auto max-w-[1200px]">
          {page === "tableau" && <TableauDeBord aller={setPage} />}
          {page === "import" && <Import />}
          {page === "catalogue" && <Catalogue />}
          {page === "moderation" && <Moderation />}
          {page === "comptes" && <Comptes />}
          {page === "reglages" && <Reglages />}
        </div>
      </main>
    </div>
  );
}

export type { Page };
