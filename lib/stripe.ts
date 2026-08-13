import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Casté en `any` : le SDK Stripe type apiVersion en union littérale
  // stricte qui change à chaque version du paquet — un cast évite que
  // le build casse au moindre bump de la dépendance "stripe".
  apiVersion: "2024-06-20" as any,
});
