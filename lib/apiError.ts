import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { isDatabaseUnavailableError } from "@/lib/db";

/**
 * Les documents refusés par une écriture groupée, réduits à ce qui aide.
 *
 * `11000` est un doublon de clé, `121` une validation refusée par le
 * serveur, `2` une donnée mal formée. Le nom du champ en cause suffit
 * presque toujours ; la valeur, elle, ne sort pas.
 */
function ecrituresRefusees(err: unknown): { index: number; code: number; champ?: string }[] | null {
  const bulk = err as { writeErrors?: unknown[] } | null;
  if (!bulk?.writeErrors || !Array.isArray(bulk.writeErrors)) return null;

  return bulk.writeErrors.slice(0, 5).map((brut) => {
    const e = brut as { index?: number; code?: number; errmsg?: string };
    // « E11000 duplicate key error collection: x index: champ_1 dup key »
    const champ = e.errmsg?.match(/index:\s+(\S+?)_-?\d/)?.[1];
    return { index: e.index ?? -1, code: e.code ?? -1, ...(champ ? { champ } : {}) };
  });
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Enveloppe un handler de route API : toute ApiError renvoie son
 * message et son code ; toute autre erreur renvoie un message
 * générique (pas de fuite de détails internes) avec un code 500.
 *
 * Deux familles d'erreurs sont traduites avant ce repli, parce qu'elles
 * étaient jusqu'ici indiscernables d'un bug applicatif côté navigateur :
 * une base injoignable (503, temporaire, l'utilisateur peut réessayer) et
 * une donnée refusée par Mongoose (400, avec le champ fautif).
 */
export function withApiErrors<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }

      if (isDatabaseUnavailableError(err)) {
        console.error("Base de données injoignable :", err);
        return NextResponse.json(
          { error: "Base de données momentanément injoignable. Réessaie dans quelques instants." },
          { status: 503 }
        );
      }

      // Validation / cast Mongoose : c'est un problème de saisie, pas une
      // panne. Le message porte le nom du champ en cause, indispensable
      // pour corriger le formulaire — le masquer derrière un 500 générique
      // rendait ces échecs impossibles à diagnostiquer depuis le
      // navigateur.
      if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
        return NextResponse.json({ error: `Données invalides : ${err.message}` }, { status: 400 });
      }

      // Dernier recours. Le message reste générique (aucune fuite de
      // détail interne), mais on joint deux informations sans valeur pour
      // un attaquant et décisives pour diagnostiquer : le *type* de
      // l'erreur, et une référence courte que l'on retrouve dans les logs
      // serveur. Sans elles, un 500 signalé par un utilisateur était
      // impossible à relier à quoi que ce soit.
      const ref = randomUUID().slice(0, 8);
      const code = err instanceof Error ? err.name : typeof err;
      console.error(`[api:${ref}] ${code}`, err);

      // Une écriture groupée refusée ne disait que son nom de classe. Or
      // MongoDB joint la raison exacte de chaque document rejeté : sans
      // elle, un `MongoBulkWriteError` obligeait à ouvrir les journaux de
      // l'hébergeur pour savoir s'il s'agissait d'un doublon, d'un champ
      // manquant ou d'un document trop gros.
      //
      // Seuls le code numérique et la position du document sortent : de
      // quoi diagnostiquer, sans révéler le contenu écrit.
      const echecs = ecrituresRefusees(err);
      return NextResponse.json(
        { error: "Une erreur inattendue est survenue.", code, ref, ...(echecs ? { echecs } : {}) },
        { status: 500 }
      );
    }
  };
}
