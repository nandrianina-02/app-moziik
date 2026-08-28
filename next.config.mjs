/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Collecte des données de page en séquentiel plutôt qu'en parallèle.
    //
    // Next lance par défaut un worker par cœur pour cette étape, et
    // chacun charge le graphe complet des modules — mongoose et le SDK
    // compris. Sur une machine modeste, la somme dépasse la mémoire
    // physique : les workers se mettent à swapper, Next finit par les
    // tuer sur délai, et le build échoue sur un « kill EPERM » qui ne
    // dit rien de la cause.
    //
    // Le coût est un build plus lent sur une machine bien dotée ; le
    // bénéfice est un build qui aboutit partout.
    workerThreads: false,
    cpus: 1,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    // CSP volontairement permissive sur script/style/img/media/connect pour
    // ne pas casser Stripe.js, Google OAuth, Cloudinary et le lecteur audio.
    // À resserrer progressivement (nonces, domaines exacts) une fois les
    // intégrations tierces figées.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
      "media-src 'self' blob: https://res.cloudinary.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
