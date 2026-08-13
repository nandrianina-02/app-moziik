import { NextResponse } from "next/server";

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
      console.error(err);
      return NextResponse.json(
        { error: "Une erreur inattendue est survenue." },
        { status: 500 }
      );
    }
  };
}
