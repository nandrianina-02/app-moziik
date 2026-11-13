/** Concatène des classes, en ignorant ce qui est faux : une dépendance de moins. */
export default function clsx(...valeurs: (string | false | null | undefined)[]): string {
  return valeurs.filter(Boolean).join(" ");
}
