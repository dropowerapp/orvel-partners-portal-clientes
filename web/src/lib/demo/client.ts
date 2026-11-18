// Supabase SIMULADO para o modo de demonstração (só em desenvolvimento, com VITE_DEMO_MODE=true).
// Responde às mesmas chamadas que o portal faz ao Supabase verdadeiro, com dados fictícios
// guardados na sessão do browser. Não envia emails nem grava nada fora do browser.
//
// Não é uma réplica da segurança: as regras reais estão na base de dados (RLS) e são testadas à
// parte (supabase/tests). Aqui só se imitam os resultados, para se poderem ver os ecrãs.
import { DEMO_NOTICE, DEMO_ORGS, type DemoClientRow, type DemoUser, INITIAL_CONSENTS, initialClients, initialUsers } from "./data";

import { portalRows } from "./portalData";

const STORAGE_KEY = "portal.demo";

interface DemoLink {
  email: string;
  token: string;
  type: "magiclink" | "recovery";
}

interface DemoState {
  userId: string | null;
  aal: "aal1" | "aal2";
  users: DemoUser[];
  clients: DemoClientRow[];
  consents: string[];
  /** Fatores TOTP por utilizador. */
  factors: Record<string, { id: string; status: "verified" | "unverified" }[]>;
  /** Último "email" enviado (link mágico, convite ou recuperação). */
  lastLink: DemoLink | null;
}

function freshState(): DemoState {
  return {
    userId: null,
    aal: "aal1",
    users: initialUsers(),
    clients: initialClients(),
    consents: [...INITIAL_CONSENTS],
    factors: {},
    lastLink: null,
  };
}

function load(): DemoState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...freshState(), ...(JSON.parse(raw) as Partial<DemoState>) };
  } catch {
    // estado inválido: recomeça
  }
  return freshState();
}

const changeListeners = new Set<() => void>();

function update(mutate: (state: DemoState) => void): DemoState {
  const state = load();
  mutate(state);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  changeListeners.forEach((listener) => listener());
  return state;
}

// ------------------------------------------------------------------------------------------------
// Ações da barra de demonstração

export type DemoPersona = "client_new" | "client" | "team";

/** Entra diretamente com um utilizador fictício (atalho da barra de demonstração). */
export function demoSignInAs(persona: DemoPersona): void {
  const userId = { client_new: "demo-user-rui", client: "demo-user-marta", team: "demo-user-equipa" }[persona];
  update((s) => {
    s.userId = userId;
    s.aal = "aal1";
    if (persona === "client_new") s.consents = s.consents.filter((id) => id !== userId);
  });
}

export function demoLastLink(): { email: string; url: string } | null {
  const link = load().lastLink;
  if (!link) return null;
  const params = new URLSearchParams({ token_hash: link.token, type: link.type });
  return { email: link.email, url: `/auth/confirmar?${params}` };
}

export function demoReset(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  changeListeners.forEach((listener) => listener());
}

export function onDemoChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

// ------------------------------------------------------------------------------------------------
// Sessão (formato do supabase-js; o token só serve para o portal ler o nível "aal")

function base64Url(value: string): string {
  return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sessionFor(state: DemoState) {
  const user = state.users.find((u) => u.id === state.userId);
  if (!user) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const payload = { sub: user.id, email: user.email, role: "authenticated", aal: state.aal, exp: expiresAt };
  return {
    access_token: `${base64Url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${base64Url(JSON.stringify(payload))}.demo`,
    refresh_token: "demo-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: user.id,
      email: user.email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

type AuthListener = (event: string, session: ReturnType<typeof sessionFor>) => void;
const authListeners = new Set<AuthListener>();
function emit(event: string, state: DemoState): void {
  const session = sessionFor(state);
  authListeners.forEach((listener) => listener(event, session));
}

/** Erro no formato dos erros do supabase-js (o portal lê "code" e "status"). */
function authError(code: string, status = 400) {
  return Object.assign(new Error(code), { name: "AuthApiError", code, status });
}

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

/** Imagem com o aspeto de um código QR (não é lido por nenhuma aplicação: é só demonstração). */
function demoQrCode(seed: string): string {
  const size = 25;
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const cells: string[] = [];
  const finder = (x: number, y: number) => {
    cells.push(`<rect x="${x}" y="${y}" width="7" height="7"/>`, `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/>`,
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inFinder = (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
      hash = (hash * 1103515245 + 12345) >>> 0;
      if (!inFinder && (hash >>> 16) % 2 === 0) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
  }
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${size + 4} ${size + 4}" shape-rendering="crispEdges">` +
    `<rect x="-2" y="-2" width="${size + 4}" height="${size + 4}" fill="#fff"/><g fill="#0b1628">${cells.join("")}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ------------------------------------------------------------------------------------------------
// Tabelas (só o que o portal lê nesta fase)

type Row = { [column: string]: unknown };

function visibleRows(table: string, state: DemoState): Row[] {
  const user = state.users.find((u) => u.id === state.userId);
  if (!user) return [];
  if (user.role === "admin" && state.aal !== "aal2") return [];
  if (user.role === "client" && !state.consents.includes(user.id)) return [];
  const clients = state.clients.filter((c) => c.organization_id === user.orgId && (user.role === "admin" || c.id === user.clientId));
  if (table === "clients") return clients.map((c) => ({ ...c }));
  const candidates = clients.filter((c) => c.id === "demo-client-marta");
  const rows = candidates.flatMap((c) => portalRows(table, c));
  return rows.filter((row, index) => rows.findIndex((other) => other.id === row.id) === index);
}

/** Divide uma lista de colunas do PostgREST pelas vírgulas de topo (ignora as dos recursos embutidos). */
function topLevelColumns(columns: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of columns) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** "alias:tabela(colunas)" → nome do campo no resultado e se é um recurso embutido. */
function columnKey(column: string): { key: string; embedded: boolean } {
  const embedded = column.includes("(");
  const head = embedded ? column.slice(0, column.indexOf("(")) : column;
  return { key: head.includes(":") ? head.split(":")[0].trim() : head.trim(), embedded };
}

class DemoQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private columns: string[] | null = null;
  private filters: [string, unknown][] = [];
  private orderBy: { column: string; ascending: boolean }[] = [];
  private predicates: ((row: Row) => boolean)[] = [];
  private bounds: [number, number] | null = null;
  private one = false;
  private maybeOne = false;
  /** Na demonstração, as escritas diretas em tabelas (painel da equipa) não gravam nada. */
  private write = false;

  constructor(private readonly table: string) {}

  select(columns = "*") {
    this.columns = columns === "*" ? null : topLevelColumns(columns);
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  neq(column: string, value: unknown) { this.predicates.push((row) => row[column] !== value); return this; }
  in(column: string, values: unknown[]) { this.predicates.push((row) => values.includes(row[column])); return this; }
  is(column: string, value: unknown) { this.predicates.push((row) => (row[column] ?? null) === value); return this; }
  gte(column: string, value: string) { this.predicates.push((row) => String(row[column]) >= value); return this; }
  lte(column: string, value: string) { this.predicates.push((row) => String(row[column]) <= value); return this; }
  limit(value: number) { this.bounds = [0, value - 1]; return this; }
  range(from: number, to: number) { this.bounds = [from, to]; return this; }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  maybeSingle() {
    this.maybeOne = true;
    return this;
  }
  insert() {
    this.write = true;
    return this;
  }
  update() {
    this.write = true;
    return this;
  }
  upsert() {
    this.write = true;
    return this;
  }
  delete() {
    this.write = true;
    return this;
  }

  private async run() {
    await wait(150);
    if (this.write) return { data: null, error: { code: "P0001", message: "demo_read_only" } };
    let rows = visibleRows(this.table, load()).filter((row) => this.filters.every(([c, v]) => row[c] === v));
    rows = rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
    rows = [...rows].sort((a, b) => {
      for (const { column, ascending } of this.orderBy) {
        const x = a[column], y = b[column];
        const diff = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt");
        if (diff) return ascending ? diff : -diff;
      }
      return 0;
    });
    if (this.bounds) rows = rows.slice(this.bounds[0], this.bounds[1] + 1);
    const pick = (row: Row) =>
      this.columns
        ? Object.fromEntries(
          this.columns.map((c) => {
            const { key, embedded } = columnKey(c);
            return [key, Object.hasOwn(row, key) ? row[key] : (embedded ? [] : null)];
          }),
        )
        : row;
    if (this.maybeOne) return { data: rows.length === 1 ? pick(rows[0]) : null, error: null };
    if (this.one) {
      return rows.length === 1
        ? { data: pick(rows[0]), error: null }
        : { data: null, error: { code: "PGRST116", message: "not_found" } };
    }
    return { data: rows.map(pick), error: null };
  }

  then<A = { data: unknown; error: unknown }, B = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

// ------------------------------------------------------------------------------------------------
// Funções da base de dados (RPC) e Edge Functions

async function rpc(name: string, args: Record<string, unknown> = {}) {
  await wait(150);
  const state = load();
  const user = state.users.find((u) => u.id === state.userId);

  switch (name) {
    case "get_org_public": {
      const key = String(args.p_host ?? "").toLowerCase();
      const org = DEMO_ORGS.find((o) => o.keys.includes(key) || key.startsWith(`${o.slug}.`)) ?? DEMO_ORGS[0];
      const { keys: _keys, ...publicOrg } = org;
      return { data: { ...publicOrg, privacy_notice: { ...DEMO_NOTICE, published_at: "2026-11-18T00:00:00Z" } }, error: null };
    }
    case "get_session_context": {
      if (!user) return { data: null, error: { code: "28000", message: "not_authenticated" } };
      const member = user.orgId === args.p_org;
      const role = member ? user.role : null;
      const needsConsent = role === "client" && !state.consents.includes(user.id);
      return {
        data: {
          role,
          client_id: role === "client" ? user.clientId : null,
          mfa_required: role === "admin",
          consent_required: needsConsent,
          notice_missing: false,
          notice: needsConsent ? DEMO_NOTICE : null,
        },
        error: null,
      };
    }
    case "accept_privacy_notice": {
      if (!user || args.p_notice_id !== DEMO_NOTICE.id) return { data: null, error: { code: "P0002", message: "not_found" } };
      update((s) => {
        if (!s.consents.includes(user.id)) s.consents.push(user.id);
      });
      return { data: null, error: null };
    }
    case "get_client_processes": {
      if (!user || user.role !== "client" || user.orgId !== args.p_org || !state.consents.includes(user.id)) {
        return { data: [], error: null };
      }
      // O cenário da Marta já tem proposta aceite; o novo cliente ainda não tem processo.
      return {
        data: visibleRows("processes", state).map((p) => ({ ...p, proposal_accepted: true })),
        error: null,
      };
    }
    case "set_document_visibility":
    case "create_document_request":
    case "remove_document_request":
    case "review_document_request":
    case "register_upload":
    case "register_issued_document":
    case "create_client_process":
    case "next_proposal_reference":
      return { data: null, error: { code: "P0001", message: "demo_read_only" } };
    default:
      return { data: null, error: { code: "PGRST202", message: "not_found" } };
  }
}

/** Erro de Edge Function no formato do supabase-js (o corpo traz { error: "codigo" }). */
function functionError(code: string, status: number) {
  const context = new Response(JSON.stringify({ error: code }), { status, headers: { "content-type": "application/json" } });
  return Object.assign(new Error(code), { name: "FunctionsHttpError", context });
}

async function invoke(name: string, options: { body?: Record<string, unknown> } = {}) {
  await wait(500);
  if (name === "sign-download") return { data: null, error: functionError("demo_read_only", 400) };
  if (name !== "invite-client") return { data: null, error: functionError("not_found", 404) };
  const state = load();
  const user = state.users.find((u) => u.id === state.userId);
  if (!user || user.role !== "admin") return { data: null, error: functionError("not_found", 404) };
  if (state.aal !== "aal2") return { data: null, error: functionError("mfa_required", 403) };
  const client = state.clients.find((c) => c.id === options.body?.client_id && c.organization_id === user.orgId);
  if (!client) return { data: null, error: functionError("not_found", 404) };
  if (client.last_invite_sent_at && Date.now() - Date.parse(client.last_invite_sent_at) < 60_000) {
    return { data: null, error: functionError("invite_too_soon", 429) };
  }
  const resent = client.invited_at !== null;
  update((s) => {
    const row = s.clients.find((c) => c.id === client.id)!;
    const now = new Date().toISOString();
    row.invited_at ??= now;
    row.last_invite_sent_at = now;
    if (!s.users.some((u) => u.clientId === client.id)) {
      s.users.push({ id: `demo-user-${client.id}`, email: client.email, orgId: client.organization_id, role: "client", clientId: client.id });
    }
    s.lastLink = { email: client.email, token: randomToken(), type: "magiclink" };
  });
  return { data: { ok: true, resent }, error: null };
}

// ------------------------------------------------------------------------------------------------
// Cliente

export function createDemoClient() {
  const auth = {
    async getSession() {
      return { data: { session: sessionFor(load()) }, error: null };
    },
    onAuthStateChange(listener: AuthListener) {
      authListeners.add(listener);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(listener) } } };
    },
    async refreshSession() {
      const session = sessionFor(load());
      return { data: { session, user: session?.user ?? null }, error: null };
    },
    async signOut() {
      const state = update((s) => {
        s.userId = null;
        s.aal = "aal1";
      });
      emit("SIGNED_OUT", state);
      return { error: null };
    },
    async signInWithOtp({ email }: { email: string }) {
      await wait();
      update((s) => {
        // Só "envia" o email a quem tem conta de cliente (como o Supabase, sem o revelar).
        if (s.users.some((u) => u.email === email && u.role === "client")) {
          s.lastLink = { email, token: randomToken(), type: "magiclink" };
        }
      });
      return { data: { user: null, session: null }, error: null };
    },
    async verifyOtp({ token_hash }: { token_hash: string; type: string }) {
      await wait();
      const state = load();
      const link = state.lastLink;
      const user = link && link.token === token_hash ? state.users.find((u) => u.email === link.email) : undefined;
      if (!user) return { data: { session: null, user: null }, error: authError("otp_expired", 403) };
      const next = update((s) => {
        s.userId = user.id;
        s.aal = "aal1";
        s.lastLink = null; // uso único
      });
      emit("SIGNED_IN", next);
      return { data: { session: sessionFor(next), user: sessionFor(next)?.user ?? null }, error: null };
    },
    async signInWithPassword({ email }: { email: string; password: string }) {
      await wait();
      const user = load().users.find((u) => u.email === email && u.role === "admin");
      if (!user) return { data: { session: null, user: null }, error: authError("invalid_credentials") };
      const next = update((s) => {
        s.userId = user.id;
        s.aal = "aal1";
      });
      emit("SIGNED_IN", next);
      return { data: { session: sessionFor(next), user: sessionFor(next)?.user ?? null }, error: null };
    },
    async resetPasswordForEmail(email: string) {
      await wait();
      update((s) => {
        if (s.users.some((u) => u.email === email && u.role === "admin")) {
          s.lastLink = { email, token: randomToken(), type: "recovery" };
        }
      });
      return { data: {}, error: null };
    },
    async updateUser() {
      await wait();
      return { data: { user: sessionFor(load())?.user ?? null }, error: null };
    },
    mfa: {
      async listFactors() {
        const state = load();
        const factors = (state.factors[state.userId ?? ""] ?? []).map((f) => ({
          id: f.id,
          factor_type: "totp",
          status: f.status,
          friendly_name: "Portal",
          created_at: "",
          updated_at: "",
        }));
        return { data: { all: factors, totp: factors.filter((f) => f.status === "verified"), phone: [] }, error: null };
      },
      async unenroll({ factorId }: { factorId: string }) {
        update((s) => {
          const id = s.userId ?? "";
          s.factors[id] = (s.factors[id] ?? []).filter((f) => f.id !== factorId);
        });
        return { data: { id: factorId }, error: null };
      },
      async enroll() {
        await wait();
        const id = `demo-factor-${randomToken().slice(0, 8)}`;
        update((s) => {
          const userId = s.userId ?? "";
          s.factors[userId] = [...(s.factors[userId] ?? []), { id, status: "unverified" }];
        });
        const secret = "DEMO" + randomToken().toUpperCase().replace(/[^A-Z2-7]/g, "7").slice(0, 28);
        return { data: { id, type: "totp", totp: { qr_code: demoQrCode(secret), secret, uri: "" } }, error: null };
      },
      async challengeAndVerify({ factorId, code }: { factorId: string; code: string }) {
        await wait();
        // Na demonstração aceita-se qualquer código de 6 dígitos.
        if (!/^\d{6}$/.test(code)) return { data: null, error: authError("mfa_verification_failed", 422) };
        const next = update((s) => {
          const factor = (s.factors[s.userId ?? ""] ?? []).find((f) => f.id === factorId);
          if (factor) factor.status = "verified";
          s.aal = "aal2";
        });
        emit("MFA_CHALLENGE_VERIFIED", next);
        return { data: { access_token: sessionFor(next)?.access_token }, error: null };
      },
    },
  };

  return {
    auth,
    rpc,
    from: (table: string) => new DemoQuery(table),
    functions: { invoke },
    storage: {
      from: () => ({ upload: async () => ({ data: null, error: { message: "demo_read_only" } }) }),
    },
  };
}

export function demoSignOut(): void {
  update((s) => {
    s.userId = null;
    s.aal = "aal1";
  });
}
