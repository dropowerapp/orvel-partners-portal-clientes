# Portal de clientes

Área de cliente e painel da equipa para consultoras de constituição de empresas e relocalização.
Primeira organização: Orvel Partners. Preparado para white label (várias organizações na mesma
base de dados), sem o construir já.

- Plano aprovado (esquema, RLS, ecrãs, decisões): [`docs/plano.md`](docs/plano.md)
- Stack: Supabase (Postgres + RLS, Auth, Storage, Edge Functions, pg_cron) · React + TypeScript + Tailwind (Vite) · Vercel · Brevo

> Em desenvolvimento usam-se **só dados fictícios** (`supabase/seed.sql`, emails `@exemplo.test`).

## Estado

| Etapa | Conteúdo | Estado |
|---|---|---|
| 1 | Esquema, RLS, funções do cliente, Storage, dados fictícios, testes de RLS | ✅ |
| 2 | Autenticação (MFA equipa, link mágico, convite), consentimento, tema, i18n | ✅ (por validar num Supabase real) |
| 3 | Painel da equipa: processos, ficha, pessoas, proposta, pagamentos | — |
| 4 | Área do cliente: início, proposta e aceitação, pagamento, os meus dados | — |
| 5 | Documentos: pedidos, upload, validação, emitidos, downloads assinados | — |
| 6 | Cronologia, prazos e calendário | — |
| 7 | Emails (Brevo) e tarefas agendadas (avisos, resumo semanal, limpeza) | — |
| 8 | Teste do fluxo completo, deploy | — |

## Estrutura

```
web/                   Portal (Vite + React + TypeScript + Tailwind); textos em web/src/i18n/pt-PT.json
supabase/
  config.toml          Configuração local (registo público desligado, MFA TOTP, buckets, hook de email)
  migrations/          Esquema, lógica, RLS, funções do cliente, Storage, organização Orvel, autenticação
  functions/           Edge Functions (Deno): invite-client, auth-send-email; textos dos emails em _shared/i18n
  templates/           Modelos de email de reserva (só quando o hook está desligado, como em local)
  seed.sql             Dados fictícios para desenvolvimento local
  tests/               Testes pgTAP (RLS e lógica de negócio)
scripts/local/         Alternativa sem Docker: Postgres simples + réplica mínima do Supabase
docs/plano.md          Plano técnico aprovado
```

## Base de dados em desenvolvimento

### Com Supabase CLI (recomendado; precisa de Docker)

```bash
npm install
```

```bash
npm run db:start
```

```bash
npm run db:reset
```

```bash
npm run db:test
```

### Sem Docker (Postgres 16 + pgTAP instalados localmente)

Os scripts em `scripts/local/` criam a base de dados `portal` num Postgres simples, com uma
réplica mínima dos schemas `auth` e `storage` do Supabase. Servem para correr as migrações e os
testes; não substituem a stack completa (Auth, Storage, Edge Functions).

```bash
PGHOST=/var/tmp/pg PGPORT=54322 npm run db:reset:local
```

```bash
PGHOST=/var/tmp/pg PGPORT=54322 npm run db:test:local
```

## Portal (frontend)

```bash
npm --prefix web install
```

Copiar `web/.env.example` para `web/.env.local` e preencher `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` (os valores de `npm run db:start`, ou do projeto de desenvolvimento).
Só valores públicos: nunca a `service_role`.

```bash
npm run web:dev
```

```bash
npm run web:test
```

Em `localhost`, o portal abre a organização Orvel (o seed acrescenta `localhost` aos hostnames).
Para ver a organização fictícia "Consultora Exemplo", abrir `http://localhost:5173/?org=exemplo`
(só em desenvolvimento).

Acessos locais (dados fictícios, ver `supabase/seed.sql`): equipa `equipa@exemplo.test` /
`Orvel-Local-2026!` (pede a configuração do MFA no primeiro login); clientes por link mágico
(`rui.ficticio@exemplo.test` ainda não aceitou o aviso de privacidade; `marta.exemplo@exemplo.test`
já aceitou). Os emails de login aparecem no Inbucket/Mailpit (`http://127.0.0.1:54324`).

## Edge Functions

| Função | Para quê | Autenticação |
|---|---|---|
| `invite-client` | Envia ou reenvia o convite a um cliente (cria a conta, liga-a ao cliente, email com a marca) | Token da sessão; exige equipa com MFA |
| `auth-send-email` | Hook do Supabase Auth: link mágico e recuperação de password pela Brevo, com a marca da organização | Assinatura `SEND_EMAIL_HOOK_SECRET` |

Segredos: ver `supabase/functions/.env.example`. Localmente, copiar para `supabase/functions/.env`
(com `EMAIL_MODE=log`, os emails do convite são escritos no log da função em vez de enviados).

```bash
npm run functions:serve
```

```bash
npm run functions:test
```

## Regras de segurança (resumo)

- RLS ativa em todas as tabelas; todas as políticas filtram por organização.
- Equipa: só com MFA (a base de dados exige `aal2` no token); sem MFA não lê nada.
- Cliente: sem ter aceitado o aviso de privacidade em vigor não lê nem altera nada (regra na base
  de dados, não só no ecrã). Uma nova versão publicada volta a pedir o consentimento.
- Registo público desligado: só entra quem a equipa convidou (`invite-client`).
- Funções `admin_*` (convite, emails): só a chave de serviço, dentro das Edge Functions.
- Cliente: lê os seus dados; escreve só através de funções validadas (`update_my_details`,
  `save_person`, `delete_person`, `set_company_names`, `accept_proposal`, `register_upload`,
  `accept_privacy_notice`).
- Custos, margem, emissor das faturas, gestor responsável e notas: `process_internal` e
  `internal_notes`, só equipa. O cliente nunca vê nomes da equipa.
- Bucket `documents` privado, sem leitura direta: downloads só por URL assinado (Edge Function,
  etapa 5). Uploads do cliente só para `{org}/{processo}/uploads/{pedido}/`.
- Papel de parceiro previsto mas desligado (`organizations.partner_role_enabled = false`).
- Erros das funções usam códigos estáveis (ex.: `process_closed`, `proposal_expired`) traduzidos
  no frontend.

### Convenções para novas migrações

- Funções em `private`: terminar a migração com
  `revoke execute on all functions in schema private from public;` e conceder só o necessário.
- Funções em `public`: `revoke execute ... from public, anon` e `grant ... to authenticated`.
- Tabelas novas: `organization_id`, chave composta `(process_id, organization_id)` quando ligadas
  a um processo, RLS ativa e políticas por organização.
- O teste `supabase/tests/01_catalog.sql` falha se alguma destas regras for quebrada.

## Configurar um projeto Supabase (desenvolvimento ou produção)

Em desenvolvimento, só dados fictícios. No painel do Supabase:

1. **Authentication → Sign In / Providers → Email**: desligar "Allow new users to sign up";
   "Email OTP Expiration" = 3600 segundos.
2. **Authentication → URL Configuration**: Site URL `https://portal.orvelpartners.com` (em
   desenvolvimento, `http://localhost:5173`); Redirect URLs com `https://portal.orvelpartners.com/**`
   (e `http://localhost:5173/**` no projeto de desenvolvimento).
3. **Authentication → Multi-Factor**: TOTP ligado (já vem ligado).
4. **Authentication → Passwords**: mínimo 12 caracteres, com minúsculas, maiúsculas e números.
5. Base de dados (a partir do repositório):

```bash
npx supabase link --project-ref <referencia-do-projeto>
```

```bash
npx supabase db push
```

6. Edge Functions:

```bash
npx supabase functions deploy invite-client auth-send-email
```

7. **Authentication → Hooks → Send Email**: tipo HTTPS, URL
   `https://<referencia-do-projeto>.supabase.co/functions/v1/auth-send-email`, gerar o segredo.
8. Segredos das funções (o segredo do passo 7 e a chave da Brevo):

```bash
npx supabase secrets set BREVO_API_KEY=<chave> SEND_EMAIL_HOOK_SECRET=<segredo> ALLOWED_ORIGINS=https://portal.orvelpartners.com AUTH_LINK_EXPIRY_HOURS=1
```

9. Frontend (Vercel ou `web/.env.local`): `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (Project Settings → API; a chave pública "anon"/"publishable").

Membro da equipa que perdeu a aplicação de autenticação: em Authentication → Users, abrir o
utilizador e remover o fator MFA; no login seguinte, o portal pede para o configurar de novo.

## Primeiro administrador

Depois do deploy (detalhado na etapa 8):

1. No painel do Supabase, em Authentication → Users, criar o utilizador com email e password.
2. No SQL Editor, associá-lo à organização:

```sql
insert into public.memberships (user_id, organization_id, role, display_name)
select u.id, o.id, 'admin', 'Nome interno'
from auth.users u, public.organizations o
where u.email = 'email-do-administrador' and o.slug = 'orvel';
```

3. No primeiro login, o portal pede a configuração do MFA (aplicação de autenticação).

## Antes de abrir aos clientes

- Publicar o aviso de privacidade validado pelo advogado (a versão 1 criada pelas migrações é
  provisória e está por publicar; sem um aviso publicado, a área de cliente não abre).
- Rever com o advogado o texto de aceitação da proposta (`organizations.proposal_acceptance_text`).
- Configurar dados bancários e WhatsApp no ecrã de definições.
