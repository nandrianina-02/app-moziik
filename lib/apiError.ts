import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { isDatabaseUnavailableError } from "@/lib/db";

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

      console.error(err);
      return NextResponse.json(
        { error: "Une erreur inattendue est survenue." },
        { status: 500 }
      );
    }
  };
}
