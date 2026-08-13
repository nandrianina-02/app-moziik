import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { withApiErrors } from "@/lib/apiError";

// Pays où le paiement Mobile Money (MVola) est proposé en priorité.
const MOBILE_MONEY_COUNTRIES = ["MG"];

export const GET = withApiErrors(async () => {
  const country = headers().get("x-vercel-ip-country") ?? "MG"; // repli par défaut : marché principal
  const preferredMethod = MOBILE_MONEY_COUNTRIES.includes(country) ? "mobile_money" : "stripe";

  return NextResponse.json({ country, preferredMethod });
});
