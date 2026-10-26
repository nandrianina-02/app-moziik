import Link from "next/link";
import { blocsDe, type Morceau } from "@/lib/annonceTexte";

/** Une ligne mise en forme : chaque morceau devient un élément, jamais du HTML brut. */
function Morceaux({ morceaux }: { morceaux: Morceau[] }) {
  return (
    <>
      {morceaux.map((m, i) => {
        switch (m.type) {
          case "texte":
            return <span key={i}>{m.valeur}</span>;
          case "gras":
            return (
              <strong key={i} className="font-semibold text-ink">
                <Morceaux morceaux={m.morceaux} />
              </strong>
            );
          case "italique":
            return (
              <em key={i}>
                <Morceaux morceaux={m.morceaux} />
              </em>
            );
          case "lien":
            return m.adresse.startsWith("/") ? (
              <Link key={i} href={m.adresse} className="text-accent underline underline-offset-2">
                <Morceaux morceaux={m.morceaux} />
              </Link>
            ) : (
              <a key={i} href={m.adresse} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                <Morceaux morceaux={m.morceaux} />
              </a>
            );
        }
      })}
    </>
  );
}

/** Le corps d'une annonce de la plateforme (lib/annonceTexte.ts). */
export function TexteAnnonce({ texte, className = "" }: { texte: string; className?: string }) {
  return (
    <div className={`space-y-2 whitespace-pre-line ${className}`}>
      {blocsDe(texte).map((bloc, i) =>
        bloc.type === "paragraphe" ? (
          <p key={i}>
            <Morceaux morceaux={bloc.morceaux} />
          </p>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {bloc.elements.map((element, j) => (
              <li key={j}>
                <Morceaux morceaux={element} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
