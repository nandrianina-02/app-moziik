import { useEffect, useState } from "react";
import { Bascule, Bouton, Champ, Erreur, Pastille, Selection, Tiroir, ZoneTexte, formatDuree } from "../composants";
import { adresseImage } from "../session";
import { LANGUES } from "../metadonnees";
import { STATUTS, albumsDe, manques, pochetteDe, type Ligne } from "../televersements";
import { ArtisteChoisi, AssistanceIA, ChampDecoupe, ChampParoles, ChoixArtiste, Compteur, DoublonEnDirect, Ecouteur, Invites, Libelle, SaisieTags, Section, Tempo, ZoneClip, ZoneImage } from "./champsTitre";

export { ChoixArtiste } from "./champsTitre";

/*
 * La fiche d'un fichier à téléverser : tous les champs du formulaire de
 * publication du site (app/son/nouveau/page.tsx) et ses outils, remplis à
 * l'avance depuis les balises. Rien ne part tant qu'on n'a pas lancé la
 * publication : chaque champ modifie la ligne, que l'envoi lira.
 */

interface Props {
  ligne: Ligne;
  genres: string[];
  fonctionsIA: string[];
  verrouillee: boolean;
  onChange: (patch: Partial<Ligne>) => void;
  onFermer: () => void;
}

export function FicheTeleversement({ ligne: l, genres, fonctionsIA, verrouillee, onChange, onFermer }: Props) {
  const restant = manques(l);
  const statut = STATUTS[l.statut];
  const lireLocal = async () => new Blob([await window.bureau.lireFichier(l.fichier.chemin)]);
  const image = pochetteDe(l);
  const duree = l.etiquettes?.duree ?? 0;
  return (
    <Tiroir
      titre={l.titre || l.fichier.nom}
      sousTitre={l.fichier.nom}
      largeur={620}
      onFermer={onFermer}
      pied={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[12.5px] text-texte-2" title={restant.join(", ")}>
            {l.statut === "termine" ? "Publié sur Moziik." : restant.length ? `Manque : ${restant.join(", ")}.` : l.brouillon ? "Prêt : sera enregistré comme brouillon." : "Prêt à publier."}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {l.songId && (
              <Bouton variante="trait" onClick={() => void window.bureau.ouvrirExterne(`${adresseImage("")}`.replace(/\/$/, "") + `/son/${l.songId}`)}>
                Voir sur le site
              </Bouton>
            )}
            <Bouton onClick={onFermer}>Fermer</Bouton>
          </div>
        </div>
      }
    >
      <fieldset disabled={verrouillee} className="min-w-0 space-y-7">
        <div className="flex gap-5">
          <ZoneImage
            apercu={image ? `data:${image.mime};base64,${image.base64}` : l.artiste?.coverUrl ? adresseImage(l.artiste.coverUrl) : null}
            legende={l.pochette ? "Image choisie" : l.etiquettes?.pochette ? "Image du fichier" : l.artiste?.coverUrl ? "Photo de l'artiste" : "Aucune image"}
            onImage={(pochette) => onChange({ pochette })}
            retour={l.pochette ? { libelle: "Revenir à l'image du fichier", action: () => onChange({ pochette: null }) } : undefined}
          />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Pastille texte={statut.libelle} ton={statut.ton} />
              {duree ? <span className="text-[12.5px] text-texte-2 tabular-nums">{formatDuree(duree)}</span> : null}
              {l.etiquettes?.debit ? <span className="text-[12.5px] text-texte-3">{l.etiquettes.debit} kb/s</span> : null}
              <span className="text-[12.5px] text-texte-3">{(l.fichier.taille / 1048576).toFixed(1)} Mo</span>
            </div>
            <Ecouteur cle={l.fichier.chemin} source={lireLocal} duree={duree} decoupe={l.decoupe} />
            {l.erreur && <Erreur message={l.erreur} />}
            {l.doublon && (
              <div className="rounded-lg border border-attention/40 bg-attention/10 px-3 py-2 text-[12.5px]">
                {l.doublon.certain ? "Ce titre existe déjà chez cet artiste" : `Un titre du même nom existe chez ${l.doublon.artistName}`} : « {l.doublon.title} ».
                {l.doublon.certain && (
                  <label className="mt-1.5 flex items-center gap-2">
                    <input type="checkbox" checked={l.importerQuandMeme} onChange={(e) => onChange({ importerQuandMeme: e.target.checked })} className="accent-[var(--accent)]" />
                    Importer quand même
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        <Section titre="Identité">
          <Champ libelle="Titre" value={l.titre} maxLength={200} onChange={(e) => onChange({ titre: e.target.value })} />
          <DoublonEnDirect titre={l.titre} artisteId={l.artiste?._id} />
          <div>
            <Libelle>Artiste principal</Libelle>
            {l.artiste ? (
              <ArtisteChoisi artiste={l.artiste} onRetirer={() => onChange({ artiste: null })} />
            ) : (
              <ChoixArtiste initial={l.artisteNom} onChoisir={(a) => onChange({ artiste: a, artisteNom: a.stageName, featuring: l.featuring.filter((f) => f._id !== a._id) })} />
            )}
          </div>
          <Invites
            featuring={l.featuring}
            nonTrouves={l.invitesNonTrouves}
            exclure={l.artiste ? [l.artiste._id] : []}
            onChange={({ featuring, nonTrouves }) =>
              onChange({
                featuring,
                invitesNonTrouves: nonTrouves,
                // Tous les invités du fichier rattachés : la mention « (feat. X) » peut quitter le titre.
                // Un nom ignoré ne retire pas la mention : seul un rattachement le fait.
                ...(nonTrouves.length === 0 && l.invitesNonTrouves.length > 0 && featuring.length > l.featuring.length && l.titreSansMention ? { titre: l.titreSansMention, titreSansMention: null } : {}),
              })
            }
          />
        </Section>

        <Section titre="Publication">
          <div className="grid grid-cols-2 gap-3">
            <Selection libelle="Genre" value={l.genre} onChange={(e) => onChange({ genre: e.target.value })}>
              {!genres.includes(l.genre) && <option value={l.genre}>{l.genre || "Choisir"}</option>}
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Selection>
            <Selection libelle="Langue" value={l.langue} onChange={(e) => onChange({ langue: e.target.value })}>
              {LANGUES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Selection>
          </div>
          <ChoixAlbum ligne={l} onChange={onChange} />
          <Champ
            libelle="Date de sortie"
            type="date"
            value={l.dateSortie}
            onChange={(e) => onChange({ dateSortie: e.target.value })}
            aide={
              !l.dateSortie
                ? "Vide : publié maintenant."
                : new Date(`${l.dateSortie}T00:00:00+03:00`).getTime() > Date.now()
                  ? "Date à venir : la sortie est programmée, le titre paraît ce jour-là."
                  : "Date passée : le titre paraît maintenant, avec cette date de sortie."
            }
          />
          <div className="divide-y divide-filet border-y border-filet">
            <Bascule libelle="Enregistrer comme brouillon" aide="Le titre attend la validation dans le catalogue au lieu de paraître." valeur={l.brouillon} onChange={(v) => onChange({ brouillon: v })} disabled={verrouillee} />
            <Bascule libelle="Contenu explicite" aide="Paroles réservées à un public averti." valeur={l.explicite} onChange={(v) => onChange({ explicite: v })} disabled={verrouillee} />
          </div>
        </Section>

        {fonctionsIA.includes("publication") && (
          <AssistanceIA
            titre={l.titre}
            artiste={l.artiste?.stageName ?? l.artisteNom}
            paroles={l.paroles}
            album={l.album}
            valeurs={{ genre: l.genre, langue: l.langue, tags: l.tags, description: l.description }}
            genres={genres}
            onChange={onChange}
          />
        )}

        <Section titre="Présentation">
          <div>
            <ZoneTexte libelle="Description" value={l.description} maxLength={1000} onChange={(e) => onChange({ description: e.target.value })} placeholder="L'histoire du titre, son contexte, les musiciens…" />
            <Compteur valeur={l.description.length} max={1000} />
          </div>
          <SaisieTags tags={l.tags} onChange={(tags) => onChange({ tags })} />
          <ChampParoles valeur={l.paroles} onChange={(paroles) => onChange({ paroles })} />
        </Section>

        <Section titre="Crédits et données techniques">
          <div className="grid grid-cols-2 gap-3">
            <Champ libelle="Compositeur" value={l.compositeur} maxLength={200} onChange={(e) => onChange({ compositeur: e.target.value })} />
            <Champ libelle="Producteur" value={l.producteur} maxLength={200} onChange={(e) => onChange({ producteur: e.target.value })} />
            <Champ libelle="Copyright" value={l.copyright} maxLength={300} onChange={(e) => onChange({ copyright: e.target.value })} placeholder="© 2026 Label" />
            <Champ libelle="ISRC" value={l.isrc} maxLength={20} onChange={(e) => onChange({ isrc: e.target.value.toUpperCase() })} placeholder="MG-A1B-26-00001" />
            <Champ libelle="Tonalité" value={l.tonalite} maxLength={20} onChange={(e) => onChange({ tonalite: e.target.value })} placeholder="C#m" />
            <Tempo bpm={l.bpm} origine={l.bpmSource} audio={lireLocal} onChange={(bpm, bpmSource) => onChange({ bpm, bpmSource })} />
          </div>
        </Section>

        <Section titre="Découpe et clip">
          <ChampDecoupe decoupe={l.decoupe} duree={duree} onChange={(decoupe) => onChange({ decoupe })} />
          <ZoneClip actuel={l.video} onChoisir={(video) => onChange({ video })} onRetirer={() => onChange({ video: null })} />
        </Section>
      </fieldset>
    </Tiroir>
  );
}

/** L'album : un de ceux de l'artiste, ou un nom nouveau (créé à l'envoi). Vide : single. */
function ChoixAlbum({ ligne: l, onChange }: { ligne: Ligne; onChange: (p: Partial<Ligne>) => void }) {
  const [albums, setAlbums] = useState<{ _id: string; title: string; type?: string }[]>([]);
  const artisteId = l.artiste?._id;
  useEffect(() => {
    if (!artisteId) return setAlbums([]);
    let actif = true;
    void albumsDe(artisteId).then((a) => actif && setAlbums(a));
    return () => {
      actif = false;
    };
  }, [artisteId]);
  const cle = (s: string) => s.trim().toLowerCase();
  const existant = albums.find((a) => cle(a.title) === cle(l.album));
  const liste = `albums-${l.id}`;
  return (
    <div>
      <Champ libelle="Album" list={liste} value={l.album} maxLength={200} onChange={(e) => onChange({ album: e.target.value })} placeholder="Vide : le titre sort en single" />
      <datalist id={liste}>
        {albums.map((a) => (
          <option key={a._id} value={a.title} />
        ))}
      </datalist>
      <p className="mt-1 text-[12px] text-texte-3">
        {!l.album.trim()
          ? albums.length
            ? `${albums.length} album${albums.length > 1 ? "s" : ""} chez cet artiste : tapez pour choisir.`
            : "Single."
          : existant
            ? `Album existant (${existant.type ?? "album"}).`
            : "Nouvel album : il sera créé à l'envoi, avec cette pochette."}
      </p>
    </div>
  );
}
