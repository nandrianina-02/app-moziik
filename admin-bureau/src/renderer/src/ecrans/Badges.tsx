import { useEffect, useMemo, useState } from "react";
import { Award, Check, Copy, Plus, RefreshCw, Search, UserPlus } from "lucide-react";
import { api } from "../api";
import { Avatar, Bouton, Carte, Champ, Chargement, Dialogue, EnTete, Erreur, Pastille, Selection, Vide, ZoneTexte } from "../composants";
import clsx from "../clsx";
import { annoncer, classeChoisi, confirmer, copier, ouvrirMenu } from "../interactions";

type Categorie = "member" | "artist" | "achievement";

interface Badge {
  _id: string;
  key: string;
  label: string;
  description: string;
  icon?: string;
  category: Categorie;
}

interface Membre {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  badges?: string[];
}

const CATEGORIES: { cle: Categorie; libelle: string }[] = [
  { cle: "member", libelle: "Membres" },
  { cle: "artist", libelle: "Artistes" },
  { cle: "achievement", libelle: "Accomplissements" },
];

/**
 * La clé proposée à partir du libellé : minuscules, sans accents, tout ce
 * qui n'est ni lettre ni chiffre devient un tiret. C'est elle que le site
 * range dans le compte du membre, d'où une forme stable et lisible.
 */
function cleDepuis(libelle: string) {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Le catalogue des badges et leur attribution. Le site ne propose ni
 * modification ni suppression d'un badge : on en crée, on en attribue,
 * rien de plus.
 */
export function Badges() {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  useEffect(() => {
    setBadges(null);
    setErreur(null);
    api<{ badges: Badge[] }>("/api/badges")
      .then((r) => setBadges(r.badges ?? []))
      .catch((e: Error) => setErreur(e.message));
  }, [version]);

  const badge = badges?.find((b) => b._id === choisi) ?? null;
  const groupes = useMemo(
    () => CATEGORIES.map((c) => ({ ...c, badges: (badges ?? []).filter((b) => (b.category ?? "member") === c.cle) })).filter((g) => g.badges.length > 0),
    [badges],
  );

  function menuBadge(e: React.MouseEvent, b: Badge) {
    setChoisi(b._id);
    ouvrirMenu(
      e,
      [
        { libelle: "Attribuer à un membre", icone: UserPlus, action: () => setChoisi(b._id) },
        "separateur",
        { libelle: "Copier la clé", icone: Copy, action: () => void copier(b.key).then(() => annoncer("Clé copiée")) },
      ],
      b.label,
    );
  }

  return (
    <>
      <EnTete
        titre="Badges"
        texte={badges ? `${badges.length} badge${badges.length > 1 ? "s" : ""} au catalogue` : undefined}
        action={
          <>
            <Bouton variante="trait" onClick={() => setVersion((v) => v + 1)}>
              <RefreshCw size={14} /> Actualiser
            </Bouton>
            <Bouton onClick={() => setCreation(true)}>
              <Plus size={14} /> Nouveau badge
            </Bouton>
          </>
        }
      />
      <Erreur message={erreur} />
      {!badges ? (
        !erreur && <Chargement />
      ) : (
        <div className="grid items-start gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr) 380px" }}>
          <div className="space-y-5">
            {groupes.length === 0 ? (
              <Vide texte="Aucun badge pour l'instant." />
            ) : (
              groupes.map((g, i) => (
                <section key={g.cle} className={clsx("animate-monter", `decale-${Math.min(i + 1, 6)}`)}>
                  <h2 className="mb-2 flex items-baseline gap-2 font-titre text-[14px] font-semibold">
                    {g.libelle}
                    <span className="text-[12px] font-normal text-texte-3 tabular-nums">{g.badges.length}</span>
                  </h2>
                  <div className="divide-y divide-filet overflow-hidden rounded-2xl border border-filet bg-surface">
                    {g.badges.map((b) => (
                      <button
                        key={b._id}
                        onClick={() => setChoisi(b._id)}
                        onContextMenu={(e) => menuBadge(e, b)}
                        className={clsx("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60", classeChoisi(choisi === b._id, "ligne"))}
                      >
                        <Award size={18} className={clsx("mt-0.5 shrink-0", choisi === b._id ? "text-accent" : "text-texte-3")} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-semibold">{b.label}</span>
                            <code className="truncate text-[11.5px] text-texte-3">{b.key}</code>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-texte-2">{b.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          <div className="sticky top-0">
            {badge ? (
              <Attribution key={badge._id} badge={badge} />
            ) : (
              <Carte titre="Attribuer un badge" className="animate-monter decale-2">
                <p className="text-[13px] text-texte-2">Choisissez un badge dans la liste pour le remettre à un membre. Le membre reçoit une notification.</p>
              </Carte>
            )}
          </div>
        </div>
      )}

      {creation && badges && (
        <NouveauBadge
          existantes={badges.map((b) => b.key)}
          onFermer={() => setCreation(false)}
          onCree={(b) => {
            setBadges((avant) => [...(avant ?? []), b]);
            setChoisi(b._id);
            setCreation(false);
          }}
        />
      )}
    </>
  );
}

/** Le panneau d'attribution : chercher un membre, lui remettre le badge choisi. */
function Attribution({ badge }: { badge: Badge }) {
  const [saisie, setSaisie] = useState("");
  const [membres, setMembres] = useState<Membre[] | null>(null);
  const [cherche, setCherche] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  // Ceux qui viennent de le recevoir : la recherche ne se relance pas après une attribution.
  const [remis, setRemis] = useState<Set<string>>(() => new Set());

  // Deux caractères au moins, après une pause de frappe : une lettre seule
  // ramènerait la moitié des comptes.
  useEffect(() => {
    const q = saisie.trim();
    if (q.length < 2) {
      setMembres(null);
      setCherche(false);
      return;
    }
    setCherche(true);
    let annule = false;
    const t = setTimeout(() => {
      api<{ users: Membre[] }>(`/api/admin/users?${new URLSearchParams({ search: q, limit: "10" })}`)
        .then((r) => {
          if (annule) return;
          setMembres(r.users ?? []);
          setErreur(null);
        })
        .catch((e: Error) => {
          if (!annule) setErreur(e.message);
        })
        .finally(() => {
          if (!annule) setCherche(false);
        });
    }, 300);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [saisie]);

  async function attribuer(m: Membre) {
    const ok = await confirmer({
      titre: `Attribuer « ${badge.label} » à ${m.name} ?`,
      message: "Le badge apparaît sur son profil et le membre reçoit une notification. Il ne peut pas être retiré d'ici.",
      confirmer: "Attribuer",
    });
    if (!ok) return;
    setEnCours(m._id);
    setErreur(null);
    try {
      await api("/api/admin/badges/assign", { corps: { userId: m._id, badgeKey: badge.key, badgeLabel: badge.label } });
      setRemis((avant) => new Set(avant).add(m._id));
      annoncer(`Badge attribué à ${m.name}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Attribution refusée.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <Carte
      className="animate-monter"
      titre={
        <span className="flex items-center gap-2">
          <Award size={16} className="text-accent" /> {badge.label}
        </span>
      }
      action={<Pastille texte={CATEGORIES.find((c) => c.cle === badge.category)?.libelle ?? badge.category} ton="accent" />}
    >
      <p className="text-[12.5px] leading-relaxed text-texte-2">{badge.description}</p>
      <div className="mt-4 border-t border-filet pt-4">
        <div className="mb-1.5 text-[12px] font-medium text-texte-2">Attribuer à un membre</div>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom ou e-mail"
            autoFocus
            className="h-9 w-full rounded-lg border border-filet bg-surface-2 pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
        </div>
        <div className="mt-3">
          <Erreur message={erreur} />
          {saisie.trim().length < 2 ? (
            <p className="py-3 text-[12.5px] text-texte-3">Deux caractères au moins.</p>
          ) : cherche && !membres ? (
            <Chargement texte="Recherche" />
          ) : membres && membres.length === 0 ? (
            <Vide texte="Aucun compte ne correspond." />
          ) : (
            <ul className="divide-y divide-filet">
              {(membres ?? []).map((m) => {
                const possede = remis.has(m._id) || Boolean(m.badges?.includes(badge.key));
                return (
                  <li key={m._id} className="animate-paraitre flex items-center gap-3 py-2.5">
                    <Avatar nom={m.name || m.email} image={m.avatarUrl} taille={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{m.name}</span>
                      <span className="block truncate text-[12px] text-texte-3">{m.email}</span>
                    </span>
                    {possede ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-succes">
                        <Check size={14} /> Attribué
                      </span>
                    ) : (
                      <Bouton variante="trait" className="h-8 px-2.5" enCours={enCours === m._id} disabled={enCours !== null} onClick={() => void attribuer(m)}>
                        Attribuer
                      </Bouton>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Carte>
  );
}

/** La création d'un badge : la clé suit le libellé tant qu'on ne l'a pas retouchée. */
function NouveauBadge({ existantes, onFermer, onCree }: { existantes: string[]; onFermer: () => void; onCree: (b: Badge) => void }) {
  const [label, setLabel] = useState("");
  const [cle, setCle] = useState("");
  const [cleTouchee, setCleTouchee] = useState(false);
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState<Categorie>("member");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const cleFinale = (cleTouchee ? cle : cleDepuis(label)).trim();
  const pret = label.trim().length > 0 && cleFinale.length > 0 && description.trim().length > 0;

  async function creer() {
    if (!pret) return;
    if (existantes.includes(cleFinale)) return setErreur("Cette clé est déjà prise par un autre badge.");
    const ok = await confirmer({
      titre: `Créer le badge « ${label.trim()} » ?`,
      message: "Il rejoint le catalogue aussitôt. Le site ne permet ni de le modifier ni de le supprimer ensuite : relisez la clé et la description.",
      confirmer: "Créer le badge",
    });
    if (!ok) return;
    setEnCours(true);
    setErreur(null);
    try {
      const { badge } = await api<{ badge: Badge }>("/api/badges", {
        corps: { key: cleFinale, label: label.trim(), description: description.trim(), icon: "award", category: categorie },
      });
      annoncer("Badge créé");
      onCree(badge);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création refusée.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Dialogue titre="Nouveau badge" onFermer={onFermer}>
      <div className="space-y-3">
        <Champ libelle="Libellé" value={label} maxLength={80} autoFocus onChange={(e) => setLabel(e.target.value)} placeholder="Premier abonné" />
        <Champ
          libelle="Clé"
          aide="Identifiant enregistré dans le compte du membre. Déduite du libellé, modifiable."
          value={cleTouchee ? cle : cleDepuis(label)}
          maxLength={60}
          onChange={(e) => {
            setCleTouchee(true);
            setCle(e.target.value);
          }}
        />
        <ZoneTexte libelle="Description" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="Ce qui vaut le badge, en une phrase" />
        <Selection libelle="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value as Categorie)}>
          {CATEGORIES.map((c) => (
            <option key={c.cle} value={c.cle}>
              {c.libelle}
            </option>
          ))}
        </Selection>
        <Erreur message={erreur} />
        <div className="flex justify-end gap-2 pt-2">
          <Bouton variante="discret" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton enCours={enCours} disabled={!pret} onClick={() => void creer()}>
            <Plus size={14} /> Créer
          </Bouton>
        </div>
      </div>
    </Dialogue>
  );
}
