// Dados FICTÍCIOS do modo de demonstração (os mesmos nomes e emails de supabase/seed.sql).
// Só usados em desenvolvimento, com VITE_DEMO_MODE=true. Nunca dados de clientes reais.
import type { PublicOrg } from "../org";

// Ficheiros da marca (branding/orvel, sem alterações), servidos em /demo-branding só pelo servidor
// de desenvolvimento em modo de demonstração (vite.config.ts). Não entram no build.
const orvelLogo = "/demo-branding/orvel/logotipo.png";
const orvelSymbol = "/demo-branding/orvel/simbolo.png";

export interface DemoOrg extends PublicOrg {
  /** Hostnames que abrem esta organização (como organizations.hostnames). */
  keys: string[];
}

export const DEMO_ORGS: DemoOrg[] = [
  {
    id: "demo-org-orvel",
    name: "Orvel Partners",
    slug: "orvel",
    keys: ["orvel", "portal.orvelpartners.com"],
    // Na demonstração os caminhos já são URLs locais (no Supabase são caminhos no bucket "branding").
    logo_path: orvelLogo,
    contact_email: "hello@orvelpartners.com",
    contact_whatsapp: "+971500000000",
    default_locale: "pt-PT",
    // Igual às migrações (20261031100500_org_orvel.sql e 20261115100000_orvel_marca.sql)
    theme: {
      symbol_path: orvelSymbol,
      colors: {
        primary: "#0b1628",
        "primary-deep": "#1e3a5f",
        wordmark: "#546275",
        action: "#1e3a5f",
        silver: "#c3c9d2",
        background: "#f4f6f9",
        line: "#d5dae2",
      },
      font: { family: "Source Sans 3" },
    },
  },
  {
    id: "demo-org-exemplo",
    name: "Consultora Exemplo",
    slug: "exemplo",
    keys: ["exemplo", "exemplo.localhost"],
    logo_path: null,
    contact_email: "hello@exemplo.test",
    contact_whatsapp: null,
    default_locale: "pt-PT",
    theme: {
      colors: {
        primary: "#2d2a26",
        "primary-deep": "#4a4540",
        wordmark: "#6b645c",
        action: "#b5542d",
        silver: "#d8d2ca",
        background: "#f7f5f2",
        line: "#e2ddd6",
      },
      font: { family: "Source Sans 3" },
    },
  },
];

export interface DemoUser {
  id: string;
  email: string;
  orgId: string;
  role: "admin" | "client";
  clientId: string | null;
}

export interface DemoClientRow {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  invited_at: string | null;
  last_invite_sent_at: string | null;
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export function initialClients(): DemoClientRow[] {
  return [
    { id: "demo-client-rui", organization_id: "demo-org-orvel", full_name: "Rui Fictício", email: "rui.ficticio@exemplo.test", invited_at: daysAgo(3), last_invite_sent_at: daysAgo(3) },
    { id: "demo-client-marta", organization_id: "demo-org-orvel", full_name: "Marta Exemplo", email: "marta.exemplo@exemplo.test", invited_at: daysAgo(60), last_invite_sent_at: daysAgo(60) },
    { id: "demo-client-joao", organization_id: "demo-org-orvel", full_name: "João Teste", email: "joao.teste@exemplo.test", invited_at: daysAgo(150), last_invite_sent_at: daysAgo(150) },
    { id: "demo-client-sofia", organization_id: "demo-org-orvel", full_name: "Sofia Exemplar", email: "sofia.exemplar@exemplo.test", invited_at: null, last_invite_sent_at: null },
    { id: "demo-client-carla", organization_id: "demo-org-exemplo", full_name: "Carla Exemplo", email: "carla.exemplo@exemplo.test", invited_at: daysAgo(5), last_invite_sent_at: daysAgo(5) },
  ];
}

export function initialUsers(): DemoUser[] {
  return [
    { id: "demo-user-equipa", email: "equipa@exemplo.test", orgId: "demo-org-orvel", role: "admin", clientId: null },
    { id: "demo-user-equipa-exemplo", email: "equipa.exemplo@exemplo.test", orgId: "demo-org-exemplo", role: "admin", clientId: null },
    { id: "demo-user-rui", email: "rui.ficticio@exemplo.test", orgId: "demo-org-orvel", role: "client", clientId: "demo-client-rui" },
    { id: "demo-user-marta", email: "marta.exemplo@exemplo.test", orgId: "demo-org-orvel", role: "client", clientId: "demo-client-marta" },
    { id: "demo-user-joao", email: "joao.teste@exemplo.test", orgId: "demo-org-orvel", role: "client", clientId: "demo-client-joao" },
    { id: "demo-user-carla", email: "carla.exemplo@exemplo.test", orgId: "demo-org-exemplo", role: "client", clientId: "demo-client-carla" },
  ];
}

/** Clientes que já aceitaram o aviso em vigor (o Rui ainda não, para se ver o ecrã). */
export const INITIAL_CONSENTS = ["demo-user-marta", "demo-user-joao", "demo-user-carla"];

/** Aviso provisório criado pelas migrações (install_org_defaults), versão 1. */
export const DEMO_NOTICE = {
  id: "demo-notice-1",
  version: 1,
  body: {
    "pt-PT":
      "TEXTO PROVISÓRIO, A VALIDAR PELO ADVOGADO. Os seus dados pessoais são tratados apenas para " +
      "acompanhar o seu processo. As cópias de passaportes e fotografias são apagadas " +
      "{retention_days} dias depois de o processo terminar.",
  },
  retention_days: 30,
};
