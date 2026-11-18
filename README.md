# Portal de clientes

Área de cliente e painel da equipa para consultoras de constituição de empresas e relocalização.
Primeira organização: Orvel Partners. Preparado para white label (várias organizações na mesma
base de dados), sem o construir já.

- Plano aprovado (esquema, RLS, ecrãs, decisões): [`docs/plano.md`](docs/plano.md)
- Stack: Supabase (Postgres + RLS, Auth, Storage, Edge Functions, pg_cron) · React + TypeScript + Tailwind (Vite) · Vercel · Resend

> Em desenvolvimento usam-se **só dados fictícios** (`supabase/seed.sql`, emails `@exemplo.test`).

## Estado

| Etapa | Conteúdo | Estado |
|---|---|---|
| 1 | Esquema, RLS, funções do cliente, Storage, dados fictícios, testes de RLS | ✅ |
| 2 | Autenticação (MFA equipa, link mágico, convite), consentimento, tema, i18n | ✅ (validada no Supabase de dev a 17/11/2026) |
| 3 | Painel da equipa: processos, ficha, pessoas, proposta, pagamentos | ✅ no ramo `etapa-3-painel-equipa` (testada no Supabase de dev a 17/11/2026; falta a revisão no browser) |
| 4 | Área do cliente: início, proposta e aceitação, pagamento, os meus dados | ✅ ramo `etapa-4-area-cliente` (também percurso por fases e prazos; testada no Supabase de dev a 18/11/2026: db-test 268/268, e2e 66/66) |
| 5 | Documentos: pedidos, upload, validação, emitidos, downloads assinados | ✅ `codex/documentos-design`, publicada como Vercel Preview; migração e fluxo autenticado online de envio, revisão e download validados em 17/11/2026. Ver relatório e âmbito abaixo. |
| 6 | Cronologia, prazos e calendário | Implementada e validada localmente em `codex/documentos-design`; migração aplicada ao Supabase de testes. Publicação do frontend e validação autenticada online pendentes. |
| 7 | Emails (Resend) e tarefas agendadas (avisos, resumo semanal, limpeza) | Conservação preparada e migração instalada nos testes e na produção. Eliminação desativada, sem worker publicado nem agendamento. Avisos e resumo semanal por implementar. |
| 8 | Teste do fluxo completo, deploy | Supabase de produção criado e configuração inicial validada em 18/11. Integrações, backups e lançamento pendentes. |

**Produção — 18/11/2026:** criado o Supabase `orvel-portal-producao`
(`ilwkiruybzxplnhwcwrs`), separado dos testes, na organização Orvel Partners e no plano Free.
As 14 migrações estão instaladas; registo público desligado, bucket privado e download protegido
validados. Não contém clientes nem documentos. A eliminação continua desativada. O Resend e
o hook de email estão configurados; o envio técnico para o endereço autorizado foi aceite
pelo Resend, aguardando confirmação de receção. O ensaio autenticado de emails,
administração real, backups e publicação Vercel ainda estão pendentes. A Vercel já tem acesso
recuperado, variáveis Production separadas, Node 24 e domínio associado; falta o DNS.
[Configuração e condições para lançamento](docs/preparacao-producao-2026-11-17.md).

## Etapa 5 e design (17/11/2026)

Implementação no ramo `codex/documentos-design`:
- Navegação lateral no computador, barra inferior no telemóvel, cartões e tipografia com mais
  espaço, mantendo o logótipo, a Source Sans 3 e o azul-marinho da organização.
- Cliente: pedidos agrupados por pessoa, filtros, PDF/JPG/PNG até 10 MB, reenvio após rejeição,
  indicação do motivo, documentos emitidos e acesso por URL assinado.
- Equipa: criar/remover pedidos vazios, aprovar ou pedir correção, ver versões anteriores,
  carregar emitidos com validade e disponibilizá-los ao cliente ou mantê-los internos.
- A migração `20261118110000_documents.sql` valida MFA, organização, processo aberto, pessoa,
  tipo, caminho e metadados do objeto. A revisão exige a versão atual do ficheiro.
- Se o upload terminar mas o registo falhar, o ecrã permite repetir só o registo enquanto permanece
  aberto. Os registos de upload e emitidos são idempotentes. Não são apagados ficheiros existentes.
- Os emails de eventos e a limpeza automática continuam reservados à etapa 7.

Validação local concluída em 17/11/2026: **78 testes de frontend e 308 verificações SQL aprovados**,
build de produção gerado e revisão visual no Chrome em computador e telemóvel (375 px).
Comandos: `npm run web:test`, `npm run web:build` e `npm run db:test:memory`.
O último usa PostgreSQL em memória com pgTAP, o esquema de teste local e todas as migrações;
não contacta o Supabase nem envia emails. Não substitui o teste do Storage/Auth real.

Publicação concluída em 17/11/2026:
- Preview: <https://orvel-partners-portal-clientes-git-c-7a9f04-dropower-s-projects.vercel.app>.
- Código publicado a partir de `a475596`; build Vercel concluído com sucesso.
- Migração aplicada e registada em `supabase_migrations.schema_migrations`, no projeto
  `xdakbbvnpoojhyapznkf`, ramo `main`. **O painel Supabase identifica este ramo como PRODUCTION**;
  o alvo foi confirmado expressamente pela responsável. As referências históricas abaixo a
  "Supabase de dev" referem-se a este projeto de testes. O ambiente isolado de produção foi
  criado posteriormente, em 18/11, conforme o estado atual acima.
- Novo hostname associado à Orvel; callback exato `/auth/confirmar` adicionado às Redirect URLs;
  `Site URL` e `PUBLIC_SITE_URL` apontam para a nova Preview. `ALLOWED_ORIGINS` conserva as cinco
  origens anteriores e acrescenta o novo endereço (a lista anterior foi confirmada pelo seu digest).
- Verificações remotas: página de entrada com marca Orvel; seis funções instaladas com execução
  negada a `anon`; preflight CORS de `sign-download` e `invite-client` devolve o novo endereço.

Validação online concluída em 17/11/2026 com sessão real e PDFs fictícios:
envio → revisão → rejeição → reenvio → aprovação; emitido interno → disponibilizar → download.
Revisão, emissão e abertura de PDFs na interface publicada. Envio/reenvio inicialmente pela API
pública autenticada e depois repetidos pelos botões e seletores de ficheiros da área do cliente
no Chrome, incluindo motivo de correção, histórico, aprovação e abertura da versão final.
Downloads da primeira passagem comparados byte a byte por SHA-256; acesso anónimo e aprovação
pelo próprio cliente recusados. [Relatório, evidências e limites](docs/validacao-documentos-2026-11-17.md).
Não foi executado reset/seed remoto nem foram enviados emails reais. Os 78 testes de frontend
e 308 testes SQL referidos acima foram executados localmente.

## Etapa 6: percurso, prazos e calendário (17/11/2026)

Implementação local no ramo `codex/documentos-design`, mantendo a navegação, a tipografia,
o azul-marinho e os cartões com espaço do design anterior:

- Equipa: criar, editar e remover passos manuais do percurso; datas previstas e de conclusão,
  notas visíveis ao cliente e progresso por fase. Os passos automáticos continuam ligados aos
  eventos do processo e não são editáveis manualmente.
- Prazos por processo: criar prazos manuais, acompanhar renovações e consultar o histórico.
  A validade dos prazos documentais vem do documento de origem; a emissão de um documento novo
  confirma a renovação. Os prazos continuam geríveis após a conclusão do processo.
- Calendário: vista mensal com seleção do dia, vista semanal dos próximos 90 dias, prazos
  vencidos, pesquisa por cliente/pessoa/tipo/título e acesso à ficha do processo.
- Cliente: prazos ativos e histórico de renovações, indicação da pessoa, acesso ao documento
  de origem e consulta das datas e notas do percurso. Prazos de documentos internos não ficam
  visíveis ao cliente.
- Migração `20261118120000_timeline_deadlines.sql`: três funções validadas, MFA e isolamento
  por organização, controlo de alterações concorrentes e auditoria. As escritas diretas nas
  tabelas de passos e prazos passam a ser substituídas por estas funções.

Validação local: **89 testes de frontend e 351 verificações SQL aprovados**, build de produção
gerado e revisão da demonstração no Chrome em computador e telemóvel. O build conserva o aviso
de tamanho do bundle. [Âmbito e publicação pendente](docs/validacao-percurso-prazos-2026-11-17.md).

**Backend atualizado em 17/11/2026:** a migração desta etapa foi aplicada e confirmada no
Supabase existente (`xdakbbvnpoojhyapznkf`), que conserva os dados fictícios. O frontend ainda
aguarda publicação. O acesso à equipa Vercel `dropower-s-projects` foi recuperado em 18/11.
A Preview continua na etapa 5; a validação autenticada da etapa 6
continua pendente. [Estado dos acessos e preparação de produção](docs/preparacao-producao-2026-11-17.md).
Os avisos por email e tarefas agendadas pertencem à etapa 7.

## Estrutura

```
web/                   Portal (Vite + React + TypeScript + Tailwind); textos em web/src/i18n/pt-PT.json
supabase/
  config.toml          Configuração local (registo público desligado, MFA TOTP, buckets, hook de email)
  migrations/          Esquema, lógica, RLS, funções do cliente, Storage, organização Orvel, autenticação,
                       funções do painel da equipa (create_client_process, next_proposal_reference)
  functions/           Edge Functions (Deno): invite-client, auth-send-email, sign-download; textos dos emails em _shared/i18n
  templates/           Modelos de email de reserva (só quando o hook está desligado, como em local)
  seed.sql             Dados fictícios para desenvolvimento local
  tests/               Testes pgTAP (RLS e lógica de negócio)
scripts/local/         Alternativa sem Docker: Postgres simples + réplica mínima do Supabase
branding/<slug>/       Ficheiros da marca de cada organização (logótipo e símbolo, sem alterações)
docs/plano.md          Plano técnico aprovado
```

## Páginas do portal

| Área | Caminho | Conteúdo | Etapa |
|---|---|---|---|
| Cliente | `/` | Início: o que falta da parte do cliente, percurso por fases, pagamento, próximos prazos e contacto | 4 |
| Cliente | `/percurso`, `/prazos` | Percurso por fases, datas e notas; prazos ativos, renovações e documento de origem | 4 + 6 |
| Cliente | `/documentos` | Pedidos por pessoa, filtros, upload/reenvio, estados e documentos emitidos | 5 |
| Cliente | `/mais` → `/proposta`, `/pagamento`, `/dados`, `/contacto` | Proposta (PDF, plano, aceitação), pagamento (dados bancários libertados), os meus dados (contacto, pessoas, nomes da empresa), contacto | 4 |
| Equipa | `/equipa/processos` | Processos com filtros por estado, pesquisa e alertas | 3 |
| Equipa | `/equipa/processos/novo` (`?cliente=id` para um cliente existente) | Novo cliente ou novo processo, com pessoas e convite | 3 |
| Equipa | `/equipa/processos/:id` | Ficha: Resumo · Pessoas e dados · Proposta · Pagamentos · Interno · Atividade | 3 |
| Equipa | `/equipa/processos/:id/percurso` | Passos por fase: criação/edição/remoção manual, estado, datas e nota para o cliente | 6 |
| Equipa | `/equipa/processos/:id/documentos` | Pedidos, revisão, histórico de versões, emitidos e visibilidade para o cliente | 5 |
| Equipa | `/equipa/processos/:id/prazos` | Prazos manuais e documentais, renovação e histórico | 6 |
| Equipa | `/equipa/clientes` | Clientes, convite e novo processo para um cliente existente | 3 |
| Equipa | `/equipa/calendario` | Calendário mensal, próximos 90 dias por semana e prazos vencidos | 6 |
| Equipa | `/equipa/definicoes` | Definições da organização | Etapa posterior |

No telemóvel, o menu do cliente fica numa barra em baixo (Início · Documentos · Percurso · Prazos ·
Mais). Se o cliente tiver mais de um processo, aparece um seletor no topo. O PDF da proposta é
carregado pela equipa para o bucket `documents` e aberto (equipa e cliente) pela função
`sign-download`. Os contactos da Orvel (WhatsApp +971 50 364 2510 e hello@orvelpartners.com) e o
modelo do percurso por fases estão na migração `20261118100000_orvel_percurso.sql`.

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

Usar **Node.js 24 ou superior** (as dependências de testes precisam de uma versão recente).


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

### Modo de demonstração (sem Supabase)

Para ver os ecrãs sem projeto Supabase (por exemplo, para rever o aspeto), com dados fictícios
guardados só no browser. Nenhum email é enviado. Uma faixa amarela no topo tem atalhos para entrar
como cliente novo, cliente com acesso ou equipa (qualquer password; código MFA: quaisquer 6
dígitos), abrir o "email" do link mágico ou do convite e ver outra organização.
A demonstração inclui um processo fictício da Marta, com percurso, pagamentos e documentos
em vários estados, disponível também na área da equipa. As alterações de negócio e os downloads
continuam só no Supabase de desenvolvimento; na demonstração devolvem uma mensagem de só leitura.

Num build, a demonstração só entra com a variável `VITE_DEMO_MODE=true` definida no momento do
build. Na Vercel, essa variável fica **só no ambiente Preview** (nunca em Production). Desde
17/11/2026 está a `false`, porque a pré-visualização passou a usar o projeto Supabase de
desenvolvimento (ver "Pré-visualização da Vercel ligada ao Supabase"). Para voltar à
demonstração, pô-la a `true` e fazer Redeploy. Sem a variável, o código da demonstração não entra
no pacote.

```bash
npm run web:demo
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
| `auth-send-email` | Hook do Supabase Auth: link mágico e recuperação de password pela Resend, com a marca da organização | Assinatura `SEND_EMAIL_HOOK_SECRET` |
| `sign-download` | URL assinado de 60 s para o PDF da proposta ou um documento; a RLS decide (lido com o token do utilizador) e os downloads de ficheiros sensíveis ficam na atividade | Token da sessão |
| `purge-documents` | Simula ou processa a conservação dos documentos sensíveis registados de uma organização; desativada por omissão | Segredo dedicado `RETENTION_JOB_SECRET`; nunca o token de um cliente |

Segredos: ver `supabase/functions/.env.example`. Localmente, copiar para `supabase/functions/.env`
(com `EMAIL_MODE=log`, os emails do convite são escritos no log da função em vez de enviados;
com `EMAIL_LOG_DOMAINS=exemplo.test`, só os dos endereços fictícios ficam no log e os outros saem
pela Resend).

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
8. Resend: em Domains, juntar o domínio da organização (ex.: `orvelpartners.com`, região
   Ireland/eu-west-1) e pôr os registos DNS que a Resend indica (DKIM `resend._domainkey` e o
   subdomínio `send`, que não mexem nas caixas de correio existentes). Quando o domínio estiver
   "Verified", criar uma API key com permissão "Sending access" só para esse domínio.
9. Segredos das funções (o segredo do passo 7 e a chave da Resend):

```bash
npx supabase secrets set RESEND_API_KEY=<chave> SEND_EMAIL_HOOK_SECRET=<segredo> ALLOWED_ORIGINS=https://portal.orvelpartners.com AUTH_LINK_EXPIRY_HOURS=1
```

10. Frontend (Vercel ou `web/.env.local`): `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (Project Settings → API; a chave pública "anon"/"publishable").

### Alternativa sem CLI nem password da base de dados (`scripts/remote/`)

Os mesmos passos pela Management API (`https://api.supabase.com`), só com `curl` e `jq`. Precisam
de `SUPABASE_PROJECT_REF` e de um token pessoal (`sbp_…`, criado em Account → Access Tokens) em
`SUPABASE_ACCESS_TOKEN`, ou de um proxy que o acrescente aos pedidos. Nunca guardar o token no
repositório.

| Script | O que faz |
|---|---|
| `db-push.sh [--dry-run]` | Aplica as migrações em falta, por ordem, cada uma numa transação, e regista-as em `supabase_migrations.schema_migrations` (compatível com `supabase db push`) |
| `db-seed.sh --sim-e-desenvolvimento` | Carrega os dados fictícios; recusa se houver utilizadores fora de `@exemplo.test` e não repete |
| `branding-upload.sh [slug]` | Carrega o logótipo e o símbolo (`branding/<slug>/`) para o bucket `branding` e preenche `logo_path` e `theme.symbol_path` |
| `functions-deploy.sh [função …]` | Publica as Edge Functions com o `verify_jwt` de `config.toml` |
| `secrets-set.sh NOME=valor … \| --list` | Define segredos das funções (só mostra os nomes) |
| `auth-config.sh [--apply]` | Mostra as definições de autenticação atuais e as pretendidas; com `--apply`, aplica-as e liga o hook de email com um segredo novo |
| `db-test.sh` | Corre os testes pgTAP no projeto (tudo desfeito no fim) |
| `e2e.sh` | Teste de ponta a ponta: link mágico, consentimento, equipa com MFA, convite e Storage |

Projeto de desenvolvimento, por esta ordem (dados fictícios; enquanto não houver chave da Resend,
os emails ficam no log da função):

```bash
export SUPABASE_PROJECT_REF=<referencia-do-projeto>
```

```bash
scripts/remote/db-push.sh && scripts/remote/db-seed.sh --sim-e-desenvolvimento
```

```bash
scripts/remote/branding-upload.sh orvel
```

```bash
scripts/remote/functions-deploy.sh
```

```bash
scripts/remote/secrets-set.sh EMAIL_MODE=log PUBLIC_SITE_URL=http://localhost:5173 ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 AUTH_LINK_EXPIRY_HOURS=1
```

```bash
scripts/remote/auth-config.sh
```

```bash
scripts/remote/db-test.sh && scripts/remote/e2e.sh
```

### Pré-visualização da Vercel ligada ao Supabase

As pré-visualizações dos ramos usam o projeto `xdakbbvnpoojhyapznkf`, com dados fictícios e uma
conta de teste real. Este projeto é identificado como `main / PRODUCTION` no painel Supabase:

- `etapa-2-autenticacao`: `https://orvel-partners-portal-clientes-git-e-38d300-dropower-s-projects.vercel.app`
- `etapa-3-painel-equipa`: `https://orvel-partners-portal-clientes-git-e-c4363f-dropower-s-projects.vercel.app`
- `etapa-4-area-cliente`: `https://orvel-partners-portal-clientes-git-e-3e7ea0-dropower-s-projects.vercel.app`
- `codex/documentos-design`: `https://orvel-partners-portal-clientes-git-c-7a9f04-dropower-s-projects.vercel.app` (atual destino dos convites)

Para isso:

- Vercel, só no ambiente Preview: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (a chave pública
  `sb_publishable_…`) e `VITE_DEMO_MODE=false`. Depois de mudar variáveis, fazer Redeploy.
- Supabase: os endereços estão nas Redirect URLs (etapas anteriores: `…vercel.app/**`;
  novo ramo: apenas `/auth/confirmar`), em `ALLOWED_ORIGINS` e
  em `organizations.hostnames` da Orvel (é pelo hostname que o portal escolhe a organização);
  `PUBLIC_SITE_URL` (o endereço dos links dos convites) é o de `codex/documentos-design`. Um ramo novo tem um
  endereço novo, que é preciso acrescentar da mesma forma.
- Emails (desde 17/11/2026): saem pela Resend (`RESEND_API_KEY`, chave "portal-supabase-dev",
  só envio e só `orvelpartners.com`), com `EMAIL_LOG_DOMAINS=exemplo.test`: os emails para os
  endereços fictícios continuam só no log da função (Edge Functions → `auth-send-email` → Logs; os
  convites em `invite-client`), e o e2e lê-os de lá. Os envios reais aparecem em Resend → Emails.
- Conta de cliente de teste com email real: `hello@orvelpartners.com` ("Teste Orvel", sem
  processos), criada a pedido para experimentar o link mágico. Por causa dela, o `db-seed.sh`
  recusa voltar a correr (há um utilizador fora de `@exemplo.test`).
- O Supabase limita os emails de autenticação por hora (era 2). No projeto de desenvolvimento o
  limite está em 30 por hora desde 18/11/2026 (`rate_limit_email_sent`); se o pedido do link do Rui
  falhar com "email rate limit exceeded", as verificações do cliente falham em cadeia: esperar
  uma hora ou subir o limite em Authentication → Rate Limits.
- Com esta configuração, o e2e corre com o endereço de `PUBLIC_SITE_URL`, e o `auth-config.sh`
  tem de manter os endereços nas Redirect URLs:

```bash
SITE_URL=https://orvel-partners-portal-clientes-git-c-7a9f04-dropower-s-projects.vercel.app scripts/remote/e2e.sh
```

```bash
REDIRECT_URLS='http://localhost:5173/**,http://127.0.0.1:5173/**,https://orvel-partners-portal-clientes-git-e-38d300-dropower-s-projects.vercel.app/**,https://orvel-partners-portal-clientes-git-e-c4363f-dropower-s-projects.vercel.app/**,https://orvel-partners-portal-clientes-git-e-3e7ea0-dropower-s-projects.vercel.app/**' scripts/remote/auth-config.sh
```

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

- **Revisão de 17/11/2026: ainda não aprovado para dados reais.** A versão publicada é uma
  Preview de teste; a etapa 6 e a correção de isolamento de sessões descrita abaixo continuam locais.
- Confirmar no projeto remoto as políticas RLS, bucket privado, permissões, MFA da equipa e dos
  administradores das plataformas, origens/callbacks e configuração final de autenticação.
- Separar os ambientes de testes e de clientes reais. Desativar no ambiente de clientes reais
  as contas fictícias, sobretudo a conta da equipa com credenciais documentadas no seed.
  Não basta apagar os processos fictícios: o acesso administrativo dessa conta abrange a organização.
- Confirmar backups e testar a recuperação da base de dados **e dos ficheiros**. Os backups
  de PostgreSQL do Supabase não incluem os objetos do Storage:
  [documentação oficial](https://supabase.com/docs/guides/platform/backups).
- Validar remotamente a limpeza dos documentos sensíveis conforme o prazo de conservação
  aprovado. A implementação local está preparada, mas a eliminação e o agendamento continuam
  desativados a pedido da responsável, enquanto o texto e o prazo não forem aprovados.
- Publicar o aviso de privacidade final validado pelo advogado. O texto criado pelas migrações
  é provisório; a sua utilização nos testes não demonstra revisão jurídica. Sem um aviso
  publicado, a área de cliente não abre.
- Rever com o advogado o texto de aceitação da proposta (`organizations.proposal_acceptance_text`).
- Configurar dados bancários e WhatsApp no ecrã de definições.
- Aplicar as alterações pendentes, configurar domínio/HTTPS e testar o fluxo autenticado
  completo no ambiente final, incluindo entrega real de emails, isolamento entre clientes,
  expiração dos downloads e mudança de conta em várias janelas.

### Revisão do código e dependências (17/11/2026)

Confirmados no código: isolamento por organização/cliente através de RLS, MFA da equipa
verificado na base de dados, documentos em bucket privado, downloads autorizados por RLS com
URL de 60 segundos e auditoria dos pedidos de download sensíveis. A configuração Vercel inclui
CSP, HSTS, bloqueio de enquadramento e `nosniff`. A configuração remota atual não foi novamente
inspecionada nesta revisão, por indisponibilidade de acesso autenticado às plataformas.

Encontrado e corrigido **localmente** um problema de isolamento no browser: o logout noutra
janela, a troca de utilizador ou a redução do nível MFA não limpavam as consultas em memória.
Agora limpam consultas/mutações privadas e a seleção de processo e reiniciam os formulários.
Uma resposta inicial atrasada já não repõe uma sessão terminada. Leituras pendentes também
não repõem a cache depois do logout. Os testes reproduziram as falhas antes da correção.
Não há evidência nesta revisão de exploração ou de acesso indevido na base de dados.
Validação da correção: **94 testes de frontend aprovados**, incluindo cinco regressões de
sessão, e build concluído. A última execução SQL permanece em 351 verificações aprovadas;
esta correção não altera a base de dados.

`npm audit --omit=dev` no frontend concluiu com **0 vulnerabilidades conhecidas**. Uma procura
limitada por padrões de chaves privadas/PAT/Resend/Supabase secret nos ficheiros versionados
atuais não encontrou correspondências; não foi uma análise exaustiva de segredos nem do
histórico Git. O fornecedor, as Edge Functions, as definições remotas, backups e permissões
das contas administrativas não ficam certificados por estes resultados.

Esta revisão é uma avaliação de preparação para publicação, não uma auditoria independente
nem uma garantia de ausência de vulnerabilidades.

### Preparação da produção e conservação (17/11/2026)

A ligação Supabase **ORVEL PARTNERS** ficou operacional em 18/11. O painel da organização
confirma uma única conta Owner, a conta indicada pela responsável, e a ausência da conta
Dropower. Foi criado `orvel-portal-producao` (`ilwkiruybzxplnhwcwrs`) em `eu-west-1`, após
consulta de custo de 0 USD/mês no plano Free. Foram aplicadas as 14 migrações, sem seed nem
cópia de dados. O projeto de testes `xdakbbvnpoojhyapznkf` foi preservado.

Na produção, o registo público e as sessões anónimas estão desligados, TOTP disponível,
passwords com mínimo configurado de 12 caracteres e requisitos de maiúsculas/minúsculas/dígitos.
Site URL, callback exato e CORS estão preparados para `https://portal.orvelpartners.com`;
isto não comprova que o domínio já esteja publicado. `sign-download` v4 está ativa com JWT,
e os testes HTTP recusaram leitura e download sem sessão (401). As tabelas públicas têm RLS,
sem permissões de tabelas para anónimos; o bucket de documentos é privado.

**GitHub e Vercel ficam como estão por agora**, por indicação expressa da responsável.
A autorização de equipa Vercel foi concluída e verificada em 18/11. Foram criadas apenas em
Production as variáveis do Supabase novo e `VITE_DEMO_MODE=false`, preservando Preview.
Raiz `web`, Node 24, `npm ci`, `npm run build` e saída `dist` confirmados no painel. O build
local de produção passou e o pacote usa apenas o backend novo, sem contas de demonstração.
O domínio `portal.orvelpartners.com` está associado; falta o CNAME no DNS externo. A utilização
de código/conversas deste projeto para treino de IA na Vercel foi desligada, com autorização
expressa, e confirmada após recarregar o painel. O plano atual é Hobby; decidir o plano adequado
ao uso comercial antes do lançamento. Não houve novo deploy do frontend. As funções de email
de produção e o hook assinado estão configurados; o Resend aceitou a mensagem técnica para
`hello@orvelpartners.com`, ainda sem confirmação da caixa de correio. A função temporária de
teste já não pode enviar emails. O ensaio autenticado de emails,
conta real de administração/MFA, marca no Storage, backups,
aviso de privacidade aprovado e validação autenticada final continuam pendentes.
[Evidências e próximos passos](docs/preparacao-producao-2026-11-17.md).

No Supabase de testes foram aplicadas as migrações de cronologia/prazos, conservação e
permissões de infraestrutura. `sign-download` foi atualizada para a versão 4, com validação do
caminho antes da assinatura. A função de eliminação **não foi publicada** e não existe
agendamento de limpeza. A responsável confirmou que o aviso e o prazo de conservação ainda
não estão aprovados: **não ativar a eliminação**.

- `20261118130000_retention.sql` instala uma fila privada e quatro funções exclusivas do
  servidor. A seleção limita-se à organização configurada, a processos fechados e a documentos
  sensíveis cujo prazo terminou. Lotes de 25, reservas de cinco minutos e novas tentativas
  evitam processar o mesmo ficheiro em simultâneo.
- O serviço apaga pela API de Storage e só depois confirma a ausência, marca `purged_at` e
  regista `document.purged`. Não apaga os metadados do processo, nem documentos não sensíveis.
  Uma falha não é comunicada como eliminação concluída. A confirmação é idempotente.
- Depois de começar uma reserva, o processo não pode ser reaberto e o caminho do documento
  não pode ser trocado. Se houver falhas persistentes, resolver a causa e repetir a tarefa;
  não remover reservas manualmente sem verificar se o Storage já foi alterado.
- `purge-documents` simula por omissão. Exige segredo dedicado de pelo menos 32 caracteres
  e `RETENTION_ORGANIZATION_ID`; só aceita eliminação quando o corpo pede `dry_run:false`
  **e** `RETENTION_ENABLED=true`. A migração e o deploy não ativam qualquer tarefa.
- O agendamento opcional em `scripts/remote/retention-schedule-dry-run.sql` usa Vault e faz
  apenas simulação diária. O ficheiro não foi executado. É preciso monitorizar a resposta HTTP,
  além do estado do cron. Uma ativação futura exige aprovação da política e ensaio remoto.
- Os caminhos dos documentos e PDFs de propostas são validados também na alteração e antes
  de gerar downloads, impedindo que um registo visível aponte para outra organização/processo.
- `20261118140000_platform_privileges.sql` retira a execução de `rls_auto_enable()` aos papéis
  da API, quando a função existe. O event trigger continua ativo e conserva a proteção das
  tabelas novas; não se altera o seu corpo.

`scripts/remote/production-readiness.sql` prepara uma inspeção de leitura, com contagens e
resultados sem emails, caminhos de documentos ou segredos. Distingue os controlos que pode
verificar dos pontos que continuam a exigir acesso às plataformas ou decisão da responsável.

Para backups, a escolha do destino e a configuração continuam pendentes. O ensaio deve restaurar
uma base e ficheiros fictícios num projeto isolado, confirmar hashes e permissões e documentar
o tempo e a perda máxima de dados possíveis. A política de conservação deve abranger também
as cópias: uma restauração não deve voltar a disponibilizar ficheiros já eliminados pela política.
Esta implementação de limpeza cobre documentos registados; ficheiros órfãos de uploads
interrompidos e a conservação de backups ainda precisam de tratamento antes de prometer
eliminação completa de todas as cópias.

Validação local desta preparação: **94 testes de frontend, 381 verificações SQL e 39 testes
de Edge Functions aprovados**, build de produção e `deno check` concluídos. A consulta de
preparação de produção também foi executada numa transação de leitura numa réplica local;
detetou corretamente a ausência de administrador e de aviso publicado numa instalação nova.
Depois da migração de permissões, as **381 verificações SQL** voltaram a passar. A consulta de
preparação foi também executada no projeto remoto: nenhuma migração em falta, tabelas públicas
com RLS, bucket privado e zero permissões de leitura de tabelas para anónimos. Os testes HTTP
recusaram leitura e download anónimos (401) e confirmaram o CORS da Preview (200).
Em 18/11, a consulta foi repetida no novo projeto de produção: sem migrações em falta, sem
dados de teste e sem administrador ou aviso publicado, como esperado nesta fase. As variáveis
de servidor incluem `RETENTION_ENABLED=false`; `purge-documents` continua ausente e não há
`pg_cron`. Continuam pendentes as integrações finais, recuperação de backups, aprovação jurídica
e ensaio autenticado no domínio final. [Evidências e próximos passos](docs/preparacao-producao-2026-11-17.md).
