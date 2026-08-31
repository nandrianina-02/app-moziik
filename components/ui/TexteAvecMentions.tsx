import Link from "next/link";
import { decouperMentions } from "@/lib/mentions";

/**
 * Affiche un texte libre en rendant ses mentions cliquables.
 *
 * Le texte reste stocké tel qu'il a été écrit : c'est ici, à l'affichage,
 * qu'un `@quelquun` devient un lien vers son profil. Rien n'est interprété
 * d'autre — pas de gras, pas de lien automatique — donc rien d'inattendu
 * ne peut sortir d'un commentaire.
 */
export function TexteAvecMentions({ texte, className = "" }: { texte: string; className?: string }) {
  const morceaux = decouperMentions(texte);

  return (
    <span className={className}>
      {morceaux.map((morceau, i) =>
        morceau.type === "mention" ? (
          <Link
            key={i}
            href={`/membre/${morceau.username}`}
            className="font-medium text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {morceau.valeur}
          </Link>
        ) : (
          <span key={i}>{morceau.valeur}</span>
        )
      )}
    </span>
  );
}
