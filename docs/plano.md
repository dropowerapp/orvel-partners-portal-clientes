# Portal de clientes Orvel Partners: plano técnico para aprovação

Versão 1.1 · 31/10/2026 · Baseado no briefing v2. **Aprovado** a 31/10/2026, com a alteração da D7.

---

## 1. Arquitetura

| Peça | Escolha |
|---|---|
| Repositório | Monorepo: `apps/web` (frontend) e `supabase/` (migrações, dados fictícios, Edge Functions, testes) |
| Frontend | Vite + React + TypeScript + Tailwind, React Router, TanStack Query, react-hook-form + zod, react-i18next (`pt-PT` agora, `en` na fase 2) |
| Alojamento | Vercel, SPA estática em `portal.orvelpartners.com` |
| Segurança | Toda na base de dados (RLS) e nas Edge Functions. O frontend só tem o URL e a chave anónima do Supabase, que são públicos. |
| Edge Functions (Deno) | `invite-client`, `auth-send-email` (hook de email do Supabase Auth), `accept-proposal`, `sign-download`, `send-emails`, `daily-jobs`, `weekly-digest` |
| Tarefas agendadas | `pg_cron` → `pg_net` → Edge Function, com o segredo de chamada no Vault. Horários na hora do Dubai. |
| Emails | Fila `email_outbox`: os triggers põem mensagens na fila e `send-emails` envia-as pela Brevo a cada minuto, com novas tentativas e registo. Templates em código, com os textos nos ficheiros de tradução e a marca da organização. |
| Ambientes | Supabase local (CLI) para desenvolvimento e testes, um projeto Supabase de dev (só dados fictícios) e o projeto de produção |

---

## 2. Esquema da base de dados

**Convenções**
- Identificadores e valores de estado em inglês. Textos visíveis em ficheiros de tradução (interface) ou, nos conteúdos configuráveis por organização, em campos `jsonb` por idioma (ex.: `{"pt-PT": "Licença emitida"}`).
- Todas as tabelas de negócio têm `id uuid`, `organization_id`, `created_at` e `updated_at`.
- As tabelas ligadas a um processo usam uma chave estrangeira composta `(process_id, organization_id) → processes(id, organization_id)`. Assim, a base de dados não deixa associar um registo a um processo de outra organização, mesmo que haja um erro no código.

```
organizations ─┬─ memberships ── auth.users
               ├─ partners ── partner_assignments ──┐
               ├─ bank_accounts                     │
               ├─ document_types / templates        │
               └─ clients ── processes ─────────────┘
                               ├─ people ─┬─ document_requests ── documents
                               │          └─ deadlines ◄── (documento emitido com validade)
                               ├─ proposals
                               ├─ payments ── documents (fatura)
                               ├─ timeline_steps
                               ├─ process_internal, internal_notes   (só equipa)
                               └─ activity_log, email_outbox         (sistema)
```

### 2.1 Organização e acessos

**organizations**: `name`, `slug`, `hostnames text[]`, `logo_path`, `theme jsonb` (tokens de cor e fonte), `email_from_name`, `email_from_address`, `email_reply_to`, `team_notification_email` (por defeito `hello@orvelpartners.com`), `contact_whatsapp`, `contact_email`, `reminder_days int[]` (por defeito `{90,60,30,7}`), `weekly_digest_weekday`, `sensitive_retention_days int` (por defeito 30), `proposal_ref_prefix` (`ORV`), `timezone` (`Asia/Dubai`), `default_locale` (`pt-PT`), `partner_role_enabled bool` (por defeito `false`).

**memberships**: `user_id → auth.users`, `organization_id`, `role` (`admin` | `client` | `partner`), `client_id` (obrigatório se for cliente), `partner_id` (obrigatório se for parceiro), `display_name` (visível apenas à equipa), `is_active`. Única por (`user_id`, `organization_id`).

**partners**: `name`, `notes`. Só a equipa.

**partner_assignments**: `partner_id`, `process_id`, `assigned_by`, `assigned_at`. Fica vazia enquanto o papel estiver desligado.

**bank_accounts**: `label`, `beneficiary`, `bank_name`, `iban`, `swift`, `currency`, `notes`.

**privacy_notices**: `version`, `body jsonb` (por idioma, com o prazo de conservação inserido automaticamente), `published_at`.

**privacy_consents**: `user_id`, `client_id`, `notice_id`, `accepted_at`, `ip`, `user_agent`.

### 2.2 Clientes e processos

**clients**: `user_id` (vazio até o convite ser usado), `full_name`, `email`, `phone`, `country`, `address_line`, `city`, `postal_code`, `address_country`, `locale`, `invited_at`, `last_invite_sent_at`.

**processes**: `client_id`, `status` (`proposal_sent` | `awaiting_payment` | `awaiting_documents` | `in_progress` | `completed` | `cancelled`), `plan_name`, `includes_bank_account`, `free_zone`, `visa_count`, `company_name_options text[]` (1 a 3), `bank_account_id`, `bank_details_released_at`, `bank_details_released_by`, `completed_at`, `cancelled_at`, `sensitive_purge_on date`.

**people**: `process_id`, `relationship` (`holder` | `spouse` | `child` | `other`), `full_name`, `nationality`, `date_of_birth`. Não guarda números de passaporte; o passaporte é um ficheiro.

### 2.3 Proposta e pagamento

**proposals**: `process_id`, `reference` (única na organização, formato `PREFIXO-AAAA-NNN`), `pdf_path`, `plans jsonb` (`[{name, price_aed, includes_bank_account}]`), `chosen_plan`, `valid_until`, `status` (`draft` | `sent` | `accepted` | `expired` | `declined`), `sent_at`, `accepted_at`, `accepted_by`, `accepted_ip inet`, `accepted_user_agent`, `accepted_text` (o texto exato que o cliente aceitou), `declined_at`.

**payments**: `process_id`, `description`, `amount_aed numeric(12,2)`, `amount_paid_aed`, `status` (`pending` | `partial` | `paid`), `due_on`, `paid_on`, `invoice_document_id → documents`.

### 2.4 Percurso, pedidos, documentos e prazos

**document_types**: `key`, `label jsonb`, `direction` (`upload` | `issued`), `is_sensitive`, `deadline_type` (vazio, ou `licence` | `office_contract` | `establishment_card` | `residence_visa` | `emirates_id` | `other`), `is_active`, `position`.
- Dados iniciais, enviados pelo cliente: passaporte\*, fotografia\*, certidão de casamento, certidão de nascimento, outro.
- Dados iniciais, emitidos: licença comercial (→ prazo `licence`), certificado de constituição, estatutos (MOA), contrato de escritório (→ `office_contract`), Establishment Card (→ `establishment_card`), e-Visa, visto de residência (→ `residence_visa`), Emirates ID\* (→ `emirates_id`), fatura, outro.
- \* sensível por defeito. A marca pode mudar-se por tipo.

**timeline_templates**: `name`, `is_default`.

**timeline_template_steps**: `template_id`, `position`, `title jsonb`, `condition` (vazio ou `requires_bank_account`), `auto_event` (vazio, ou `proposal_accepted` | `payment_confirmed` | `documents_received` | `process_completed`). Os dados iniciais são os 14 passos da secção 8 do briefing.

**timeline_steps**: `process_id`, `position`, `title jsonb`, `status` (`todo` | `in_progress` | `done`), `planned_on`, `done_on`, `client_note`, `auto_event`.

**document_request_templates**: `document_type_id`, `applies_to` (`each_person` | `spouse` | `child`), `position`. Dados iniciais: passaporte e fotografia para cada pessoa, certidão de casamento para o cônjuge, certidão de nascimento para cada filho.

**document_requests**: `process_id`, `person_id`, `document_type_id`, `custom_label` (para os pedidos acrescentados à mão), `instructions`, `status` (`pending` | `submitted` | `approved` | `rejected`), `rejection_reason`, `reviewed_by`, `reviewed_at`.

**documents**: `process_id`, `person_id`, `request_id`, `document_type_id`, `source` (`client_upload` | `issued`), `title`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `is_sensitive`, `issued_on`, `expires_on`, `uploaded_by`, `visible_to_client`, `shared_with_partner` (por defeito `false`), `purged_at`, `purged_reason`. Depois da limpeza a linha fica, sem o ficheiro, para auditoria.

**deadlines**: `process_id`, `person_id`, `document_id` (documento de origem, opcional), `deadline_type`, `title`, `due_on`, `status` (`open` | `renewing` | `renewed` | `dismissed`), `reminders_sent int[]`, `created_by` (vazio quando é criado automaticamente).

### 2.5 Só equipa e sistema

**process_internal** (uma linha por processo): `manager_user_id` (gestor responsável, visível apenas à equipa), `partner_id`, `partner_cost_aed`, `other_costs jsonb` (`[{label, amount_aed}]`), `sale_price_aed`, `margin_aed` (coluna calculada), `invoice_issuer`. Mudei o nome de `internal` porque `internal` é um tipo reservado do Postgres.

**internal_notes**: `process_id`, `author_id`, `body`, `created_at`.

**activity_log**: `process_id`, `actor_user_id` (vazio quando é o sistema), `actor_role`, `action` (ex.: `document.uploaded`, `document.downloaded`, `document.approved`, `document.rejected`, `document.purged`, `process.status_changed`, `proposal.accepted`, `payment.updated`, `bank_details.released`, `client.invited`, `consent.given`), `entity_type`, `entity_id`, `metadata jsonb`, `ip`, `created_at`. Só recebe inserções, sempre feitas por funções do servidor. Ninguém edita nem apaga, nem a equipa.

**email_outbox**: `template`, `to_email`, `to_kind` (`client` | `team`), `locale`, `payload jsonb`, ids relacionados, `status` (`queued` | `sent` | `failed`), `attempts`, `provider_message_id`, `error`, `sent_at`. Serve também de histórico de emails.

---

## 3. Políticas de acesso (RLS)

### Princípios
1. RLS ativa em todas as tabelas de `public`. Uma tabela sem política fica inacessível, e um teste automático falha se alguma tabela nova ficar sem RLS.
2. Funções auxiliares (`security definer`, `search_path` vazio):
   - `is_staff(org)`: membro `admin` ativo da organização **e** sessão com MFA (`aal = aal2` no token). Sem MFA, a equipa não lê nada, mesmo com a password certa.
   - `my_client_ids()` e `is_process_client(process)`.
   - `is_process_partner(process)`: exige `organizations.partner_role_enabled = true` e uma atribuição ativa.
3. Todas as políticas filtram por `organization_id`, além de filtrarem por cliente ou processo.
4. **Clientes:** leem diretamente com RLS, mas só escrevem por funções (RPC ou Edge Function) que validam cada campo. Isto impede, por exemplo, que um cliente aprove o próprio documento ou altere o valor de um pagamento. **Equipa:** escreve diretamente, sempre limitada à sua organização.
5. Os dados confidenciais estão em tabelas sem nenhuma política para cliente ou parceiro: `process_internal`, `internal_notes`, `partners`, `activity_log` e `email_outbox`.
6. **Storage:**
   - Bucket privado `documents`, com caminhos `{org}/{process}/{document_id}`.
   - Ninguém tem leitura direta. Os downloads passam só pela função `sign-download`: verifica o acesso com as mesmas regras, regista no `activity_log` os documentos sensíveis e devolve um URL assinado válido 60 segundos.
   - O cliente só carrega ficheiros para um pedido seu em estado pendente ou rejeitado. O bucket aceita PDF, JPG e PNG, até 10 MB.
   - O bucket público `branding` guarda só logótipos, que têm de ser públicos para aparecerem nos emails.
7. **O cliente nunca vê nomes da equipa.** Documentos, mensagens, rejeições e emails aparecem sempre em nome da organização ("Equipa Orvel Partners"). O gestor responsável está em `process_internal`, e os ids de outros utilizadores não permitem ao cliente chegar a nomes. Os nomes ficam visíveis apenas à equipa, no registo de atividade.

### Matriz

L = ler · E = escrever · F = só através de função validada · — = sem acesso

| Tabela | Equipa | Cliente | Parceiro (se ativo) |
|---|---|---|---|
| organizations | L/E a própria | só a marca pública, por RPC (nome, logótipo, cores, contactos) | idem |
| memberships | L; E pela função de convite | L a própria | L a própria |
| clients | L/E | L a própria; F contactos | — (nunca vê contactos) |
| processes | L/E | L os seus; F nomes da empresa | L os atribuídos |
| people | L/E | L; F dependentes | L os atribuídos (nome, nacionalidade, data de nascimento) |
| proposals | L/E | L se não for rascunho; F aceitar | — |
| payments | L/E | L | — |
| bank_accounts | L/E | L só se a proposta do processo estiver aceite e os dados libertados | — |
| timeline_steps | L/E | L | L os atribuídos |
| document_requests | L/E | L; F upload | L os atribuídos |
| documents | L/E | L os seus envios e os emitidos visíveis, sem os ficheiros já apagados | L só os marcados "partilhar com parceiro" |
| deadlines | L/E | L | — |
| document_types, privacy_notices | L/E | L | L |
| modelos (cronologia, pedidos) | L/E | — | — |
| process_internal, internal_notes | L/E | — | — |
| partners, partner_assignments | L/E | — | L as suas atribuições |
| activity_log | L (só o sistema insere) | — | — |
| email_outbox | L | — | — |
| privacy_consents | L | F dar consentimento; L o próprio | F; L o próprio |

### Testes automáticos de RLS (pgTAP, `supabase test db`)
- O cliente A não lê nada do cliente B, em todas as tabelas, no Storage e através de `sign-download`.
- Nenhum cliente lê `process_internal`, `internal_notes`, `partners`, `activity_log` ou `email_outbox`.
- A organização X não vê a organização Y, nem como equipa nem como cliente.
- Um parceiro ativo não lê `process_internal`, `payments`, `bank_accounts`, `proposals` nem `clients`. Com o papel desligado, não lê nada.
- A equipa sem MFA (`aal1`) não lê nada.
- O cliente não consegue: aprovar o próprio documento, alterar pagamentos, ver dados bancários antes de serem libertados, ver propostas em rascunho, nem escrever no `activity_log`.
- Teste de proteção: percorre o catálogo da base de dados e falha se alguma tabela de `public` não tiver RLS ativa.

### Teste do fluxo completo (Vitest + supabase-js contra o Supabase local)
Convite → aceitação → pagamento → documentos → emitidos → prazo → conclusão → limpeza. Usa um relógio simulado para os 30 dias e a Brevo em modo de teste, que grava os emails em vez de os enviar.

---

## 4. Ecrãs

### Cliente
Pensado primeiro para telemóvel. Navegação inferior: Início · Documentos · Percurso · Prazos · Mais.

| # | Ecrã | Conteúdo |
|---|---|---|
| 0 | Entrar | Email → link mágico; ecrã "verifique o seu email"; ecrã de link expirado com opção de pedir outro |
| 0b | Privacidade | Aviso e consentimento no primeiro login e sempre que a versão do aviso muda, com o prazo de conservação |
| 1 | Início | Estado do processo, próximo passo, o que falta da sua parte (documentos, dados, pagamento) |
| 2 | Proposta | PDF no ecrã e para descarregar, escolha do plano, botão de aceitar com confirmação, comprovativo da aceitação |
| 3 | Pagamento | Estado, valor em AED, fatura para descarregar e os dados bancários depois de libertados |
| 4 | Os meus dados | Dados pessoais e de contacto, dependentes (acrescentar e editar) e 2 a 3 nomes pretendidos para a empresa |
| 5 | Enviar documentos | Pedidos agrupados por pessoa, upload (câmara ou ficheiro), estado e motivo de rejeição |
| 6 | Documentos emitidos | Lista por tipo, para descarregar |
| 7 | Percurso | Cronologia com passos, datas previstas e reais e notas |
| 8 | Prazos e renovações | O que expira e quando, com a nota de que os valores de renovação são confirmados antes de cada renovação e de que isto não é aconselhamento legal |
| 9 | Contacto | WhatsApp e email da equipa |

Se o cliente tiver mais de um processo, aparece um seletor de processo no topo.

### Equipa

| # | Ecrã | Conteúdo |
|---|---|---|
| E1 | Entrar | Password, configuração do MFA na primeira vez e código MFA nas seguintes |
| E2 | Processos | Lista com filtros (proposta enviada, por pagar, à espera de documentos, em curso, concluído) e alertas (documento por validar, pagamento em atraso, prazo próximo) |
| E3 | Novo cliente | Cria o cliente, o processo, as pessoas, os pedidos e a cronologia a partir dos modelos, e envia o convite (que se pode reenviar) |
| E4 | Ficha do processo | Separadores: Resumo · Pessoas e dados · Proposta · Pagamentos · Documentos (pedidos, recebidos e emitidos) · Percurso · Prazos · Interno (custos, margem, notas) · Atividade |
| E5 | Calendário de prazos | Próximos 90 dias de todos os clientes, em lista por semana e em vista mensal |
| E6 | Definições | Contactos, dados bancários, email da equipa, dias de aviso, dias de conservação, aviso de privacidade |

Ações na ficha do processo (E4):
- Carregar a proposta, confirmando que é a versão para o cliente, sem margens nem parceiro.
- Enviar a proposta, marcar pagamentos e libertar os dados bancários.
- Validar ou rejeitar documentos, com motivo na rejeição.
- Carregar documentos emitidos com data de validade, o que cria o prazo automaticamente.
- Acrescentar ou remover passos e pedidos.
- Concluir o processo, com a lista de ficheiros que serão apagados e a data, e reabri-lo enquanto a limpeza não tiver corrido.

---

## 5. Tarefas agendadas
- **Todos os dias às 08:00, hora do Dubai:**
  - Marca como expiradas as propostas fora da validade.
  - Envia os avisos de prazo.
  - Marca os prazos vencidos.
  - Apaga os ficheiros sensíveis através da API do Storage e regista cada um no `activity_log`.
- **Todas as segundas-feiras às 08:00:** resumo semanal para a equipa.
- **Todos os minutos:** envio da fila de emails.

## 6. Emails (Brevo)

| Email | Quando é enviado |
|---|---|
| Convite de acesso | Função `invite-client` |
| Link mágico | Hook de email do Supabase Auth, com a marca da organização |
| Proposta disponível | Proposta passa a `sent` |
| Aceitação confirmada | Para o cliente e para a equipa, na `accept-proposal` |
| Pagamento confirmado | Pagamento passa a `paid` |
| Documento pedido | Novo pedido criado à mão, ou convite com os pedidos iniciais |
| Documento rejeitado | Inclui o motivo |
| Documento emitido disponível | Documento emitido visível ao cliente |
| Lembretes de prazo | Tarefa diária, para o cliente e para a equipa |
| Resumo semanal | Tarefa semanal, para a equipa |

## 7. Etapas de construção
1. Repositório, Supabase local, esquema, RLS, testes de RLS e dados fictícios.
2. Autenticação (MFA da equipa, link mágico com o hook da Brevo, convite), consentimento, tema da organização e i18n.
3. Painel da equipa: lista de processos, ficha, pessoas, proposta e pagamentos.
4. Área do cliente: início, proposta e aceitação, pagamento, os meus dados.
5. Documentos: pedidos, upload, validação, emitidos e downloads assinados com registo.
6. Cronologia, prazos e calendário.
7. Emails (fila e Brevo) e tarefas agendadas (avisos, resumo semanal, limpeza).
8. Teste do fluxo completo e README (deploy na Vercel, secrets, primeiro administrador, DNS na GoDaddy).

---

## 8. Decisões (todas confirmadas a 31/10/2026)

**D1. Papel de parceiro [DECIDIR do briefing].**
Recomendo manter o papel desligado na fase 1, com o modelo, as políticas e os testes já prontos.
Âmbito proposto para quando for ativado:
- Só leitura dos processos atribuídos: pessoas (nome, nacionalidade, data de nascimento), percurso, pedidos e apenas os documentos que a equipa marcar, um a um, como "partilhar com parceiro".
- Pode carregar documentos emitidos nesses processos. O cliente vê-os como vindos da Orvel.
- Nunca vê clientes nem contactos, pagamentos, dados bancários, propostas, prazos, dados internos ou o registo de atividade.

Agora só preciso que confirmes que fica desligado. O âmbito pode ficar para a fase 2.

**D2. Quem escolhe o plano?** A proposta apresenta planos lado a lado.
Recomendo: ao carregar o PDF, a equipa regista os planos apresentados (nome e valor em AED). O cliente escolhe um e aceita no mesmo ecrã; se houver só um plano, basta aceitar. O plano escolhido decide se o passo "Conta bancária" entra na cronologia.

**D3. Faturas e entidade emissora.**
O portal nunca mostra a entidade emissora, que fica em `process_internal`. Mas o PDF da fatura é mostrado tal como é carregado: se o PDF, ou o beneficiário dos dados bancários, tiver o nome de quem emite, o cliente vê-o.
Pergunta: quem emite as faturas ao cliente, e a conta para onde o cliente paga é da Orvel? Se as faturas saírem em nome de outra entidade, isso tem de se resolver no documento, não no portal.

**D4. Emirates ID.**
Está marcado como sensível, mas também é um documento emitido, e os emitidos não se apagam.
Recomendo: "sensível" significa que os downloads ficam registados. O apagamento automático aplica-se só aos ficheiros sensíveis enviados pelo cliente (passaporte, fotografia). O Emirates ID emitido continua disponível. Confirmas?

**D5. Processos cancelados ou desistências.**
Recomendo que cancelar um processo também inicie a contagem dos 30 dias para os ficheiros sensíveis. O briefing só fala em "concluído".

**D6. Acesso depois da conclusão.**
Recomendo que o cliente mantenha o acesso aos documentos emitidos e aos prazos, e que os avisos de renovação continuem, porque as renovações acontecem um a dois anos depois.
Alternativa: desativar o acesso X meses depois do último prazo.

**D7. Quem é "a equipa" nos emails?** ✅ Decidido: do lado da Orvel não aparecem nomes.
- Todos os avisos e alertas para a equipa (aceitações, lembretes de prazo, resumo semanal) vão para `hello@orvelpartners.com`, configurável na organização.
- Os emails ao cliente saem de "Orvel Partners" <hello@orvelpartners.com>, com resposta para o mesmo endereço, e são assinados "Equipa Orvel Partners".
- No portal, o cliente vê apenas a organização: nenhum nome de gestor, autor de nota, revisor de documento ou quem carregou um ficheiro.

**D8. Editor de modelos.**
Recomendo que, na fase 1, os modelos de cronologia, pedidos e tipos de documentos sejam os valores iniciais da secção 8 e que eu os altere quando for preciso. Em cada processo, a equipa pode sempre acrescentar ou remover passos e pedidos à mão.
O editor de modelos no ecrã de definições ficaria para a fase 2. Dias de aviso, conservação, contactos e dados bancários ficam editáveis já na fase 1.

## 9. Decisões por defeito (confirmadas)
- **Frontend:** Vite + React SPA em vez de Next.js. Não precisa de servidor próprio, e toda a segurança fica no Supabase.
- **Estado do processo:** calculado automaticamente (proposta enviada → por pagar → à espera de documentos → em curso). "Concluído" e "cancelado" são manuais.
- **Cronologia:** marcam-se sozinhos os passos Proposta aceite, Pagamento confirmado, Documentos recebidos e Processo concluído.
- **Referência da proposta:** a equipa escreve a que vem no PDF gerado. O portal valida o formato e que é única, mas não cria outra numeração.
- **Rascunho de proposta:** existe um estado "rascunho", invisível ao cliente, antes de "enviada". Ao carregar o PDF, a equipa confirma que é a versão para o cliente, porque a skill de propostas também gera o resumo interno de margem.
- **Prestações:** um processo pode ter vários pagamentos.
- **Avisos fora de tempo:** se um prazo for criado já dentro de uma janela (ex.: faltam 20 dias), sai logo o aviso dos 30 e depois o dos 7, nunca vários ao mesmo tempo.
- **Renovações:** um novo documento emitido do mesmo tipo e para a mesma pessoa fecha o prazo anterior como "renovado".
- **Reabrir:** concluir pode ser desfeito até ao dia da limpeza.
- **Data de limpeza:** fica gravada no momento da conclusão (é a que aparece no aviso). Se a organização mudar os dias de conservação, só afeta as conclusões seguintes.
- **MFA:** verificado na própria base de dados. Uma sessão da equipa sem MFA não lê nada.
- **Acesso por convite:** o registo público fica desligado. Os links mágicos e os convites saem pela Brevo com a marca da organização.
- **Templates de email:** em código, com os textos nos ficheiros de tradução.
- **Ficheiros:** PDF, JPG e PNG até 10 MB. URLs assinados válidos 60 segundos.
- **Fuso horário:** Dubai.

## 10. Para validar com o advogado
- Aviso de privacidade e prazo de conservação (RGPD e lei de proteção de dados dos EAU).
- Texto da aceitação da proposta e se o registo de data, hora, IP e utilizador chega como prova de aceitação.
- Nota dos prazos e renovações ("lembrete, não é aconselhamento legal").
- Depois da limpeza, os metadados do ficheiro apagado (nome, tipo, datas) ficam no registo de atividade para auditoria. O ficheiro em si deixa de existir.

## 11. O que preciso para começar
- **Repositório GitHub:** o nome (ex.: `orvel-partners/portal-clientes`). Pode ser um repositório vazio criado por ti; eu ligo-o a esta sessão.
- **Logótipo:** os ficheiros, a pedir à Cátia. Até lá uso um marcador neutro, sem redesenhar o logótipo.
- **Só no deploy:** projetos Supabase de dev e de produção, Vercel, `BREVO_API_KEY` e o DNS na GoDaddy.

---

## 12. Notas da etapa 2 (01/11/2026)

- **Consentimento exigido pela base de dados**: sem aceitar o aviso de privacidade em vigor, o
  cliente não lê nem altera nada (só o aviso). Uma nova versão publicada volta a pedir a aceitação.
- **Recuperação de password da equipa** acrescentada (ecrã "Esqueci-me da password"). Quem já tem
  MFA passa o código antes de definir a nova password.
- **Emails de autenticação** com o link `/auth/confirmar?token_hash=…`, tratado pelo portal. O hook
  `auth-send-email` envia-os pela Brevo com a marca da organização; os modelos em
  `supabase/templates/` só servem quando o hook está desligado (ambiente local).
- **Painel da equipa provisório**: lista de clientes com enviar/reenviar convite, até à etapa 3.
- **Logótipo**: até haver ficheiro carregado, o cabeçalho mostra só o nome da organização.
