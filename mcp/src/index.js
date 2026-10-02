#!/usr/bin/env node
/**
 * Serveur MCP d'administration Moziik.
 *
 * Il ne contient aucune règle métier : chaque outil est un appel à une
 * route qui existe déjà sur le site, avec les droits du compte configuré.
 * C'est volontaire et c'est la propriété qui compte — si le serveur
 * refuse une suppression à un artiste, ce serveur-ci la refusera aussi,
 * sans qu'une ligne ait à le prévoir. La seule chose qu'il ajoute, ce sont
 * les garde-fous de confirmation sur les gestes irréversibles, parce qu'un
 * modèle peut se tromper d'identifiant et qu'une validation dans une
 * fenêtre de discussion se donne vite.
 *
 * TRANSPORT
 *
 * stdio. Rien, jamais, ne doit être écrit sur la sortie standard en
 * dehors des trames du protocole : un `console.log` oublié casse la
 * session entière, et le client affiche « serveur MCP déconnecté » sans
 * dire pourquoi. Toute trace va donc sur l'erreur standard.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { ClientMoziik, ErreurMoziik } from "./moziik.js";
import { erreur } from "./format.js";
import { OUTILS } from "./outils.js";

const VERSION = "1.0.0";

function trace(message) {
  process.stderr.write(`[moziik-mcp] ${message}\n`);
}

const client = new ClientMoziik();

const server = new Server(
  { name: "moziik-admin", version: VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: OUTILS.map((o) => ({
    name: o.nom,
    description: o.description,
    inputSchema: o.entree ?? { type: "object", properties: {} },
    ...(o.destructif ? { annotations: { destructiveHint: true } } : {}),
    ...(o.lectureSeule ? { annotations: { readOnlyHint: true } } : {}),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (requete) => {
  const nom = requete.params.name;
  const outil = OUTILS.find((o) => o.nom === nom);
  if (!outil) return erreur(`Outil inconnu : ${nom}.`);

  if (!client.configure()) return erreur(ClientMoziik.manqueIdentifiants());

  const args = requete.params.arguments ?? {};

  try {
    return await outil.executer(client, args);
  } catch (err) {
    if (err instanceof ErreurMoziik) {
      // Le statut est rendu au modèle : il lui permet de distinguer ce
      // qu'il peut corriger (400, 404) de ce qu'il ne pourra pas (403).
      return erreur(err.message, { statut: err.statut, route: err.route });
    }
    trace(`${nom} : ${err && err.stack ? err.stack : err}`);
    return erreur(
      `Échec inattendu de ${nom} : ${err && err.message ? err.message : String(err)}`
    );
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
trace(`prêt — ${OUTILS.length} outils, cible ${client.base}`);
