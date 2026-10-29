"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, Share2, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";

/**
 * Le bilan de l'année, à la manière de « Spotify Wrapped » : des écrans
 * plein cadre qui défilent seuls (une barre par écran en haut), un appui à
 * gauche ou à droite pour reculer ou avancer, les flèches au clavier. Le
 * dernier écran résume l'année et se partage en image (format story).
 *
 * Les chiffres viennent de /api/me/bilan, le même calcul que le bilan de
 * l'application Android.
 */

type Bilan = {
  annee: number;
  ecoutes: number;
  minutes: number;
  titresDifferents: number;
  artistesDifferents: number;
  joursActifs: number;
  topTitres: { _id: string; title: string; coverUrl?: string; artist?: { stageName?: string }; ecoutes: number }[];
  topArtistes: { _id: string; stageName: string; coverUrl?: string; ecoutes: number }[];
  topGenres: { genre: string; ecoutes: number }[];
  parMois: number[];
  premiereEcoute: { title?: string; playedAt?: string; artist?: string } | null;
};

const DUREE_ECRAN_MS = 7000;
const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const nf = (n: number) => n.toLocaleString("fr-FR");

export default function BilanPage() {
  const { status } = useSession();
  const pushToast = useToast();
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [erreur, setErreur] = useState(false);
  const [ecran, setEcran] = useState(0);
  const [pause, setPause] = useState(false);
  const [partage, setPartage] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    setBilan(null);
    setErreur(false);
    setEcran(0);
    fetch(`/api/me/bilan?annee=${annee}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setBilan)
      .catch(() => setErreur(true));
  }, [annee, status]);

  const ecrans = useMemo(() => (bilan ? construireEcrans(bilan) : []), [bilan]);
  const total = ecrans.length;
  const suivant = useCallback(() => setEcran((e) => Math.min(e + 1, total - 1)), [total]);
  const precedent = useCallback(() => setEcran((e) => Math.max(e - 1, 0)), []);

  // Avance seule, sauf en pause et sur le dernier écran.
  useEffect(() => {
    if (pause || total === 0 || ecran >= total - 1) return;
    const minuterie = window.setTimeout(suivant, DUREE_ECRAN_MS);
    return () => window.clearTimeout(minuterie);
  }, [ecran, pause, total, suivant]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") suivant();
      if (e.key === "ArrowLeft") precedent();
      if (e.key === " ") setPause((p) => !p);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [suivant, precedent]);

  async function partager() {
    if (!bilan) return;
    setPartage(true);
    try {
      const blob = await imageDuBilan(bilan);
      const fichier = new File([blob], `moziik-bilan-${bilan.annee}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: `Mon année ${bilan.annee} sur Moziik` });
      } else {
        const lien = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = lien;
        a.download = fichier.name;
        a.click();
        URL.revokeObjectURL(lien);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") pushToast("error", "L'image n'a pas pu être créée.");
    } finally {
      setPartage(false);
    }
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Votre année sur Moziik</h1>
        <p className="mt-2 text-sm text-ink-muted">Connectez-vous pour découvrir votre bilan : vos titres, vos artistes, vos genres.</p>
        <Link href="/connexion" className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-base">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 font-display text-2xl font-bold md:text-3xl">Votre année sur Moziik</h1>
        <div className="flex gap-1.5" role="toolbar" aria-label="Année">
          {Array.from({ length: Math.min(4, anneeCourante - 2023) }, (_, i) => anneeCourante - i).map((a) => (
            <button
              key={a}
              onClick={() => setAnnee(a)}
              aria-pressed={a === annee}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${a === annee ? "bg-ink text-base" : "bg-ink/[0.08] text-ink hover:bg-ink/[0.14]"}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {erreur ? (
        <p className="py-16 text-center text-sm text-ink-muted">Le bilan n&apos;a pas pu être chargé. Réessayez dans un instant.</p>
      ) : !bilan ? (
        <div className="grid h-[70vh] place-items-center">
          <Loader2 size={24} className="animate-spin text-ink-muted" />
        </div>
      ) : bilan.ecoutes === 0 ? (
        <p className="py-16 text-center text-sm text-ink-muted">Aucune écoute en {bilan.annee} : le bilan se remplira au fil de vos écoutes.</p>
      ) : (
        // Le format d'une story : il tient debout sur téléphone comme sur ordinateur.
        <div className="relative mx-auto aspect-[9/16] max-h-[78vh] w-full max-w-[440px] select-none overflow-hidden rounded-panneau">
          <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
            {ecrans.map((_, i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  key={`${i}-${ecran}`}
                  className="h-full bg-white"
                  style={
                    i < ecran || (i === ecran && ecran === total - 1)
                      ? { width: "100%" }
                      : i === ecran
                        ? // Le remplissage de l'écran en cours : il s'arrête en pause, là où il en est.
                          { animation: `remplir-bilan ${DUREE_ECRAN_MS}ms linear forwards`, animationPlayState: pause ? "paused" : "running" }
                        : { width: "0%" }
                  }
                />
              </div>
            ))}
          </div>
          <div className="absolute right-3 top-6 z-20 flex gap-1">
            <button onClick={() => setPause((p) => !p)} aria-label={pause ? "Reprendre" : "Mettre en pause"} className="grid h-8 w-8 place-items-center rounded-full bg-black/30 text-white">
              {pause ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
            <Link href="/" aria-label="Fermer" className="grid h-8 w-8 place-items-center rounded-full bg-black/30 text-white">
              <X size={15} />
            </Link>
          </div>

          <div key={ecran} className="absolute inset-0 animate-fade-in-up">
            {ecrans[ecran]}
          </div>

          {/* Les deux moitiés de l'écran : reculer, avancer. */}
          <button aria-label="Écran précédent" onClick={precedent} className="absolute inset-y-16 left-0 z-10 w-1/3" />
          <button aria-label="Écran suivant" onClick={suivant} className="absolute inset-y-16 right-0 z-10 w-2/3" />

          {ecran === total - 1 && (
            <div className="absolute inset-x-6 bottom-6 z-20 flex gap-2">
              <button
                onClick={partager}
                disabled={partage}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-[#0D0F1A] disabled:opacity-70"
              >
                {partage ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                Partager en image
              </button>
              <button onClick={() => setEcran(0)} aria-label="Revoir depuis le début" className="grid h-12 w-12 place-items-center rounded-full bg-black/30 text-white">
                <ChevronLeft size={18} />
              </button>
            </div>
          )}
          {ecran < total - 1 && (
            <ChevronRight aria-hidden size={20} className="absolute bottom-5 right-4 z-10 text-white/60" />
          )}
        </div>
      )}
      {bilan && bilan.ecoutes > 0 && (
        <p className="mt-4 text-center text-xs text-ink-muted">
          Appuyez à droite pour avancer, à gauche pour revenir ; espace pour la pause.
        </p>
      )}
    </div>
  );
}

/** Un écran du bilan : un fond plein, un surtitre, et son contenu. */
function Ecran({ fond, encre = "text-white", surtitre, children }: { fond: string; encre?: string; surtitre: string; children: React.ReactNode }) {
  return (
    <div className={`flex h-full flex-col justify-center px-7 pb-10 pt-16 ${encre}`} style={{ background: fond }}>
      <p className="mb-3 text-sm font-semibold opacity-80">{surtitre}</p>
      {children}
    </div>
  );
}

function construireEcrans(b: Bilan): React.ReactNode[] {
  const ecrans: React.ReactNode[] = [];
  const maxMois = Math.max(1, ...b.parMois);
  const moisFort = b.parMois.indexOf(Math.max(...b.parMois));

  ecrans.push(
    <Ecran fond="#F84A26" encre="text-[#0D0F1A]" surtitre="Moziik">
      <p className="font-display text-5xl font-bold leading-[0.95]">Votre année {b.annee}</p>
      <p className="mt-4 text-lg font-medium">{nf(b.ecoutes)} écoutes, {nf(b.titresDifferents)} titres, {nf(b.artistesDifferents)} artistes.</p>
    </Ecran>,
  );
  ecrans.push(
    <Ecran fond="#111827" surtitre="Le temps passé à écouter">
      <p className="font-display text-7xl font-bold leading-none text-[#F84A26]">{nf(b.minutes)}</p>
      <p className="mt-2 text-2xl font-bold">minutes</p>
      <p className="mt-6 text-base opacity-80">Sur {nf(b.joursActifs)} jours. Soit environ {nf(Math.round(b.minutes / 60))} heures de musique.</p>
    </Ecran>,
  );
  const artiste = b.topArtistes[0];
  if (artiste) {
    ecrans.push(
      <Ecran fond="#3B1E54" surtitre="Votre artiste de l'année">
        {artiste.coverUrl && <SafeImage src={artiste.coverUrl} alt="" width={240} height={240} className="mb-5 h-44 w-44 rounded-full object-cover shadow-2xl" />}
        <p className="font-display text-4xl font-bold leading-tight">{artiste.stageName}</p>
        <p className="mt-1 opacity-80">{nf(artiste.ecoutes)} écoutes</p>
        <ol className="mt-6 space-y-1.5 text-base">
          {b.topArtistes.slice(1, 5).map((a, i) => (
            <li key={a._id} className="flex gap-3">
              <span className="w-5 font-bold opacity-60">{i + 2}</span>
              <span className="truncate font-medium">{a.stageName}</span>
            </li>
          ))}
        </ol>
      </Ecran>,
    );
  }
  const titre = b.topTitres[0];
  if (titre) {
    ecrans.push(
      <Ecran fond="#0E3B43" surtitre="Votre titre de l'année">
        {titre.coverUrl && <SafeImage src={titre.coverUrl} alt="" width={240} height={240} className="mb-5 h-44 w-44 rounded-md object-cover shadow-2xl" />}
        <p className="font-display text-3xl font-bold leading-tight">{titre.title}</p>
        <p className="mt-1 opacity-80">
          {titre.artist?.stageName} · {nf(titre.ecoutes)} écoutes
        </p>
        <ol className="mt-6 space-y-1.5 text-base">
          {b.topTitres.slice(1, 5).map((t, i) => (
            <li key={t._id} className="flex gap-3">
              <span className="w-5 font-bold opacity-60">{i + 2}</span>
              <span className="truncate font-medium">{t.title}</span>
            </li>
          ))}
        </ol>
      </Ecran>,
    );
  }
  if (b.topGenres.length > 0) {
    const maxGenre = Math.max(1, ...b.topGenres.map((g) => g.ecoutes));
    ecrans.push(
      <Ecran fond="#F8F4EC" encre="text-[#0D0F1A]" surtitre="Vos genres">
        <p className="mb-6 font-display text-4xl font-bold leading-tight">{b.topGenres[0].genre}</p>
        <ul className="space-y-3">
          {b.topGenres.slice(0, 5).map((g) => (
            <li key={g.genre}>
              <div className="mb-1 flex justify-between text-sm font-semibold">
                <span>{g.genre}</span>
                <span className="tabular-nums opacity-60">{nf(g.ecoutes)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#0D0F1A]/10">
                <div className="h-2 rounded-full bg-[#F84A26]" style={{ width: `${(g.ecoutes / maxGenre) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Ecran>,
    );
  }
  ecrans.push(
    <Ecran fond="#111827" surtitre="Mois après mois">
      <p className="mb-6 font-display text-3xl font-bold leading-tight">
        Votre plus grand mois : {["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][moisFort]}
      </p>
      <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Écoutes par mois">
        {b.parMois.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className={`w-full rounded-t ${i === moisFort ? "bg-[#F84A26]" : "bg-white/35"}`} style={{ height: `${Math.max(2, (n / maxMois) * 160)}px` }} title={`${MOIS[i]} : ${n} écoutes`} />
            <span className="text-[9px] opacity-70">{MOIS[i].slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </Ecran>,
  );
  ecrans.push(
    <Ecran fond="#F84A26" encre="text-[#0D0F1A]" surtitre={`Votre année ${b.annee}`}>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide opacity-70">Artistes</p>
          <ol className="space-y-1 text-sm font-semibold">
            {b.topArtistes.slice(0, 5).map((a, i) => (
              <li key={a._id} className="truncate">
                {i + 1}. {a.stageName}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide opacity-70">Titres</p>
          <ol className="space-y-1 text-sm font-semibold">
            {b.topTitres.slice(0, 5).map((t, i) => (
              <li key={t._id} className="truncate">
                {i + 1}. {t.title}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">Minutes</p>
          <p className="font-display text-3xl font-bold">{nf(b.minutes)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">Genre</p>
          <p className="truncate font-display text-2xl font-bold">{b.topGenres[0]?.genre ?? "–"}</p>
        </div>
      </div>
    </Ecran>,
  );
  return ecrans;
}

/** L'image à partager, au format d'une story (1080 × 1920), dessinée sur un canevas. */
async function imageDuBilan(b: Bilan): Promise<Blob> {
  const l = 1080;
  const h = 1920;
  const canevas = document.createElement("canvas");
  canevas.width = l;
  canevas.height = h;
  const ctx = canevas.getContext("2d")!;
  await document.fonts.ready;
  const police = getComputedStyle(document.body).fontFamily;
  const titrePolice = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || police;

  ctx.fillStyle = "#F84A26";
  ctx.fillRect(0, 0, l, h);
  ctx.fillStyle = "#0D0F1A";

  const texte = (t: string, x: number, y: number, taille: number, gras = true, famille = police) => {
    ctx.font = `${gras ? 700 : 500} ${taille}px ${famille}`;
    let s = t;
    while (ctx.measureText(s).width > l - x - 80 && s.length > 1) s = s.slice(0, -2) + "…";
    ctx.fillText(s, x, y);
  };

  texte("Moziik", 80, 150, 44, true, titrePolice);
  texte(`Mon année ${b.annee}`, 80, 300, 104, true, titrePolice);

  // La photo de l'artiste de l'année, si elle se charge (même origine que le site).
  const artiste = b.topArtistes[0];
  if (artiste?.coverUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((ok, ko) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => ok(i);
        i.onerror = ko;
        i.src = artiste.coverUrl!;
      });
      ctx.save();
      ctx.beginPath();
      ctx.arc(l - 260, 520, 180, 0, Math.PI * 2);
      ctx.clip();
      const cote = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, l - 440, 340, 360, 360);
      ctx.restore();
    } catch {
      // Sans photo, l'image reste lisible.
    }
  }

  texte("Artistes", 80, 820, 38, true);
  b.topArtistes.slice(0, 5).forEach((a, i) => texte(`${i + 1}. ${a.stageName}`, 80, 890 + i * 70, 50, true));
  texte("Titres", 80, 1300, 38, true);
  b.topTitres.slice(0, 5).forEach((t, i) => texte(`${i + 1}. ${t.title}`, 80, 1370 + i * 70, 50, true));

  texte("Minutes", 80, 1780, 34, true);
  texte(nf(b.minutes), 80, 1850, 64, true, titrePolice);
  texte("Genre", 560, 1780, 34, true);
  texte(b.topGenres[0]?.genre ?? "–", 560, 1850, 56, true, titrePolice);

  return new Promise((ok, ko) => canevas.toBlob((blob) => (blob ? ok(blob) : ko(new Error())), "image/png"));
}
