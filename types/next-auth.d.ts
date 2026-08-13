import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    // Optionnel : une session dont le compte a été suspendu après coup
    // (voir lib/auth.ts) est retournée avec `user: undefined`, comme une
    // session non authentifiée.
    user?: {
      id: string;
      role?: "member" | "artist" | "admin";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "member" | "artist" | "admin";
  }
}
