import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, CreditCard, ImageIcon, Link2, Palette, Plus, RefreshCw, Save, Settings2, Share2, Smartphone, Trash2, Upload, X, type LucideIcon } from "lucide-react";
import { api } from "../api";
import { adresseImage } from "../session";
import { televerser } from "../envoi";
import { BarreCollante, Bouton, Carte, Champ, Chargement, EnTete, Erreur, Selection, ZoneTexte, formatDate } from "../composants";
import { annoncer, confirmer } from "../interactions";
import clsx from "../clsx";

interface Plan {
  plan: "premium" | "premium_annual";
  amountUSD: number;
  amountMGA: number;
}

interface Theme {
  preset: string;
  mode: "dark" | "light" | "system";
  accent: string;
  backgroundDark: string;
  backgroundLight: string;
  secondary: string;
  warning: string;
  radius: number;
}

interface LienSocial {
  platform: string;
  url: string;
}

interface Config {
  siteName: string;
  tagline: string;
  description: string;
  siteUrl: string;
  supportEmail: string;
  copyrightText: string;
  defaultLanguage: string;
  defaultUnivers: "general" | "christian";
  currency: string;
  timezone: string;
  dateFormat: string;
  genres: string[];
  legalEntityName: string;
  legalCapital: string;
  legalRcsCity: string;
  legalRcsNumber: string;
  legalAddress: string;
  legalWebsite: string;
  legalUpdatedAt: string;
  logoUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  theme: Theme;
  trialDays: number;
  plans: Plan[];
  payPerListenRateUSD: number;
  anonymousDailyPlays: number;
  androidApkUrl: string;
  androidVersion: string;
  androidSizeMB: number;
  androidNotes: string;
  socialLinks: LienSocial[];
  seoTitle: string;
  seoDescription: string;
  googleAnalyticsId: string;
  googleSearchConsoleId: string;
}

type Cle = keyof Config;
type CleImage = "logoUrl" | "logoDarkUrl" | "faviconUrl";

/** Copie de THEME_PRESETS et RAYONS (lib/theme.ts du site), à tenir alignée à la main. */
const PRESETS_THEME: [string, string][] = [
  ["moziik", "Moziik"],
  ["ocean", "Océan"],
  ["emeraude", "Émeraude"],
  ["violet", "Violet"],
  ["rubis", "Rubis"],
  ["or", "Or"],
  ["ardoise", "Ardoise"],
  ["custom", "Personnalisé"],
];
const RAYONS = [0, 4, 8, 12, 16, 20];

/** Copie de RESEAUX (lib/socialPlatforms.ts du site) : le schéma refuse tout autre identifiant. */
const RESEAUX: { id: string; libelle: string; exemple: string }[] = [
  { id: "facebook", libelle: "Facebook", exemple: "https://facebook.com/moziik" },
  { id: "instagram", libelle: "Instagram", exemple: "https://instagram.com/moziik" },
  { id: "youtube", libelle: "YouTube", exemple: "https://youtube.com/@moziik" },
  { id: "tiktok", libelle: "TikTok", exemple: "https://tiktok.com/@moziik" },
  { id: "x", libelle: "X (Twitter)", exemple: "https://x.com/moziik" },
  { id: "linkedin", libelle: "LinkedIn", exemple: "https://linkedin.com/company/moziik" },
  { id: "whatsapp", libelle: "WhatsApp", exemple: "https://wa.me/261340000000" },
  { id: "telegram", libelle: "Telegram", exemple: "https://t.me/moziik" },
];

const THEME_PAR_DEFAUT: Theme = {
  preset: "moziik",
  mode: "dark",
  accent: "#F84A26",
  backgroundDark: "#0D0F1A",
  backgroundLight: "#FBF9F4",
  secondary: "#3DDC97",
  warning: "#FBBF24",
  radius: 12,
};

type Onglet = "general" | "logos" | "theme" | "premium" | "android" | "reseaux" | "seo";

const ONGLETS: { cle: Onglet; libelle: string; icone: LucideIcon; champs: Cle[] }[] = [
  {
    cle: "general",
    libelle: "Général",
    icone: Settings2,
    champs: [
      "siteName",
      "tagline",
      "description",
      "siteUrl",
      "supportEmail",
      "copyrightText",
      "defaultLanguage",
      "defaultUnivers",
      "currency",
      "timezone",
      "dateFormat",
      "genres",
      "legalEntityName",
      "legalCapital",
      "legalRcsCity",
      "legalRcsNumber",
      "legalAddress",
      "legalWebsite",
      "legalUpdatedAt",
    ],
  },
  // Les images s'enregistrent une à une, aussitôt : elles ne passent pas par le bouton commun.
  { cle: "logos", libelle: "Logos et favicon", icone: ImageIcon, champs: [] },
  { cle: "theme", libelle: "Thème", icone: Palette, champs: ["theme"] },
  { cle: "premium", libelle: "Prix Premium", icone: CreditCard, champs: ["trialDays", "plans", "payPerListenRateUSD", "anonymousDailyPlays"] },
  { cle: "android", libelle: "Application Android", icone: Smartphone, champs: ["androidApkUrl", "androidVersion", "androidSizeMB", "androidNotes"] },
  { cle: "reseaux", libelle: "Réseaux sociaux", icone: Share2, champs: ["socialLinks"] },
  { cle: "seo", libelle: "SEO et Analytics", icone: BarChart3, champs: ["seoTitle", "seoDescription", "googleAnalyticsId", "googleSearchConsoleId"] },
];

const CHAMPS_ENREGISTRES = ONGLETS.flatMap((o) => o.champs);

const urlValide = (url: string) => {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const nombre = (v: unknown, defaut = 0) => (typeof v === "number" && Number.isFinite(v) ? v : defaut);
const texte = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Met la réponse du site en forme : un document ancien peut ignorer un
 * champ ajouté depuis, et un champ absent ne doit pas passer pour une
 * modification au premier enregistrement.
 */
function normaliser(brut: Record<string, unknown>): Config {
  const theme = (brut.theme ?? {}) as Partial<Theme>;
  return {
    siteName: texte(brut.siteName),
    tagline: texte(brut.tagline),
    description: texte(brut.description),
    siteUrl: texte(brut.siteUrl),
    supportEmail: texte(brut.supportEmail),
    copyrightText: texte(brut.copyrightText),
    defaultLanguage: texte(brut.defaultLanguage),
    defaultUnivers: brut.defaultUnivers === "christian" ? "christian" : "general",
    currency: texte(brut.currency),
    timezone: texte(brut.timezone),
    dateFormat: texte(brut.dateFormat),
    genres: Array.isArray(brut.genres) ? (brut.genres as string[]) : [],
    legalEntityName: texte(brut.legalEntityName),
    legalCapital: texte(brut.legalCapital),
    legalRcsCity: texte(brut.legalRcsCity),
    legalRcsNumber: texte(brut.legalRcsNumber),
    legalAddress: texte(brut.legalAddress),
    legalWebsite: texte(brut.legalWebsite),
    legalUpdatedAt: typeof brut.legalUpdatedAt === "string" ? brut.legalUpdatedAt.slice(0, 10) : "",
    logoUrl: texte(brut.logoUrl),
    logoDarkUrl: texte(brut.logoDarkUrl),
    faviconUrl: texte(brut.faviconUrl),
    theme: { ...THEME_PAR_DEFAUT, ...theme },
    trialDays: nombre(brut.trialDays),
    plans: Array.isArray(brut.plans) ? (brut.plans as Plan[]).map((p) => ({ plan: p.plan, amountUSD: nombre(p.amountUSD), amountMGA: nombre(p.amountMGA) })) : [],
    payPerListenRateUSD: nombre(brut.payPerListenRateUSD),
    anonymousDailyPlays: nombre(brut.anonymousDailyPlays),
    androidApkUrl: texte(brut.androidApkUrl),
    androidVersion: texte(brut.androidVersion),
    androidSizeMB: nombre(brut.androidSizeMB),
    androidNotes: texte(brut.androidNotes),
    socialLinks: Array.isArray(brut.socialLinks) ? (brut.socialLinks as LienSocial[]).map((l) => ({ platform: l.platform, url: l.url })) : [],
    seoTitle: texte(brut.seoTitle),
    seoDescription: texte(brut.seoDescription),
    googleAnalyticsId: texte(brut.googleAnalyticsId),
    googleSearchConsoleId: texte(brut.googleSearchConsoleId),
  };
}

/** La valeur réellement envoyée : les liens sociaux invalides ne partent pas, ils feraient échouer tout l'enregistrement. */
function valeurEnvoyee(c: Config, cle: Cle): unknown {
  if (cle === "socialLinks") return c.socialLinks.filter((l) => urlValide(l.url)).map((l) => ({ platform: l.platform, url: l.url.trim() }));
  return c[cle];
}

/**
 * Les paramètres de tout le site : ce que chaque visiteur voit. Un seul
 * bouton enregistre les sept onglets, et seuls les champs modifiés
 * partent, pour ne pas écraser ce qu'une autre administration aurait
 * changé entre-temps sur un champ qu'on n'a pas touché.
 */
export function ParametresSite() {
  const [initial, setInitial] = useState<Config | null>(null);
  const [c, setC] = useState<Config | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("general");
  const [enCours, setEnCours] = useState(false);

  const charger = () => {
    setErreur(null);
    return api<{ config: Record<string, unknown> }>("/api/admin/site-config")
      .then(({ config }) => {
        const n = normaliser(config);
        setInitial(n);
        setC(n);
      })
      .catch((e: Error) => setErreur(e.message));
  };
  useEffect(() => {
    void charger();
  }, []);

  const changes = useMemo(() => {
    if (!initial || !c) return [] as Cle[];
    return CHAMPS_ENREGISTRES.filter((k) => JSON.stringify(valeurEnvoyee(c, k)) !== JSON.stringify(valeurEnvoyee(initial, k)));
  }, [initial, c]);

  const maj = (p: Partial<Config>) => setC((x) => (x ? { ...x, ...p } : x));

  function verifier(cfg: Config): string | null {
    if (!cfg.siteName.trim()) return "Le nom du site est requis.";
    if (cfg.siteUrl.trim() && !/^https?:\/\//.test(cfg.siteUrl.trim())) return "L'adresse du site doit commencer par http:// ou https://.";
    if (cfg.supportEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.supportEmail.trim())) return "L'adresse e-mail de support est invalide.";
    if (!Number.isInteger(cfg.trialDays) || cfg.trialDays < 0 || cfg.trialDays > 365) return "L'essai gratuit dure de 0 à 365 jours.";
    if (!Number.isInteger(cfg.anonymousDailyPlays) || cfg.anonymousDailyPlays < 0 || cfg.anonymousDailyPlays > 1000) return "Le quota d'écoutes sans compte est un entier de 0 à 1000.";
    if (cfg.payPerListenRateUSD < 0) return "Le tarif par écoute ne peut pas être négatif.";
    if (cfg.plans.some((p) => p.amountUSD < 0 || p.amountMGA < 0)) return "Un prix ne peut pas être négatif.";
    if (cfg.androidSizeMB < 0 || cfg.androidSizeMB > 2000) return "La taille de l'APK va de 0 à 2000 Mo.";
    if (cfg.googleAnalyticsId.trim() && !/^(G-[A-Z0-9]{4,}|UA-\d{4,}-\d+)$/i.test(cfg.googleAnalyticsId.trim())) return "Identifiant Google Analytics attendu au format G-XXXXXXXXXX.";
    return null;
  }

  async function enregistrer() {
    if (!c || !initial || changes.length === 0) return;
    const probleme = verifier(c);
    if (probleme) return setErreur(probleme);
    const ignores = c.socialLinks.filter((l) => l.url.trim() && !urlValide(l.url)).length + c.socialLinks.filter((l) => !l.url.trim()).length;
    const onglets = ONGLETS.filter((o) => o.champs.some((k) => changes.includes(k))).map((o) => o.libelle);
    const ok = await confirmer({
      titre: "Enregistrer les paramètres du site ?",
      message: (
        <>
          {changes.length} réglage{changes.length > 1 ? "s" : ""} modifié{changes.length > 1 ? "s" : ""} ({onglets.join(", ")}). Le changement s'applique au site en ligne, pour tous les visiteurs.
          {changes.includes("socialLinks") && ignores > 0 && <> {ignores} lien{ignores > 1 ? "s" : ""} social sans adresse http(s) valide ne sera pas enregistré.</>}
        </>
      ),
      confirmer: "Enregistrer",
    });
    if (!ok) return;
    setEnCours(true);
    setErreur(null);
    const corps: Record<string, unknown> = {};
    for (const k of changes) {
      const v = valeurEnvoyee(c, k);
      corps[k] = typeof v === "string" && k !== "androidNotes" && k !== "description" ? v.trim() : v;
    }
    // Une date vide ne se convertit pas : on ne l'envoie pas plutôt que de la refuser.
    if (corps.legalUpdatedAt === "") delete corps.legalUpdatedAt;
    try {
      const { config } = await api<{ config: Record<string, unknown> }>("/api/admin/site-config", { methode: "PATCH", corps });
      const n = normaliser(config);
      setInitial(n);
      setC(n);
      annoncer("Paramètres du site enregistrés");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
    } finally {
      setEnCours(false);
    }
  }

  /** Les images partent seules, aussitôt : un envoi qu'il faudrait encore valider passerait pour perdu. */
  async function enregistrerImage(cle: CleImage, url: string) {
    const { config } = await api<{ config: Record<string, unknown> }>("/api/admin/site-config", { methode: "PATCH", corps: { [cle]: url } });
    const valeur = texte(config?.[cle]);
    setInitial((x) => (x ? { ...x, [cle]: valeur } : x));
    setC((x) => (x ? { ...x, [cle]: valeur } : x));
  }

  return (
    <>
      <EnTete
        titre="Paramètres du site"
        texte="Identité, prix, application et référencement : ce que voit chaque visiteur."
        action={
          <Bouton
            variante="trait"
            onClick={() =>
              void (async () => {
                if (changes.length > 0) {
                  const ok = await confirmer({ titre: "Recharger depuis le site ?", message: "Les modifications non enregistrées seront perdues.", confirmer: "Recharger", danger: true });
                  if (!ok) return;
                }
                await charger();
              })()
            }
          >
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />

      <BarreCollante className="animate-monter decale-1">
        <nav className="flex flex-wrap rounded-lg border border-filet bg-surface p-0.5">
          {ONGLETS.map((o) => {
            const sale = o.champs.some((k) => changes.includes(k));
            return (
              <button
                key={o.cle}
                onClick={() => setOnglet(o.cle)}
                className={clsx(
                  "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  onglet === o.cle ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte",
                )}
              >
                <o.icone size={14} /> {o.libelle}
                {sale && <span className={clsx("h-1.5 w-1.5 rounded-full", onglet === o.cle ? "bg-sur-accent" : "bg-attention")} title="Modifié, non enregistré" />}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {changes.length > 0 && (
            <span className="animate-paraitre text-[12.5px] text-attention tabular-nums">
              {changes.length} modification{changes.length > 1 ? "s" : ""} non enregistrée{changes.length > 1 ? "s" : ""}
            </span>
          )}
          {changes.length > 0 && (
            <Bouton variante="discret" onClick={() => initial && setC(initial)}>
              <X size={14} /> Annuler
            </Bouton>
          )}
          <Bouton enCours={enCours} disabled={changes.length === 0} onClick={() => void enregistrer()}>
            <Save size={14} /> Enregistrer
          </Bouton>
        </div>
      </BarreCollante>

      <div className="mb-4">
        <Erreur message={erreur} />
      </div>

      {!c ? (
        !erreur && <Chargement />
      ) : (
        <div key={onglet} className="space-y-5">
          {onglet === "general" && <OngletGeneral c={c} maj={maj} />}
          {onglet === "logos" && <OngletLogos c={c} enregistrerImage={enregistrerImage} />}
          {onglet === "theme" && <OngletTheme c={c} maj={maj} />}
          {onglet === "premium" && <OngletPremium c={c} maj={maj} />}
          {onglet === "android" && <OngletAndroid c={c} maj={maj} />}
          {onglet === "reseaux" && <OngletReseaux c={c} maj={maj} />}
          {onglet === "seo" && <OngletSeo c={c} maj={maj} />}
        </div>
      )}
    </>
  );
}

type PropsOnglet = { c: Config; maj: (p: Partial<Config>) => void };

/** Une grille de champs à deux colonnes. */
function Grille({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
}

/** Un champ numérique : la saisie vide ou incomplète ne devient pas NaN dans l'état. */
function ChampNombre({ libelle, aide, valeur, onChange, min, max, pas = 1 }: { libelle: string; aide?: string; valeur: number; onChange: (v: number) => void; min?: number; max?: number; pas?: number }) {
  const [saisie, setSaisie] = useState(String(valeur));
  useEffect(() => {
    if (Number(saisie) !== valeur) setSaisie(String(valeur));
    // Seule une valeur venue d'ailleurs (rechargement, annulation) doit réécrire la saisie.
  }, [valeur]);
  return (
    <Champ
      libelle={libelle}
      aide={aide}
      type="number"
      min={min}
      max={max}
      step={pas}
      value={saisie}
      onChange={(e) => {
        setSaisie(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function OngletGeneral({ c, maj }: PropsOnglet) {
  const [genre, setGenre] = useState("");
  const ajouterGenre = () => {
    const g = genre.trim().slice(0, 60);
    if (!g) return;
    if (c.genres.some((x) => x.toLowerCase() === g.toLowerCase())) return setGenre("");
    if (c.genres.length >= 60) return;
    maj({ genres: [...c.genres, g] });
    setGenre("");
  };
  return (
    <>
      <Carte titre="Identité" className="animate-monter decale-1">
        <Grille>
          <Champ libelle="Nom du site" maxLength={80} value={c.siteName} onChange={(e) => maj({ siteName: e.target.value })} />
          <Champ libelle="Slogan" maxLength={200} value={c.tagline} onChange={(e) => maj({ tagline: e.target.value })} />
          <Champ libelle="Adresse du site" maxLength={300} value={c.siteUrl} onChange={(e) => maj({ siteUrl: e.target.value })} placeholder="https://…" aide="Sert à fabriquer les liens absolus : partages, plan du site." />
          <Champ libelle="E-mail de support" type="email" maxLength={254} value={c.supportEmail} onChange={(e) => maj({ supportEmail: e.target.value })} />
        </Grille>
        <ZoneTexte className="mt-4" libelle="Description" maxLength={1000} value={c.description} onChange={(e) => maj({ description: e.target.value })} />
        <Champ className="mt-4" libelle="Mention de copyright" maxLength={300} value={c.copyrightText} onChange={(e) => maj({ copyrightText: e.target.value })} />
      </Carte>

      <Carte titre="Région et affichage" className="animate-monter decale-2">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Champ libelle="Langue par défaut" maxLength={10} value={c.defaultLanguage} onChange={(e) => maj({ defaultLanguage: e.target.value })} placeholder="fr" />
          <Selection libelle="Univers par défaut" value={c.defaultUnivers} onChange={(e) => maj({ defaultUnivers: e.target.value as Config["defaultUnivers"] })}>
            <option value="general">Général</option>
            <option value="christian">Évangélique</option>
          </Selection>
          <Champ libelle="Devise" maxLength={10} value={c.currency} onChange={(e) => maj({ currency: e.target.value })} placeholder="USD" />
          <Champ libelle="Fuseau horaire" maxLength={60} value={c.timezone} onChange={(e) => maj({ timezone: e.target.value })} placeholder="Indian/Antananarivo" />
          <Champ libelle="Format de date" maxLength={20} value={c.dateFormat} onChange={(e) => maj({ dateFormat: e.target.value })} placeholder="DD/MM/YYYY" />
        </div>
      </Carte>

      <Carte titre="Genres musicaux" className="animate-monter decale-3" action={<span className="text-[12px] text-texte-3 tabular-nums">{c.genres.length} / 60</span>}>
        <p className="mb-3 text-[12.5px] text-texte-3">La liste proposée sur le site, à l'envoi d'un titre comme dans les filtres. Soixante au plus.</p>
        <div className="flex flex-wrap gap-1.5">
          {c.genres.map((g) => (
            <span key={g} className="inline-flex items-center gap-1 rounded-md border border-filet bg-surface-2 py-1 pr-1 pl-2.5 text-[12.5px]">
              {g}
              <button onClick={() => maj({ genres: c.genres.filter((x) => x !== g) })} title={`Retirer « ${g} »`} className="grid h-5 w-5 place-items-center rounded text-texte-3 hover:bg-surface hover:text-danger">
                <X size={12} />
              </button>
            </span>
          ))}
          {c.genres.length === 0 && <span className="text-[12.5px] text-texte-3">Aucun genre.</span>}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <Champ
            className="w-72"
            maxLength={60}
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                ajouterGenre();
              }
            }}
            placeholder="Nouveau genre"
          />
          <Bouton variante="trait" disabled={!genre.trim() || c.genres.length >= 60} onClick={ajouterGenre}>
            <Plus size={14} /> Ajouter
          </Bouton>
        </div>
      </Carte>

      <Carte titre="Mentions légales" className="animate-monter decale-4">
        <Grille>
          <Champ libelle="Raison sociale" maxLength={200} value={c.legalEntityName} onChange={(e) => maj({ legalEntityName: e.target.value })} />
          <Champ libelle="Capital" maxLength={60} value={c.legalCapital} onChange={(e) => maj({ legalCapital: e.target.value })} />
          <Champ libelle="Ville du RCS" maxLength={100} value={c.legalRcsCity} onChange={(e) => maj({ legalRcsCity: e.target.value })} />
          <Champ libelle="Numéro RCS" maxLength={60} value={c.legalRcsNumber} onChange={(e) => maj({ legalRcsNumber: e.target.value })} />
          <Champ libelle="Adresse" maxLength={300} value={c.legalAddress} onChange={(e) => maj({ legalAddress: e.target.value })} />
          <Champ libelle="Site web" maxLength={200} value={c.legalWebsite} onChange={(e) => maj({ legalWebsite: e.target.value })} />
          <Champ
            libelle="Dernière mise à jour"
            type="date"
            value={c.legalUpdatedAt}
            onChange={(e) => maj({ legalUpdatedAt: e.target.value })}
            aide={c.legalUpdatedAt ? `Affichée « ${formatDate(c.legalUpdatedAt)} » sur les pages légales.` : undefined}
          />
        </Grille>
      </Carte>
    </>
  );
}

const IMAGES: { cle: CleImage; libelle: string; aide: string; fondSombre: boolean }[] = [
  { cle: "logoUrl", libelle: "Logo principal", aide: "Barre latérale, en-tête mobile, icône de l'application.", fondSombre: false },
  { cle: "logoDarkUrl", libelle: "Logo sombre", aide: "Utilisé sur fond sombre. À défaut, le logo principal sert partout.", fondSombre: true },
  { cle: "faviconUrl", libelle: "Favicon", aide: "Icône d'onglet. À défaut, elle est dérivée du logo principal.", fondSombre: false },
];

function OngletLogos({ c, enregistrerImage }: { c: Config; enregistrerImage: (cle: CleImage, url: string) => Promise<void> }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {IMAGES.map((img, i) => (
        <EmplacementImage key={img.cle} {...img} valeur={c[img.cle]} enregistrer={(url) => enregistrerImage(img.cle, url)} decale={i + 1} />
      ))}
    </div>
  );
}

function EmplacementImage({
  libelle,
  aide,
  fondSombre,
  valeur,
  enregistrer,
  decale,
}: {
  libelle: string;
  aide: string;
  fondSombre: boolean;
  valeur: string;
  enregistrer: (url: string) => Promise<void>;
  decale: number;
}) {
  const fichier = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState<number | null>(null);
  const [adresse, setAdresse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const src = adresseImage(valeur);

  async function appliquer(url: string, succes: string) {
    setOccupe(true);
    setErreur(null);
    try {
      await enregistrer(url);
      annoncer(succes);
      setAdresse("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
    } finally {
      setOccupe(false);
    }
  }

  async function envoyer(f: File) {
    if (!f.type.startsWith("image/")) return setErreur("Choisissez une image : JPEG, PNG, WebP, GIF, AVIF ou SVG.");
    if (f.size > 20 * 1024 * 1024) return setErreur("Image trop lourde : 20 Mo au plus.");
    const ok = await confirmer({ titre: `Remplacer le ${libelle.toLowerCase()} ?`, message: `« ${f.name} » sera envoyé puis affiché aussitôt sur le site en ligne.`, confirmer: "Remplacer" });
    if (!ok) return;
    setErreur(null);
    setEnvoi(0);
    try {
      // « site-assets » : le dossier réservé à l'administration, celui qu'emploie la page web des paramètres.
      const id = await televerser(f, f.name, f.type, "site-assets", undefined, setEnvoi);
      setEnvoi(null);
      await appliquer(`/media/${id}`, `${libelle} mis à jour`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi de l'image impossible.");
    } finally {
      setEnvoi(null);
    }
  }

  async function utiliserAdresse() {
    const url = adresse.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/)/.test(url)) return setErreur("L'adresse doit commencer par https:// ou par / pour un fichier du site.");
    const ok = await confirmer({ titre: `Remplacer le ${libelle.toLowerCase()} ?`, message: "L'image à cette adresse sera affichée aussitôt sur le site en ligne.", confirmer: "Remplacer" });
    if (ok) await appliquer(url, `${libelle} mis à jour`);
  }

  async function retirer() {
    const ok = await confirmer({ titre: `Retirer le ${libelle.toLowerCase()} ?`, message: "Le site reviendra à l'image par défaut, tout de suite et pour tous les visiteurs.", confirmer: "Retirer", danger: true });
    if (ok) await appliquer("", `${libelle} retiré`);
  }

  return (
    <Carte titre={libelle} className={clsx("animate-monter", `decale-${decale}`)}>
      <p className="mb-3 text-[12.5px] text-texte-3">{aide}</p>
      <div className={clsx("relative grid h-36 place-items-center overflow-hidden rounded-xl border border-filet", fondSombre ? "bg-[#0D0F1A]" : "bg-surface-2")}>
        {src ? <img src={src} alt="" className="max-h-28 max-w-[80%] object-contain" /> : <ImageIcon size={28} className="text-texte-3" />}
        {envoi !== null && <span className="absolute inset-0 grid place-items-center bg-black/55 text-[13px] font-semibold text-white tabular-nums">{envoi} %</span>}
      </div>
      {valeur && <p className="mt-2 truncate text-[12px] text-texte-3" title={valeur}>{valeur}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Bouton variante="trait" enCours={envoi !== null} disabled={occupe} onClick={() => fichier.current?.click()}>
          <Upload size={14} /> Envoyer une image
        </Bouton>
        {valeur && (
          <Bouton variante="danger" disabled={occupe || envoi !== null} onClick={() => void retirer()}>
            <Trash2 size={14} /> Retirer
          </Bouton>
        )}
      </div>
      <input
        ref={fichier}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void envoyer(f);
        }}
      />
      <div className="mt-3 flex items-end gap-2">
        <Champ
          className="flex-1"
          value={adresse}
          maxLength={500}
          onChange={(e) => setAdresse(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void utiliserAdresse()}
          placeholder="Ou coller une adresse d'image"
        />
        <Bouton variante="trait" disabled={!adresse.trim() || occupe || envoi !== null} onClick={() => void utiliserAdresse()} title="Utiliser cette adresse">
          <Link2 size={14} />
        </Bouton>
      </div>
      {erreur && <p className="mt-2 text-[12.5px] text-danger">{erreur}</p>}
    </Carte>
  );
}

function OngletTheme({ c, maj }: PropsOnglet) {
  const t = c.theme;
  const majTheme = (p: Partial<Theme>) => maj({ theme: { ...t, ...p } });
  const personnalise = t.preset === "custom";
  const couleurs: [keyof Theme, string][] = [
    ["accent", "Accent"],
    ["secondary", "Secondaire"],
    ["warning", "Avertissement"],
    ["backgroundDark", "Fond sombre"],
    ["backgroundLight", "Fond clair"],
  ];
  return (
    <Carte titre="Thème par défaut" className="animate-monter decale-1">
      <p className="mb-4 text-[12.5px] text-texte-3">
        Celui que voit tout visiteur qui n'a rien personnalisé. L'éditeur complet, avec son aperçu, reste sur la page web des paramètres ; ici, le préréglage, le mode et, en mode personnalisé, les couleurs.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Selection libelle="Préréglage" value={t.preset} onChange={(e) => majTheme({ preset: e.target.value })}>
          {(PRESETS_THEME.some(([id]) => id === t.preset) ? PRESETS_THEME : [...PRESETS_THEME, [t.preset, t.preset] as [string, string]]).map(([id, l]) => (
            <option key={id} value={id}>
              {l}
            </option>
          ))}
        </Selection>
        <Selection libelle="Mode" value={t.mode} onChange={(e) => majTheme({ mode: e.target.value as Theme["mode"] })}>
          <option value="dark">Sombre</option>
          <option value="light">Clair</option>
          <option value="system">Celui de l'appareil</option>
        </Selection>
        <Selection libelle="Arrondi des angles" value={t.radius} onChange={(e) => majTheme({ radius: Number(e.target.value) })}>
          {[...new Set([...RAYONS, t.radius])].sort((a, b) => a - b).map((r) => (
            <option key={r} value={r}>
              {r} px
            </option>
          ))}
        </Selection>
      </div>
      <div className={clsx("mt-5 border-t border-filet pt-4", !personnalise && "opacity-60")}>
        <div className="mb-3 text-[12.5px] text-texte-3">{personnalise ? "Couleurs libres, au format #RRGGBB." : "Les couleurs libres ne s'appliquent qu'avec le préréglage « Personnalisé »."}</div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {couleurs.map(([cle, libelle]) => (
            <label key={cle} className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-texte-2">{libelle}</span>
              <span className="flex h-9 items-center gap-2 rounded-lg border border-filet bg-surface-2 px-2">
                <input
                  type="color"
                  disabled={!personnalise}
                  value={String(t[cle])}
                  onChange={(e) => majTheme({ [cle]: e.target.value.toUpperCase() } as Partial<Theme>)}
                  className="h-6 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                />
                <span className="font-mono text-[12px] text-texte-2">{String(t[cle])}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </Carte>
  );
}

const PLANS: { plan: Plan["plan"]; libelle: string }[] = [
  { plan: "premium", libelle: "Premium mensuel" },
  { plan: "premium_annual", libelle: "Premium annuel" },
];

function OngletPremium({ c, maj }: PropsOnglet) {
  const plan = (p: Plan["plan"]) => c.plans.find((x) => x.plan === p) ?? { plan: p, amountUSD: 0, amountMGA: 0 };
  const majPlan = (p: Plan["plan"], champ: "amountUSD" | "amountMGA", v: number) => {
    const existe = c.plans.some((x) => x.plan === p);
    maj({ plans: existe ? c.plans.map((x) => (x.plan === p ? { ...x, [champ]: v } : x)) : [...c.plans, { ...plan(p), [champ]: v }] });
  };
  return (
    <>
      <Carte titre="Abonnements" className="animate-monter decale-1">
        <div className="divide-y divide-filet">
          {PLANS.map((p) => (
            <div key={p.plan} className="grid grid-cols-1 items-end gap-4 py-3 first:pt-0 last:pb-0 lg:grid-cols-[1fr_200px_200px]">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <CreditCard size={15} className="text-texte-3" /> {p.libelle}
              </div>
              <ChampNombre libelle="Prix de référence (USD)" min={0} pas={0.01} valeur={plan(p.plan).amountUSD} onChange={(v) => majPlan(p.plan, "amountUSD", v)} />
              <ChampNombre libelle="Paiement mobile (MGA)" min={0} pas={100} valeur={plan(p.plan).amountMGA} onChange={(v) => majPlan(p.plan, "amountMGA", v)} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-texte-3">Le prix en dollars est converti selon la région du visiteur ; le prix en ariary sert au paiement mobile local.</p>
      </Carte>
      <Carte titre="Essai et écoute" className="animate-monter decale-2">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChampNombre libelle="Essai gratuit (jours)" min={0} max={365} valeur={c.trialDays} onChange={(v) => maj({ trialDays: v })} aide="0 pour aucun essai." />
          <ChampNombre libelle="Rémunération par écoute (USD)" min={0} pas={0.0001} valeur={c.payPerListenRateUSD} onChange={(v) => maj({ payPerListenRateUSD: v })} aide="Le tarif reversé aux artistes pour chaque écoute rémunérée." />
          <ChampNombre libelle="Écoutes par jour sans compte" min={0} max={1000} valeur={c.anonymousDailyPlays} onChange={(v) => maj({ anonymousDailyPlays: v })} aide="Le quota d'un visiteur non connecté, de 0 à 1000." />
        </div>
      </Carte>
    </>
  );
}

function OngletAndroid({ c, maj }: PropsOnglet) {
  return (
    <Carte titre="Application Android" className="animate-monter decale-1">
      <p className="mb-4 text-[12.5px] text-texte-3">La version annoncée sur la page de téléchargement. Une publication plus récente de l'application la remplace d'elle-même ; vider l'adresse retire l'annonce.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_160px_160px]">
        <Champ libelle="Adresse de l'APK" maxLength={600} value={c.androidApkUrl} onChange={(e) => maj({ androidApkUrl: e.target.value })} placeholder="https://…/moziik.apk" />
        <Champ libelle="Version" maxLength={40} value={c.androidVersion} onChange={(e) => maj({ androidVersion: e.target.value })} placeholder="1.4.0" />
        <ChampNombre libelle="Taille (Mo)" min={0} max={2000} pas={0.1} valeur={c.androidSizeMB} onChange={(v) => maj({ androidSizeMB: v })} />
      </div>
      <ZoneTexte className="mt-4" libelle="Notes de version" maxLength={1000} value={c.androidNotes} onChange={(e) => maj({ androidNotes: e.target.value })} placeholder="Ce qui change dans cette version" />
      <div className="mt-1 text-right text-[12px] text-texte-3 tabular-nums">{c.androidNotes.length} / 1000</div>
    </Carte>
  );
}

function OngletReseaux({ c, maj }: PropsOnglet) {
  const majLien = (i: number, p: Partial<LienSocial>) => maj({ socialLinks: c.socialLinks.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const libres = RESEAUX.filter((r) => !c.socialLinks.some((l) => l.platform === r.id));
  return (
    <Carte
      titre="Réseaux sociaux"
      className="animate-monter decale-1"
      action={
        <Bouton variante="trait" className="h-8" onClick={() => maj({ socialLinks: [...c.socialLinks, { platform: (libres[0] ?? RESEAUX[0]).id, url: "" }] })}>
          <Plus size={14} /> Ajouter un lien
        </Bouton>
      }
    >
      <p className="mb-3 text-[12.5px] text-texte-3">Affichés en pied de page. Un lien sans adresse http(s) valide n'est pas enregistré.</p>
      {c.socialLinks.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-texte-3">Aucun réseau social.</p>
      ) : (
        <ul className="divide-y divide-filet">
          {c.socialLinks.map((l, i) => {
            const reseau = RESEAUX.find((r) => r.id === l.platform);
            const invalide = l.url.trim() !== "" && !urlValide(l.url);
            return (
              <li key={i} className="animate-paraitre grid grid-cols-[200px_1fr_auto] items-start gap-3 py-2.5">
                <Selection value={l.platform} onChange={(e) => majLien(i, { platform: e.target.value })}>
                  {RESEAUX.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.libelle}
                    </option>
                  ))}
                </Selection>
                <div>
                  <Champ value={l.url} maxLength={300} onChange={(e) => majLien(i, { url: e.target.value })} placeholder={reseau?.exemple ?? "https://…"} />
                  {invalide && <span className="mt-1 block text-[12px] text-danger">Adresse invalide : elle doit commencer par http:// ou https://.</span>}
                  {!l.url.trim() && <span className="mt-1 block text-[12px] text-texte-3">Sans adresse, ce lien ne sera pas enregistré.</span>}
                </div>
                <button onClick={() => maj({ socialLinks: c.socialLinks.filter((_, j) => j !== i) })} title="Retirer ce lien" className="grid h-9 w-9 place-items-center rounded-lg text-texte-3 hover:bg-surface-2 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Carte>
  );
}

function OngletSeo({ c, maj }: PropsOnglet) {
  const gaInvalide = c.googleAnalyticsId.trim() !== "" && !/^(G-[A-Z0-9]{4,}|UA-\d{4,}-\d+)$/i.test(c.googleAnalyticsId.trim());
  return (
    <>
      <Carte titre="Référencement" className="animate-monter decale-1">
        <Champ libelle="Titre des pages" maxLength={200} value={c.seoTitle} onChange={(e) => maj({ seoTitle: e.target.value })} aide={`${c.seoTitle.length} / 200 · les moteurs en affichent une soixantaine de caractères.`} />
        <ZoneTexte className="mt-4" libelle="Description" maxLength={400} value={c.seoDescription} onChange={(e) => maj({ seoDescription: e.target.value })} />
        <div className="mt-1 text-right text-[12px] text-texte-3 tabular-nums">{c.seoDescription.length} / 400</div>
        <div className="mt-2 rounded-xl border border-filet bg-surface-2 p-4">
          <div className="text-[11px] tracking-wide text-texte-3 uppercase">Aperçu dans un moteur de recherche</div>
          <div className="mt-2 truncate text-[15px] text-accent">{c.seoTitle || c.siteName || "Titre du site"}</div>
          <div className="truncate text-[12px] text-succes">{c.siteUrl || "https://…"}</div>
          <p className="mt-1 line-clamp-2 text-[12.5px] text-texte-2">{c.seoDescription || c.description || "La description apparaîtra ici."}</p>
        </div>
      </Carte>
      <Carte titre="Mesure d'audience" className="animate-monter decale-2">
        <Grille>
          <div>
            <Champ libelle="Google Analytics" maxLength={40} value={c.googleAnalyticsId} onChange={(e) => maj({ googleAnalyticsId: e.target.value })} placeholder="G-XXXXXXXXXX" />
            {gaInvalide && <span className="mt-1 block text-[12px] text-danger">Format attendu : G-XXXXXXXXXX.</span>}
          </div>
          <Champ libelle="Google Search Console" maxLength={120} value={c.googleSearchConsoleId} onChange={(e) => maj({ googleSearchConsoleId: e.target.value })} aide="Le jeton de la balise de vérification." />
        </Grille>
      </Carte>
    </>
  );
}
