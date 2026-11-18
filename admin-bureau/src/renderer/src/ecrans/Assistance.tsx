import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Hand, Lock, LockOpen, Mail, MessageSquareText, RefreshCw, Search, Send, Sparkles } from "lucide-react";
import { api } from "../api";
import { Avatar, Bouton, Chargement, EnTete, Erreur, Pastille, formatRelatif } from "../composants";
import clsx from "../clsx";
import { annoncer, copier, ouvrirMenu } from "../interactions";

interface Fil {
  _id: string;
  user?: { _id: string; name: string; email: string; avatarUrl?: string } | null;
  userName: string;
  userEmail: string;
  status: "open" | "closed";
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageFrom: "user" | "admin" | "ai";
  unreadForAdmin: number;
  humanRequested: boolean;
}

interface Message {
  _id: string;
  author: "user" | "admin" | "ai";
  authorName: string;
  body: string;
  createdAt: string;
}

type Filtre = "open" | "closed" | "";

/**
 * L'assistance : les conversations des membres avec l'équipe et l'assistant
 * du site (/api/admin/support). Les demandes d'un humain et les messages non
 * lus passent en tête, comme sur le site. Une conversation ouverte se
 * relit toute seule pour afficher les nouveaux messages.
 */
export function Assistance() {
  const [fils, setFils] = useState<Fil[] | null>(null);
  const [compteurs, setCompteurs] = useState<{ enAttente: number; humainDemande: number } | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("open");
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(
    (silencieux = false) => {
      if (!silencieux) setFils(null);
      api<{ threads: Fil[]; enAttente: number; humainDemande: number }>(`/api/admin/support${filtre ? `?status=${filtre}` : ""}`)
        .then((r) => {
          setFils(r.threads ?? []);
          setCompteurs({ enAttente: r.enAttente ?? 0, humainDemande: r.humainDemande ?? 0 });
        })
        .catch((e: Error) => setErreur(e.message));
    },
    [filtre],
  );

  useEffect(() => {
    charger();
    // La liste se rafraîchit d'elle-même : un nouveau message remonte sans clic.
    const minuterie = setInterval(() => charger(true), 30_000);
    return () => clearInterval(minuterie);
  }, [charger]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = fils ?? [];
    return q ? liste.filter((f) => `${f.userName} ${f.userEmail} ${f.lastMessagePreview}`.toLowerCase().includes(q)) : liste;
  }, [fils, recherche]);

  const filOuvert = fils?.find((f) => f._id === ouvert) ?? null;

  async function basculer(f: Fil) {
    const suivant = f.status === "open" ? "closed" : "open";
    try {
      await api(`/api/admin/support/${f._id}`, { methode: "PATCH", corps: { status: suivant } });
      annoncer(suivant === "closed" ? "Conversation close" : "Conversation rouverte");
      charger(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Changement refusé.");
    }
  }

  function menuFil(e: React.MouseEvent, f: Fil) {
    ouvrirMenu(
      e,
      [
        { libelle: "Ouvrir", icone: MessageSquareText, action: () => setOuvert(f._id) },
        f.status === "open" ? { libelle: "Clore", icone: Lock, action: () => void basculer(f) } : { libelle: "Rouvrir", icone: LockOpen, action: () => void basculer(f) },
        "separateur",
        { libelle: "Copier l'e-mail", icone: Mail, action: () => void copier(f.userEmail || f.user?.email || "").then(() => annoncer("E-mail copié")) },
      ],
      f.userName || f.user?.name,
    );
  }

  return (
    <>
      <EnTete
        titre="Assistance"
        texte={compteurs ? `${compteurs.enAttente} conversation${compteurs.enAttente > 1 ? "s" : ""} en attente de réponse · ${compteurs.humainDemande} demande${compteurs.humainDemande > 1 ? "s" : ""} d'un humain` : undefined}
        action={
          <Bouton variante="trait" onClick={() => charger()}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <Erreur message={erreur} />
      <div className="animate-monter decale-1 grid h-[calc(100vh-220px)] min-h-[480px] grid-cols-[340px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-filet bg-surface">
        <aside className="flex min-h-0 flex-col border-r border-filet">
          <div className="space-y-2.5 border-b border-filet p-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texte-3" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom, e-mail ou message"
                className="h-9 w-full rounded-lg border border-filet bg-surface-2 pr-3 pl-9 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
              />
            </div>
            <div className="flex rounded-lg border border-filet bg-surface-2 p-0.5">
              {(
                [
                  ["open", "Ouvertes"],
                  ["closed", "Closes"],
                  ["", "Toutes"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setFiltre(v)}
                  className={clsx("flex-1 rounded-md py-1.5 text-[12.5px] font-medium transition-colors", filtre === v ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!fils ? (
              <Chargement />
            ) : visibles.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-texte-3">Aucune conversation.</p>
            ) : (
              <ul>
                {visibles.map((f) => (
                  <li key={f._id}>
                    <button
                      onClick={() => setOuvert(f._id)}
                      onContextMenu={(e) => menuFil(e, f)}
                      className={clsx("flex w-full gap-3 border-b border-filet px-3.5 py-3 text-left transition-colors", ouvert === f._id ? "bg-surface-2" : "hover:bg-surface-2/60")}
                    >
                      <Avatar nom={f.userName || f.user?.name || "?"} image={f.user?.avatarUrl} taille={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={clsx("truncate text-[13px]", f.unreadForAdmin > 0 ? "font-bold" : "font-semibold")}>{f.userName || f.user?.name || "Membre"}</span>
                          <span className="shrink-0 text-[11px] text-texte-3">{formatRelatif(f.lastMessageAt)}</span>
                        </div>
                        <div className={clsx("mt-0.5 truncate text-[12.5px]", f.unreadForAdmin > 0 ? "text-texte" : "text-texte-3")}>
                          {f.lastMessageFrom === "admin" ? "Vous : " : f.lastMessageFrom === "ai" ? "Assistant : " : ""}
                          {f.lastMessagePreview}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {f.humanRequested && f.status === "open" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-attention/12 px-1.5 py-0.5 text-[10.5px] font-semibold text-attention">
                              <Hand size={11} /> Humain demandé
                            </span>
                          )}
                          {f.status === "closed" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-texte-3">
                              <Lock size={11} /> Close
                            </span>
                          )}
                          {f.unreadForAdmin > 0 && (
                            <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-sur-accent tabular-nums">{f.unreadForAdmin}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {filOuvert ? (
          <Conversation key={filOuvert._id} fil={filOuvert} onChange={() => charger(true)} />
        ) : (
          <div className="grid place-items-center p-10 text-center">
            <div>
              <MessageSquareText size={34} className="mx-auto text-texte-3" />
              <p className="mt-3 text-[13px] text-texte-2">Choisissez une conversation.</p>
              <p className="mt-1 text-[12px] text-texte-3">Les demandes d'un humain et les messages non lus sont en tête de liste.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Conversation({ fil, onChange }: { fil: Fil; onChange: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [statut, setStatut] = useState(fil.status);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [suggestion, setSuggestion] = useState<"attente" | "incomplet" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const bas = useRef<HTMLDivElement>(null);
  const dernier = useRef<string | null>(null);

  // Premier chargement, puis seulement ce qui est arrivé depuis le dernier
  // message affiché (paramètre `after`), toutes les 8 secondes.
  useEffect(() => {
    let actif = true;
    const lire = async (tout: boolean) => {
      try {
        const r = await api<{ messages: Message[] }>(`/api/admin/support/${fil._id}${!tout && dernier.current ? `?after=${encodeURIComponent(dernier.current)}` : ""}`);
        if (!actif) return;
        const nouveaux = r.messages ?? [];
        if (nouveaux.length) dernier.current = nouveaux[nouveaux.length - 1].createdAt;
        setMessages((avant) => (tout || !avant ? nouveaux : [...avant, ...nouveaux.filter((m) => !avant.some((a) => a._id === m._id))]));
        if (tout) onChange();
      } catch (e) {
        if (actif) setErreur(e instanceof Error ? e.message : "Conversation illisible.");
      }
    };
    void lire(true);
    const minuterie = setInterval(() => void lire(false), 8_000);
    return () => {
      actif = false;
      clearInterval(minuterie);
    };
    // onChange relit seulement la liste : inutile de relancer la conversation pour lui.
  }, [fil._id]);

  useEffect(() => {
    bas.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  async function envoyer() {
    const corps = texte.trim();
    if (!corps) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const { message } = await api<{ message: Message }>(`/api/admin/support/${fil._id}`, { corps: { body: corps } });
      setMessages((m) => [...(m ?? []), message]);
      dernier.current = message.createdAt;
      setTexte("");
      setSuggestion(null);
      // Répondre rouvre une conversation close, côté site comme ici.
      setStatut("open");
      onChange();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi refusé.");
    } finally {
      setEnvoi(false);
    }
  }

  async function proposer() {
    setSuggestion("attente");
    setErreur(null);
    try {
      const r = await api<{ brouillon: string; incomplet: boolean }>(`/api/admin/support/${fil._id}/suggest`, { corps: {} });
      setTexte(r.brouillon);
      setSuggestion(r.incomplet ? "incomplet" : null);
    } catch (e) {
      setSuggestion(null);
      setErreur(e instanceof Error ? e.message : "Aucune proposition.");
    }
  }

  async function basculerStatut() {
    const suivant = statut === "open" ? "closed" : "open";
    try {
      await api(`/api/admin/support/${fil._id}`, { methode: "PATCH", corps: { status: suivant } });
      setStatut(suivant);
      onChange();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Changement refusé.");
    }
  }

  return (
    <section className="animate-paraitre flex min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-filet px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar nom={fil.userName || "?"} image={fil.user?.avatarUrl} taille={38} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">{fil.userName || fil.user?.name}</div>
            <div className="truncate text-[12px] text-texte-3" data-selectionnable>
              {fil.userEmail || fil.user?.email}
            </div>
          </div>
          {statut === "closed" && <Pastille texte="close" />}
        </div>
        <Bouton variante="trait" className="h-8" onClick={() => void basculerStatut()}>
          {statut === "open" ? <Lock size={14} /> : <LockOpen size={14} />} {statut === "open" ? "Clore" : "Rouvrir"}
        </Bouton>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {!messages ? (
          <Chargement />
        ) : (
          messages.map((m) => {
            const equipe = m.author !== "user";
            return (
              <div key={m._id} className={clsx("flex", equipe ? "justify-end" : "justify-start")}>
                <div className="max-w-[72%]">
                  <div className={clsx("mb-1 flex items-center gap-1.5 text-[11px] text-texte-3", equipe && "justify-end")}>
                    {m.author === "ai" && <Bot size={12} />}
                    {m.author === "ai" ? "Assistant" : m.authorName || (equipe ? "Équipe" : "Membre")} · {formatRelatif(m.createdAt)}
                  </div>
                  <div
                    data-selectionnable
                    className={clsx(
                      "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line break-words",
                      m.author === "admin" ? "rounded-br-md bg-accent text-sur-accent" : m.author === "ai" ? "rounded-br-md border border-filet bg-surface-2" : "rounded-bl-md bg-surface-2",
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bas} />
      </div>

      <footer className="border-t border-filet p-3">
        <Erreur message={erreur} />
        {suggestion === "incomplet" && (
          <p className="mb-2 flex items-center gap-1.5 text-[12px] text-attention">
            <Sparkles size={13} /> Proposition partielle : l'assistant n'a pas tout trouvé dans l'aide, relisez avant d'envoyer.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                e.preventDefault();
                void envoyer();
              }
            }}
            rows={3}
            maxLength={4000}
            placeholder="Votre réponse (Ctrl + Entrée pour envoyer)"
            className="min-h-[72px] flex-1 resize-none rounded-xl border border-filet bg-surface-2 px-3 py-2 text-[13px] outline-none placeholder:text-texte-3 focus:border-accent"
          />
          <div className="flex flex-col gap-2">
            <Bouton variante="trait" enCours={suggestion === "attente"} onClick={() => void proposer()} title="Un brouillon de l'assistant, d'après l'aide du site">
              <Sparkles size={14} /> Proposer
            </Bouton>
            <Bouton enCours={envoi} disabled={!texte.trim()} onClick={() => void envoyer()}>
              <Send size={14} /> Envoyer
            </Bouton>
          </div>
        </div>
        {statut === "closed" && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-texte-3">
            <CheckCircle2 size={13} /> Conversation close : répondre la rouvre.
          </p>
        )}
      </footer>
    </section>
  );
}
