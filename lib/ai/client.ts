import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ApiError } from "@/lib/apiError";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSiteConfig } from "@/lib/siteConfig";
import { FONCTIONNALITES_IA, PLAFOND_JOURNALIER_DEFAUT, type IdFonctionnaliteIA, type NiveauModele } from "@/lib/ai/features";
import { appelsDuJour, enregistrerUsage } from "@/lib/ai/usage";

/**
 * Point de contact unique avec l'API Claude.
 *
 * Toutes les fonctionnalités d'IA du projet passent par ici, et aucune ne
 * parle au SDK directement. Ce détour porte quatre choses qu'on ne veut
 * pas voir réécrites neuf fois, chacune un peu différemment :
 *
 * 1. **La disponibilité.** Clé absente, interrupteur d'administration
 *    coupé, plafond du jour atteint : trois raisons de ne pas appeler, une
 *    seule réponse — un 503 avec un message qui dit laquelle. Aucune
 *    fonctionnalité ne « tombe en panne » quand l'IA n'est pas là ; toutes
 *    ont un comportement de repli, décrit à leur appel.
 * 2. **Le coût.** Cadence par compte, plafond de sortie, plafond
 *    journalier global, et comptage de ce qui a été consommé — y compris
 *    des appels partis puis tombés en erreur, qui sont facturés eux aussi.
 * 3. **Les réponses structurées.** Demander du JSON dans un texte libre
 *    oblige à parser de la prose, et échoue le jour où le modèle ajoute une
 *    phrase de politesse. On passe par un outil au schéma imposé : c'est
 *    l'API elle-même qui garantit la forme, et zod qui la revérifie.
 * 4. **Le secret.** La clé ne quitte jamais le serveur, et aucun message
 *    d'erreur renvoyé au navigateur ne porte de détail du fournisseur.
 */

/**
 * Les deux modèles employés, et ce qu'ils acceptent.
 *
 * `accepteTemperature` n'est pas une précaution : Sonnet 5 refuse la
 * requête entière avec un 400 « `temperature` is deprecated for this
 * model ». Le réglage est donc retiré pour lui, et conservé pour Haiku
 * qui l'honore encore — c'est ce qui rend la modération reproductible.
 * Les appelants continuent d'exprimer l'intention à leur niveau ; c'est
 * ici qu'on sait ce que chaque modèle en fait.
 */
const MODELES: Record<NiveauModele, { id: string; accepteTemperature: boolean }> = {
  // Classement, étiquetage, tri : réponse courte, attendue tout de suite.
  rapide: { id: "claude-haiku-4-5-20251001", accepteTemperature: true },
  // Rédaction lue puis publiée par un humain.
  soigne: { id: "claude-sonnet-5", accepteTemperature: false },
};

/** Au-delà, on considère que la réponse ne viendra pas. */
const DELAI_MS = 45_000;

const INDISPONIBLE = "L'assistance par IA n'est pas disponible pour le moment.";

let client: Anthropic | null = null;

function obtenirClient(): Anthropic {
  if (typeof window !== "undefined") {
    // Filet, pas une politique de sécurité : ce module n'est importé que
    // par des routes serveur. Si un import client s'y glissait, la clé
    // partirait dans le paquet du navigateur — mieux vaut casser bruyamment.
    throw new Error("lib/ai/client ne doit être importé que côté serveur.");
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: DELAI_MS,
      // Une seule reprise : les échecs qui se rejouent utilement (429, 529)
      // sont rares, et chaque reprise est un appel facturé de plus.
      maxRetries: 1,
    });
  }
  return client;
}

export function cleConfiguree(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type EtatIA = {
  disponible: boolean;
  /** Pourquoi, quand ce n'est pas disponible. Destiné à l'administration. */
  raison?: "cle" | "eteinte" | "fonctionnalite" | "plafond";
};

/**
 * L'IA peut-elle servir cette fonctionnalité, maintenant ?
 *
 * Sans effet de bord : les pages s'en servent pour ne pas proposer un
 * bouton qui répondrait par une erreur.
 */
export async function etatIA(fonctionnalite: IdFonctionnaliteIA): Promise<EtatIA> {
  if (!cleConfiguree()) return { disponible: false, raison: "cle" };

  const config = await getSiteConfig();
  const reglages = config.ai;
  if (reglages && reglages.enabled === false) return { disponible: false, raison: "eteinte" };
  if (reglages?.disabled?.includes(fonctionnalite)) return { disponible: false, raison: "fonctionnalite" };

  const plafond = reglages?.dailyCallCap ?? PLAFOND_JOURNALIER_DEFAUT;
  if (plafond > 0 && (await appelsDuJour()) >= plafond) return { disponible: false, raison: "plafond" };

  return { disponible: true };
}

/**
 * Les fonctionnalités servables en ce moment.
 *
 * Publiée dans /api/site-config, cette liste permet à chaque page de ne
 * proposer que ce qui répondra : un bouton « Proposer » qui renvoie une
 * erreur est pire que pas de bouton du tout. Les trois raisons d'absence
 * sont volontairement indistinguables côté navigateur — l'exploitant les
 * lit dans /admin/ia, le visiteur n'a pas à savoir laquelle s'applique.
 */
export async function fonctionnalitesIADisponibles(): Promise<IdFonctionnaliteIA[]> {
  if (!cleConfiguree()) return [];

  const config = await getSiteConfig();
  const reglages = config.ai;
  if (reglages && reglages.enabled === false) return [];

  const plafond = reglages?.dailyCallCap ?? PLAFOND_JOURNALIER_DEFAUT;
  if (plafond > 0 && (await appelsDuJour()) >= plafond) return [];

  const eteintes = new Set(reglages?.disabled ?? []);
  return (Object.keys(FONCTIONNALITES_IA) as IdFonctionnaliteIA[]).filter((id) => !eteintes.has(id));
}

const MESSAGE_RAISON: Record<NonNullable<EtatIA["raison"]>, string> = {
  cle: INDISPONIBLE,
  eteinte: "L'assistance par IA est désactivée.",
  fonctionnalite: "Cette assistance par IA est désactivée.",
  plafond: "La limite d'utilisation quotidienne de l'IA est atteinte. Réessayez demain.",
};

type Message = { role: "user" | "assistant"; content: string };

type OptionsIA = {
  fonctionnalite: IdFonctionnaliteIA;
  /**
   * Ce qui identifie l'appelant pour la cadence : un identifiant de compte,
   * ou l'adresse IP pour les fonctionnalités ouvertes aux visiteurs.
   */
  compte: string;
  systeme: string;
  messages: Message[];
  /** Force un modèle différent de celui du catalogue. Rare. */
  niveau?: NiveauModele;
  /** Abaisse le plafond de sortie du catalogue ; ne peut pas le dépasser. */
  maxTokens?: number;
  temperature?: number;
};

async function preparer(opts: OptionsIA) {
  const etat = await etatIA(opts.fonctionnalite);
  if (!etat.disponible) throw new ApiError(MESSAGE_RAISON[etat.raison ?? "cle"], 503);

  const desc = FONCTIONNALITES_IA[opts.fonctionnalite];
  checkRateLimit(`ia:${opts.fonctionnalite}:${opts.compte}`, desc.limite);

  const modele = MODELES[opts.niveau ?? desc.niveau];

  return {
    model: modele.id,
    max_tokens: Math.min(opts.maxTokens ?? desc.maxTokens, desc.maxTokens),
    system: opts.systeme,
    messages: opts.messages,
    ...(opts.temperature !== undefined && modele.accepteTemperature
      ? { temperature: opts.temperature }
      : {}),
  };
}

/**
 * Traduit une panne du fournisseur en message utilisable, sans rien en
 * révéler. `ApiError` traverse `withApiErrors` avec son code ; tout le
 * reste finirait en 500 « erreur inattendue », ce qui est faux : le
 * service tiers est momentanément indisponible, réessayer a du sens.
 */
function traduireErreur(err: unknown): ApiError {
  const statut = typeof err === "object" && err !== null && "status" in err ? Number((err as { status: unknown }).status) : 0;

  if (statut === 401 || statut === 403) {
    // Le détail reste dans les journaux du serveur : c'est à l'exploitant
    // de corriger sa clé, pas au visiteur de l'apprendre.
    console.error("[ia] clé d'API refusée par le fournisseur.");
    return new ApiError(INDISPONIBLE, 503);
  }
  if (statut === 429) return new ApiError("L'IA reçoit trop de demandes en ce moment. Réessayez dans un instant.", 503);
  if (statut === 529 || statut >= 500) return new ApiError("L'IA est momentanément surchargée. Réessayez dans un instant.", 503);

  if (statut === 400) {
    // Requête refusée : c'est notre demande qui est mal formée, pas une
    // panne du fournisseur. Distingué dans les journaux, parce que le
    // remède n'est pas d'attendre mais de corriger le code — un
    // paramètre retiré d'un modèle se manifeste exactement ainsi.
    console.error("[ia] requête refusée par le fournisseur (400) :", err);
    return new ApiError(INDISPONIBLE, 503);
  }

  const nom = err instanceof Error ? err.name : "";
  if (nom === "APIConnectionTimeoutError" || nom === "APIUserAbortError") {
    return new ApiError("L'IA met trop de temps à répondre. Réessayez.", 504);
  }
  if (nom === "APIConnectionError") return new ApiError(INDISPONIBLE, 503);

  console.error("[ia] échec inattendu :", err);
  return new ApiError(INDISPONIBLE, 503);
}

/** Réponse en texte libre. */
export async function demanderTexte(opts: OptionsIA): Promise<string> {
  const requete = await preparer(opts);

  try {
    const reponse = await obtenirClient().messages.create(requete);
    await enregistrerUsage(opts.fonctionnalite, {
      entree: reponse.usage.input_tokens,
      sortie: reponse.usage.output_tokens,
    });
    return reponse.content
      .map((bloc) => (bloc.type === "text" ? bloc.text : ""))
      .join("")
      .trim();
  } catch (err) {
    await enregistrerUsage(opts.fonctionnalite, { erreur: true });
    throw traduireErreur(err);
  }
}

/**
 * Réponse conforme à `schema`.
 *
 * Le schéma zod sert deux fois : converti en JSON Schema il devient
 * l'unique outil que le modèle a le droit d'appeler, ce qui contraint la
 * forme à la source ; puis il revalide ce qui revient. La conversion
 * évite d'écrire la même forme deux fois — c'est ce doublon qui finit
 * toujours par diverger.
 */
export async function demanderStructure<T extends z.ZodTypeAny>(
  opts: OptionsIA & { schema: T; description?: string }
): Promise<z.infer<T>> {
  const requete = await preparer(opts);

  const schemaJson = zodToJsonSchema(opts.schema, {
    // Sans cela, un sous-objet réutilisé sort en `$ref` vers `definitions`,
    // que l'API n'a pas à résoudre.
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as Record<string, unknown>;
  delete schemaJson.$schema;

  try {
    const reponse = await obtenirClient().messages.create({
      ...requete,
      tools: [
        {
          name: "repondre",
          description: opts.description ?? "Renvoie la réponse sous la forme demandée.",
          input_schema: schemaJson as Anthropic.Messages.Tool["input_schema"],
        },
      ],
      // Impose l'outil : le modèle ne peut pas répondre en prose à côté.
      tool_choice: { type: "tool", name: "repondre" },
    });

    await enregistrerUsage(opts.fonctionnalite, {
      entree: reponse.usage.input_tokens,
      sortie: reponse.usage.output_tokens,
    });

    if (reponse.stop_reason === "max_tokens") {
      // La réponse a été coupée au milieu : ce qui revient est un objet
      // incomplet, qui passerait parfois la validation en ayant perdu la
      // moitié de son contenu. Mieux vaut le dire.
      throw new ApiError("La réponse de l'IA a été interrompue car trop longue. Réessayez.", 502);
    }

    const bloc = reponse.content.find((c) => c.type === "tool_use");
    if (!bloc || bloc.type !== "tool_use") throw new ApiError(INDISPONIBLE, 502);

    const verifie = opts.schema.safeParse(bloc.input);
    if (!verifie.success) {
      console.error("[ia] réponse hors schéma :", verifie.error.issues.slice(0, 3));
      throw new ApiError("La réponse de l'IA n'était pas exploitable. Réessayez.", 502);
    }
    return verifie.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    await enregistrerUsage(opts.fonctionnalite, { erreur: true });
    throw traduireErreur(err);
  }
}
