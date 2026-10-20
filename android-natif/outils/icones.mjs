// Icônes Lucide en vecteurs Android, pour que l'app native dessine
// exactement les mêmes pictogrammes que le site (lucide-react, licence ISC).
//
// Les icônes ne sont pas une dépendance de l'app : ce script lit les
// tracés dans le paquet lucide-react du site et écrit un fichier
// res/drawable/lucide_<nom>.xml par icône. On le relance quand on en ajoute
// une à la liste outils/icones.txt.
//
//   node android-natif/outils/icones.mjs <dossier node_modules du site>

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const modules = process.argv[2] ?? join(ici, "..", "..", "node_modules");
const sortie = join(ici, "..", "app", "src", "main", "res", "drawable");
const noms = readFileSync(join(ici, "icones.txt"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const nombre = (v) => Number(v ?? 0);

/** Chaque élément SVG de Lucide ramené à un tracé : un vecteur Android ne connaît que <path>. */
function enTrace([balise, a]) {
  switch (balise) {
    case "path":
      return a.d;
    case "circle": {
      const [cx, cy, r] = [nombre(a.cx), nombre(a.cy), nombre(a.r)];
      return `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
    }
    case "ellipse": {
      const [cx, cy, rx, ry] = [nombre(a.cx), nombre(a.cy), nombre(a.rx), nombre(a.ry)];
      return `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${2 * rx},0a${rx},${ry} 0 1,0 ${-2 * rx},0`;
    }
    case "rect": {
      const [x, y, w, h] = [nombre(a.x), nombre(a.y), nombre(a.width), nombre(a.height)];
      const rx = Math.min(nombre(a.rx ?? a.ry), w / 2);
      const ry = Math.min(nombre(a.ry ?? a.rx), h / 2);
      if (!rx && !ry) return `M${x},${y}h${w}v${h}h${-w}z`;
      return (
        `M${x + rx},${y}h${w - 2 * rx}a${rx},${ry} 0 0 1 ${rx},${ry}v${h - 2 * ry}` +
        `a${rx},${ry} 0 0 1 ${-rx},${ry}h${-(w - 2 * rx)}a${rx},${ry} 0 0 1 ${-rx},${-ry}` +
        `v${-(h - 2 * ry)}a${rx},${ry} 0 0 1 ${rx},${-ry}z`
      );
    }
    case "line":
      return `M${a.x1},${a.y1}L${a.x2},${a.y2}`;
    case "polyline":
    case "polygon": {
      const points = a.points.trim().split(/[\s,]+/).map(Number);
      let d = `M${points[0]},${points[1]}`;
      for (let i = 2; i < points.length; i += 2) d += `L${points[i]},${points[i + 1]}`;
      return balise === "polygon" ? `${d}z` : d;
    }
    default:
      throw new Error(`Élément SVG non pris en charge : ${balise}`);
  }
}

/** Les éléments d'une icône, lus dans le fichier du paquet (sans exécuter React). */
function elements(nom) {
  const source = readFileSync(join(modules, "lucide-react", "dist", "esm", "icons", `${nom}.js`), "utf8");
  const debut = source.indexOf("createLucideIcon(");
  const tableau = source.slice(source.indexOf("[", debut), source.lastIndexOf("]);") + 1);
  return Function(`return ${tableau};`)();
}

mkdirSync(sortie, { recursive: true });
for (const nom of noms) {
  const traces = elements(nom)
    .map((e) => enTrace(e))
    .map(
      (d) =>
        `    <path\n        android:pathData="${d}"\n        android:fillColor="#00000000"\n        android:strokeColor="#FF000000"\n` +
        `        android:strokeWidth="2"\n        android:strokeLineCap="round"\n        android:strokeLineJoin="round" />`,
    )
    .join("\n");
  const fichier = `lucide_${nom.replace(/-/g, "_")}.xml`;
  writeFileSync(
    join(sortie, fichier),
    `<?xml version="1.0" encoding="utf-8"?>\n<!-- Lucide « ${nom} » (ISC), généré par outils/icones.mjs : ne pas modifier à la main. -->\n` +
      `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="24dp"\n    android:height="24dp"\n` +
      `    android:viewportWidth="24"\n    android:viewportHeight="24">\n${traces}\n</vector>\n`,
  );
}
console.log(`${noms.length} icônes écrites dans ${sortie}`);
