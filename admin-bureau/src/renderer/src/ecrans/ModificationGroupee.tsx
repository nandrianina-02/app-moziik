import { useState } from "react";
import { Check } from "lucide-react";
import { Bouton, Champ, Pastille, Selection, Tiroir } from "../composants";
import type { ArtisteOption } from "../artistes";
import { LANGUES, tagsPropres } from "../metadonnees";
import type { Ligne } from "../televersements";
import { ChoixArtiste } from "./FicheTeleversement";

/*
 * Les mêmes valeurs sur plusieurs lignes d'un coup : un album entier, un
 * artiste mal rapproché, une date de sortie commune. Un champ laissé vide
 * ou sur « Inchangé » ne touche à rien.
 */

const INCHANGE = "";

export function ModificationGroupee({ nombre, genres, onAppliquer, onFermer }: { nombre: number; genres: string[]; onAppliquer: (patch: (l: Ligne) => Partial<Ligne>) => void; onFermer: () => void }) {
  const [artiste, setArtiste] = useState<ArtisteOption | null>(null);
  const [album, setAlbum] = useState("");
  const [genre, setGenre] = useState(INCHANGE);
  const [langue, setLangue] = useState(INCHANGE);
  const [date, setDate] = useState("");
  const [brouillon, setBrouillon] = useState(INCHANGE);
  const [explicite, setExplicite] = useState(INCHANGE);
  const [compositeur, setCompositeur] = useState("");
  const [producteur, setProducteur] = useState("");
  const [copyright, setCopyright] = useState("");
  const [tags, setTags] = useState("");

  const changements = [artiste, album.trim(), genre, langue, date, brouillon, explicite, compositeur.trim(), producteur.trim(), copyright.trim(), tags.trim()].filter(Boolean).length;

  function appliquer() {
    const ajoutTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    onAppliquer((l) => ({
      ...(artiste ? { artiste, artisteNom: artiste.stageName, featuring: l.featuring.filter((f) => f._id !== artiste._id) } : {}),
      ...(album.trim() ? { album: album.trim() } : {}),
      ...(genre ? { genre } : {}),
      ...(langue ? { langue } : {}),
      ...(date ? { dateSortie: date } : {}),
      ...(brouillon ? { brouillon: brouillon === "oui" } : {}),
      ...(explicite ? { explicite: explicite === "oui" } : {}),
      ...(compositeur.trim() ? { compositeur: compositeur.trim() } : {}),
      ...(producteur.trim() ? { producteur: producteur.trim() } : {}),
      ...(copyright.trim() ? { copyright: copyright.trim() } : {}),
      ...(ajoutTags.length ? { tags: tagsPropres([...l.tags, ...ajoutTags]) } : {}),
    }));
  }

  return (
    <Tiroir
      titre={`Modifier ${nombre} ligne${nombre > 1 ? "s" : ""}`}
      sousTitre="Seuls les champs remplis sont appliqués ; le reste ne change pas."
      largeur={500}
      onFermer={onFermer}
      pied={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-texte-2">{changements ? `${changements} champ${changements > 1 ? "s" : ""} à appliquer` : "Aucun changement"}</span>
          <div className="flex gap-2">
            <Bouton variante="discret" onClick={onFermer}>
              Annuler
            </Bouton>
            <Bouton disabled={!changements} onClick={appliquer}>
              <Check size={14} /> Appliquer
            </Bouton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-texte-2">Artiste principal</span>
          {artiste ? (
            <div className="flex items-center justify-between border-y border-filet py-2 text-[13px]">
              <span className="flex items-center gap-2">
                {artiste.stageName} {artiste.verified && <Pastille texte="vérifié" ton="succes" />}
              </span>
              <button type="button" onClick={() => setArtiste(null)} className="text-[12px] text-texte-2 hover:text-texte">
                Inchangé
              </button>
            </div>
          ) : (
            <ChoixArtiste onChoisir={setArtiste} />
          )}
        </div>
        <Champ libelle="Album" value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Inchangé" aide="Un album de l'artiste, retrouvé par son nom, sinon créé à l'envoi." />
        <div className="grid grid-cols-2 gap-3">
          <Selection libelle="Genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value={INCHANGE}>Inchangé</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Selection>
          <Selection libelle="Langue" value={langue} onChange={(e) => setLangue(e.target.value)}>
            <option value={INCHANGE}>Inchangée</option>
            {LANGUES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Selection>
          <Champ libelle="Date de sortie" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Selection libelle="Brouillon" value={brouillon} onChange={(e) => setBrouillon(e.target.value)}>
            <option value={INCHANGE}>Inchangé</option>
            <option value="oui">Enregistrer comme brouillon</option>
            <option value="non">Publier directement</option>
          </Selection>
          <Selection libelle="Contenu explicite" value={explicite} onChange={(e) => setExplicite(e.target.value)}>
            <option value={INCHANGE}>Inchangé</option>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </Selection>
          <Champ libelle="Compositeur" value={compositeur} onChange={(e) => setCompositeur(e.target.value)} placeholder="Inchangé" />
          <Champ libelle="Producteur" value={producteur} onChange={(e) => setProducteur(e.target.value)} placeholder="Inchangé" />
          <Champ libelle="Copyright" value={copyright} onChange={(e) => setCopyright(e.target.value)} placeholder="Inchangé" />
        </div>
        <Champ libelle="Tags à ajouter" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="noël, louange" aide="Séparés par des virgules ; ajoutés à ceux de chaque ligne." />
      </div>
    </Tiroir>
  );
}
