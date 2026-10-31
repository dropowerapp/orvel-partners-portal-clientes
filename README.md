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
| 2 | Autenticação (MFA equipa, link mágico, convite), consentimento, tema, i18n | — |
| 3 | Painel da equipa: processos, ficha, pessoas, proposta, pagamentos | — |
| 4 | Área do cliente: início, proposta e aceitação, pagamento, os meus dados | — |
| 5 | Documentos: pedidos, upload, validação, emitidos, downloads assinados | — |
| 6 | Cronologia, prazos e calendário | — |
| 7 | Emails (Brevo) e tarefas agendadas (avisos, resumo semanal, limpeza) | — |
| 8 | Teste do fluxo completo, deploy | — |

## Estrutura

```
supabase/
  config.toml          Configuração local (registo público desligado, MFA TOTP, buckets)
  migrations/          Esquema, lógica, RLS, funções do cliente, Storage, organização Orvel
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

## Regras de segurança (resumo)

- RLS ativa em todas as tabelas; todas as políticas filtram por organização.
- Equipa: só com MFA (a base de dados exige `aal2` no token); sem MFA não lê nada.
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
