# Preparação de produção — atualizado em 18/11/2026

O Supabase de produção foi criado e o frontend atual foi publicado na Vercel para validação controlada. O portal ainda não está lançado
para clientes reais: faltam backups com restauração, aprovação do aviso de
privacidade, adequação contratual do alojamento e os restantes percursos autenticados no
domínio público. A proposta é aceite dentro do portal; o acesso inicial restrito e a abertura
do acompanhamento após aceitar já estão implementados e ensaiados em Preview.
Administração/MFA, convites, reenvio e login já foram validados em 18/11.
A responsável confirmou que não deve existir eliminação automática das cópias dos documentos.
Quando o cliente deixar de trabalhar com a Orvel, haverá revisão manual, com análise das
obrigações legais e pedidos válidos de direitos. Fechar um processo não termina essa relação;
o procedimento de registo e execução ainda está por definir. Nenhuma eliminação foi executada.
Em 18/11, a responsável confirmou **não contratar planos pagos por enquanto**; a proposta
de custos fica adiada. A revisão do aviso está preparada localmente, sem publicação.

## Ambientes e propriedade

| Recurso | Estado confirmado em 18/11 |
|---|---|
| Organização Supabase | Orvel Partners, `etjykbrkqrzyurwmocop`, plano Free. |
| Propriedade | Painel Team consultado: exatamente um membro, a conta indicada pela responsável, marcada YOU e Owner; conta Dropower ausente. MFA de `dropforcemanagement@gmail.com` confirmado na página Security: Google Authenticator adicionado em 18/11/2026 às 09:52:42 UTC, com 10 de 10 códigos de recuperação disponíveis. Os códigos não foram abertos nem copiados; a guarda privada cabe à responsável. |
| Ligação Codex | Ligação **ORVEL PARTNERS** operacional. Chamadas dirigidas explicitamente a essa ligação; não usar a ligação DROPFORCE. |
| Produção | `orvel-portal-producao`, `ilwkiruybzxplnhwcwrs`, região `eu-west-1` (Irlanda), ACTIVE_HEALTHY, PostgreSQL 17.12, Nano. |
| Testes | `xdakbbvnpoojhyapznkf`, `orvelpartners's Project`; dados fictícios preservados. O rótulo main/PRODUCTION do fornecedor não altera esta finalidade. |
| Custos | Consulta anterior à criação: 0 USD/mês. Nenhum plano contratado, projeto apagado ou pausado. |
| Vercel | Equipa `dropower-s-projects`, `team_4UE4GPF895jF3QvZu1crnFMN`; projeto `orvel-partners-portal-clientes`, `prj_qGopqpbxJ08ClmkSGLFbasqrGQ0Z`. Acesso recuperado após consentimento da equipa; plano Hobby ativo confirmado no painel. |
| GitHub | `dropowerapp/orvel-partners-portal-clientes`, ramo `codex/documentos-design`; versão funcional `e9b6811` publicada em produção em 18/11. |

[Projeto de produção](https://supabase.com/dashboard/project/ilwkiruybzxplnhwcwrs).
**GitHub e Vercel mantêm a propriedade atual**, por indicação expressa da responsável.
O consentimento específico da equipa recuperou o acesso Vercel na mesma ligação. Não houve
transferência nem nova ligação das contas. Os bloqueios anteriores de acesso estão resolvidos.

A criação tinha sido recusada pelo limite gratuito antes da separação das contas. Depois da
reconexão e da seleção explícita da ligação ORVEL PARTNERS, o acesso funcionou e a criação
terminou com sucesso. O diagnóstico anterior de acesso bloqueado ao Supabase está ultrapassado.

O Free mantém limitações de disponibilidade e recuperação; não é uma garantia de serviço
contínuo. Confirmar a adequação antes do lançamento.
[Limites Supabase](https://supabase.com/pricing).

## Produção instalada

Foram aplicadas as 15 migrações do repositório, desde `20261031100000_schema` até
`20261118140000_platform_privileges`, incluindo documentos, cronologia/prazos, conservação
e `20261118122607_proposal_access` (adicionada após a instalação inicial das outras 14).
O histórico remoto foi alinhado com as versões dos ficheiros locais após a aplicação pelo
conector; `list_migrations` confirmou todas as versões.

Não houve seed, cópia de clientes, documentos, utilizadores Auth ou credenciais do projeto
de testes. A instalação cria apenas a organização e os valores iniciais da aplicação
(tipos de documento, modelos e rascunho do aviso). O rascunho **não foi publicado**.

| Verificação remota | Resultado |
|---|---|
| Utilizadores Auth / associações / clientes / processos / documentos / objetos Storage | 2 / 2 / 1 / 1 / 0 / 3; cliente/processo fictícios e apenas três imagens da marca no Storage. |
| Migrações esperadas | Nenhuma em falta. |
| Tabelas públicas sem RLS | 0. |
| Permissões de tabelas públicas para `anon` | 0. |
| Funções anónimas inesperadas | 0; só a marca pública é acessível. |
| Funções `admin_*` executáveis por utilizadores | 0. |
| Bucket `documents` | Privado; 10 MB; PDF, JPEG e PNG. |
| Administradores ativos do portal | 1 — `hello@orvelpartners.com`; TOTP verificado, sessão AAL2 e entrada no painel observados. |
| Aviso de privacidade publicado | Não existe. |
| Hostnames de teste/Preview na organização | Nenhum. |
| Fila de eliminação `private.document_purge_jobs` | Vazia. |
| `pg_cron` / função `purge-documents` | Ausentes. |

A consulta usada é `scripts/remote/production-readiness.sql`, complementada por contagens
e verificação da existência de TOTP verificado e sessão AAL2 da administração, sem ler segredos.

### Autenticação

Configuração guardada no painel do novo projeto:

- Registo público, sessões anónimas e associação manual de identidades desligados.
- Email ativo e confirmação de endereço obrigatória.
- Alteração segura de email preservada; alteração segura de password ligada.
- Mínimo de password configurado para 12 caracteres, com minúsculas, maiúsculas e dígitos.
- Links/OTP de email com validade de 3600 segundos; comprimento OTP mantido em 8 dígitos.
- TOTP ativo; MFA por telefone desligado; limite de sessões AAL1 de 15 minutos ativo.
- Site URL: `https://portal.orvelpartners.com`.
- Único callback permitido: `https://portal.orvelpartners.com/auth/confirmar`.

Os endereços usam o domínio previsto no projeto. A configuração de Auth não comprova DNS,
HTTPS nem publicação do frontend. A proteção contra passwords comprometidas está desligada:
a interface indica que exige Pro ou superior. Não foi feita alteração de plano.
[Password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### Funções e variáveis de servidor

`sign-download` publicada em produção, confirmada como v4/ACTIVE na listagem final, com
`verify_jwt=true`. O código é o do
repositório: valida a sessão, consulta o documento com as permissões do utilizador, verifica o
caminho e assina por 60 segundos, com auditoria dos downloads sensíveis.

Variáveis guardadas no projeto (valores de configuração, sem chaves privadas):

| Nome | Valor |
|---|---|
| `ALLOWED_ORIGINS` | `https://portal.orvelpartners.com` |
| `PUBLIC_SITE_URL` | `https://portal.orvelpartners.com` |
| `AUTH_LINK_EXPIRY_HOURS` | `1` |
| `EMAIL_MODE` | `resend` |
| `RETENTION_ENABLED` | `false` |

`RESEND_API_KEY` e `SEND_EMAIL_HOOK_SECRET` foram introduzidos pela responsável no painel;
a existência dos nomes guardados foi confirmada sem copiar os valores para o repositório.
`EMAIL_LOG_DOMAINS` não está definido. Não ativar logging de emails em produção.

`invite-client` v2/ACTIVE está publicada com `verify_jwt=true`; mantém os controlos de
sessão, pertença e MFA da equipa. `auth-send-email` v2/ACTIVE está publicada com
`verify_jwt=false`, pois autentica cada pedido pela assinatura Standard Webhooks.
O Send Email hook HTTPS foi criado pela responsável e o painel confirmou **ENABLED**;
o endpoint preparado é a função `auth-send-email` deste projeto.

### Teste de envio Resend — 18/11, 08:57 UTC

Foi enviada uma mensagem técnica para **hello@orvelpartners.com**, destinatário indicado
pela responsável, com o assunto **[TESTE] Portal Orvel — ligação de produção ao Resend**.
Usou o módulo partilhado `_shared/email.ts`, os segredos do projeto novo e o remetente
`Orvel Partners <hello@orvelpartners.com>`. O Resend respondeu **HTTP 200**, com o identificador
`01a1eddf-dccf-75c8-8806-f76e43f152ab`. A responsável confirmou em 18/11/2026 que a mensagem
chegou à **caixa de entrada**, não ao spam. O painel Resend foi consultado mais tarde e também
confirmou o estado Delivered.

O teste não criou utilizadores ou associações, não continha um link de autenticação e não
convidou clientes. Verificou `EMAIL_MODE=resend` e `RETENTION_ENABLED=false` antes do envio.
A função temporária exigiu JWT e validou a credencial de serviço no Auth do próprio projeto;
o destinatário era fixo e o pedido Resend tinha uma chave de idempotência. Não foram alteradas
as proteções das funções do portal para executar o teste.

Após o envio, `email-delivery-check` foi substituída por v3, com JWT obrigatório e apenas uma
resposta **410 `test_completed`**. A leitura remota do código confirmou que já não lê segredos,
não contacta serviços externos e não pode enviar emails. Continua listada como ACTIVE pelo
fornecedor, mas a operação de teste está desativada. Não voltar a publicar o código de envio.

Pedidos HTTP sem credenciais foram recusados: `auth-send-email` devolveu 401
`invalid_signature`; `invite-client` e a função de teste devolveram 401 por ausência de
autenticação. Os 39 testes locais das Edge Functions e `deno check` passaram antes do deploy.
A consulta imediatamente posterior a este teste técnico confirmou zero utilizadores Auth,
associações, documentos e tarefas de eliminação. As contas de administração e de teste foram
criadas depois, no ensaio abaixo; `pg_cron` continua ausente e `purge-documents` não está publicada.

Este ensaio validou o transporte Supabase → Resend. O percurso Auth → hook assinado → email
com link válido → entrada no portal e o convite pela equipa foram depois validados no domínio
final, conforme o relatório abaixo. A chave `Supabase_Orvel` estava em Full access e foi depois
limitada a **Sending access / orvelpartners.com**, sem criar outra chave nem trocar segredos.
O formulário foi reaberto e confirmou os valores guardados. Um reenvio pelo portal às 09:34 UTC
foi entregue pelo Resend (`01a1ee02-5022-7538-b0f0-0ef9d3dc6d2b`), confirmando envio com a
permissão reduzida. As outras chaves da conta não foram alteradas.

### Marca instalada — 18/11

Carregados no bucket público `branding`, na pasta da organização, apenas os três ficheiros
originais existentes em `branding/orvel`: `logotipo.png`, `simbolo.png` e
`logotipo-fundo-escuro.png`. Os caminhos `logo_path`, `theme.symbol_path` e
`theme.logo_dark_path` foram preenchidos depois de confirmar o upload. As cores e tipografia
foram preservadas. Não houve criação de bucket nem alteração das permissões de documentos.

Os três URLs públicos devolveram HTTP 200 e bytes idênticos aos ficheiros locais (SHA-256
comparado). A entrada no Chrome e o cabeçalho do painel administrativo mostram a marca.
O bucket `documents` continua privado e vazio.

### Testes HTTP na produção

Executados contra a API pública do novo projeto, com a sua chave publicável:

| Pedido | Resultado |
|---|---|
| Leitura de documentos sem sessão | 401, permission denied. |
| Download sem sessão | 401, session_expired. |
| Preflight com origem do portal | 200; Allow-Origin igual ao domínio previsto. |
| Preflight com origem externa de teste | Não devolve essa origem; Allow-Origin continua limitado ao domínio do portal. |
| Auth settings públicos | Registo desligado, sessões anónimas desligadas, confirmação de email ligada. |

CORS limita as respostas acessíveis pelo browser; não substitui autorização. Os testes
acima não substituem o fluxo autenticado, nem demonstram ainda que um cliente real consegue
entrar e enviar documentação no domínio final.

## Avisos de segurança revistos

O advisor do novo projeto indica:

- Uma função anónima SECURITY DEFINER: `get_org_public`, destinada apenas à marca pública.
- 19 funções SECURITY DEFINER na verificação inicial; 20 após acrescentar `get_client_processes`,
  com verificação explícita de utilizador e pertença. São executáveis por utilizadores autenticados: operações validadas
  da aplicação. Manter os controlos internos de sessão, pertença, MFA e estado do processo;
  não retirar indiscriminadamente estas APIs necessárias.
- RLS sem políticas na fila privada `private.document_purge_jobs`: intencional, uso exclusivo
  pelo servidor. Não acrescentar acesso de clientes para silenciar o aviso.

[Funções anónimas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[funções autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
e [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

As suites locais anteriormente concluídas têm 94 testes de frontend, 381 verificações SQL
e 39 testes de Edge Functions aprovados, com build e deno check. Nesta preparação foram
instaladas as mesmas migrações e o mesmo download, sem alterar o código da aplicação;
a verificação adicional foi remota. Não executar o e2e/seed de desenvolvimento em produção.

## Vercel configurada em 18/11

Criadas e relidas três variáveis, exclusivamente no destino Production:

| Variável | Configuração |
|---|---|
| `VITE_SUPABASE_URL` | `https://ilwkiruybzxplnhwcwrs.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Chave **publicável** ativa do projeto novo; valor relido coincide com o Supabase. Não foi copiada nenhuma chave de serviço. |
| `VITE_DEMO_MODE` | `false` |

Os IDs, destinos e valores guardados das três variáveis de Preview ficaram iguais. Não foram
criadas variáveis de eliminação na Vercel: essa tarefa pertence ao servidor Supabase e continua
sem deploy, sem cron e com `RETENTION_ENABLED=false` na configuração já guardada.

Definições de build guardadas pela API e confirmadas no painel: Vite, raiz `web`, Node `24.x`,
instalação `npm ci`, build `npm run build`, saída `dist`. Visibilidade pública do código
desligada por `publicSource=false`; proteção de deployments Vercel preservada
(`all_except_custom_domains`). Esta proteção não se aplica ao domínio personalizado.

Build local de produção concluído com Node 24 e as variáveis acima. Inspeção do JavaScript
gerado confirma o URL do Supabase novo, ausência da referência do Supabase de testes, dos
identificadores/sessões da demonstração e da variável de chave de serviço. Permanecem textos
de tradução relativos à demonstração e o prefixo literal `sb_secret_` usado pelo SDK para
reconhecer tipos de chave; não são contas ativas nem credenciais secretas. Mantém o aviso conhecido de bundle
superior a 500 kB. Não houve alteração de código funcional nem repetição das suites anteriores.
O comentário de `web/.env.example` foi corrigido: `VITE_DEMO_MODE=true` também afeta builds.

### Domínio e DNS

`portal.orvelpartners.com` associado ao projeto; a Vercel devolveu `verified=true` para a
associação. Após guardar o CNAME, a consulta devolveu `misconfigured=false`, com o destino esperado.
O pedido HTTPS ao domínio final devolveu 200, com HSTS e CSP; o Chrome mostrou o ecrã de
entrada Orvel, sem demonstração. O asset JavaScript remoto tem o mesmo nome/hash do build local.
Os nameservers são externos: `ns33.domaincontrol.com` e `ns34.domaincontrol.com`.

Registo recomendado pela Vercel e guardado na GoDaddy:

| Tipo | Nome | Destino |
|---|---|---|
| CNAME | `portal` | `a8219958b7e61fda.vercel-dns-017.com.` |

A responsável autorizou a ligação do domínio e guardou o registo no Chrome. A leitura posterior
mostrou o destino correto e TTL de uma hora (o formulário tinha sido preparado com 30 minutos).
Não foi necessário criar outro registo ou transferir o domínio. Os registos de email e do site
principal não foram alterados pelo agente.

### Plano e privacidade

O painel de faturação confirma **Hobby ativo**. Os termos limitam Hobby a uso pessoal ou não
comercial. A responsável decidiu manter a preparação sem planos pagos; resolver a adequação
contratual do alojamento antes da abertura empresarial. Não foi feito upgrade nem iniciada
uma subscrição. [Termos — Hobby](https://vercel.com/legal/terms#hobby-plan).
O [DPA público da Vercel](https://vercel.com/legal/dpa) refere Pro e Enterprise no seu âmbito;
não considerar Hobby abrangido sem outro instrumento confirmado.

A opção “Improve models with this project’s data” foi **desativada e guardada apenas neste
projeto**, após autorização explícita da responsável. O painel foi recarregado e confirmou a
opção desligada, sem alterações por guardar. O texto da Vercel refere a utilização e partilha
de código e conversas para treino daqui para a frente, não revogação retroativa. A preferência
global da equipa não foi alterada.

### Publicação para validar convites e login — 18/11

Após autorização para validar no domínio final, foi enviado o commit
`030d4c1d44f1f6324ebf99f6d89795685ca94373` para o ramo `codex/documentos-design` e criado
um novo build com destino **Production**, usando as variáveis de produção acima.

| Ambiente | Deployment | Estado |
|---|---|---|
| Production | `dpl_37RzFV4HY4KfptnpmLnr7ipfagK9` | READY; commit `030d4c1`; domínio `portal.orvelpartners.com` associado a este deployment. |
| Preview | `dpl_AvfkZdPD1dgBUQFoUm6v9agxYqfx` | READY; mesmo commit, com variáveis de Preview preservadas. |

[Deployment de produção](https://vercel.com/dropower-s-projects/orvel-partners-portal-clientes/37RzFV4HY4KfptnpmLnr7ipfagK9).
O build remoto terminou sem erros, mantendo o aviso conhecido de bundle superior a 500 kB.
A Vercel atribuiu também o alias do ramo ao deployment Production; esse alias foi reposto
na Preview e a associação final foi relida pela API. O domínio final permanece em Production.

A responsável escolheu `hello@orvelpartners.com` como primeira conta de administração, criou
a password no painel Supabase e concluiu o primeiro login/TOTP. Uma única associação `admin`
ativa foi criada. O painel autenticado foi observado e a base confirmou TOTP verificado e sessão
AAL2. Nenhuma password, semente TOTP ou código foi recolhido.

Com autorização explícita, foi criado pelo portal o cliente **Cliente de teste — Orvel**,
usando `dropforcemanagement@gmail.com` e o plano **TESTE TÉCNICO — sem serviço contratado**.
O convite e o reenvio tiveram confirmação na interface e estado Delivered no Resend. Um novo
link pedido no ecrã de entrada percorreu o Auth hook e permitiu autenticar; o convite reenviado
também permitiu autenticar. Após sair, o link anterior foi recusado por já ter sido usado.
A tentativa do cliente de abrir `/equipa/processos` regressou à página de privacidade.

O percurso do cliente termina corretamente em `/privacidade`, com indicação de área ainda
indisponível: não existe aviso aprovado/publicado. Não foi aceite nem publicado o rascunho
para contornar este bloqueio. A sessão de teste foi terminada e o painel administrativo ficou
aberto. Não foram enviados documentos nem alterada a conservação: fila vazia, `pg_cron` ausente,
worker sem publicação e `RETENTION_ENABLED=false` preservado.
[Relatório e limites do ensaio](validacao-convites-login-2026-11-18.md).

## Condições para lançamento

1. **Vercel:** acesso, variáveis separadas, privacidade e build já preparados. Preservar a decisão
   de não contratar planos pagos; adequação ao uso comercial ainda por resolver. DNS e HTTPS
   já foram confirmados. O commit revisto já foi publicado com as variáveis
   Production; autenticação validada no domínio final. Não promover um build feito com os testes nem colocar
   service_role/secret em `VITE_*`.
2. **Emails:** chave no servidor, segredo assinado, hook e duas funções já configurados;
   envio técnico aceite pelo Resend e entrega na caixa de entrada de `hello@orvelpartners.com`
   confirmada pela responsável. Convite, reenvio e Auth hook validados. A chave `Supabase_Orvel`
   foi limitada a envio no domínio Orvel e um novo reenvio foi entregue. Não colocar segredos
   no chat ou no Git.
3. **Administração e marca:** conta `hello@orvelpartners.com` e associação administrativa criadas;
   primeiro login e TOTP concluídos. MFA da conta proprietária Supabase também configurado pela
   responsável e confirmado na página Security em 18/11: Google Authenticator ativo e códigos
   de recuperação disponíveis. Confirmar a guarda privada dos códigos e verificar MFA/recuperação
   das restantes plataformas.
   Marca carregada e verificada; caminhos preenchidos na organização.
   Não copiar o administrador fictício nem reaproveitar chaves do backend de testes.
4. **Backups:** a responsável escolheu uma pasta privada neste Mac como proteção provisória.
   Três cópias cifradas concluídas em 19/11; 22 testes fictícios e recuperação técnica real
   da segunda passaram: 59 tabelas, 96 registos e 3 ficheiros de branding. Sem documentos
   de clientes no Storage nesse momento. Agendamento diário local ativo no Codex às 09:00
   Europe/Lisbon; executor verificado manualmente. Faltam destino independente para chave/cópias,
   observação do primeiro disparo/avisos e ensaio completo dos serviços do portal recuperado.
   **Não há limpeza automática.** [Estado](backup-local-2026-11-18.md).
   A [proposta paga](backups-e-custos-2026-11-18.md) mantém-se adiada, sem contratação.
5. **Privacidade:** [texto limpo 1.0](aviso-privacidade-2026-11-19.md), guardado como rascunho
   na produção, ainda sem publicação. [Fecho editorial e pendências](fecho-privacidade-e-backup-2026-11-19.md),
   com **CATIA DROPFORCE MANAGEMENT - FZCO** e a sede em Building A1, Dubai Digital Park,
   Dubai Silicon Oasis, Dubai, United Arab Emirates, PO BOX 342001, indicadas pela responsável.
   Entidade contratante confirmada. Contacto acompanhado por Catia Fernandes e Fabio Roque,
   ambos General Manager; clientes, equipa e Mac nos EAU. **IFZA** identificada expressamente
   como zona franca/entidade de registo; C1 respondido.
   Destinatários para constituição confirmados: IFZA ou entidade de constituição, apenas nos
   EAU. Documento médico limitado à aptidão para emissão do visto; Corporate Tax apenas
   registo e certificado. Aptidão médica recebida do cliente; registo/certificado fiscal
   obtidos pela equipa diretamente no portal da autoridade fiscal. Mantém-se a limitação
   dos envios do serviço à IFZA/entidade de constituição nos EAU. Restam outros
   pontos de C3 e C4 na [folha de decisões](confirmacoes-privacidade-2026-11-18.md),
   além dos fundamentos, transferências e critérios legais. C4 está parcialmente confirmado:
   sem eliminação automática e revisão manual no fim da relação. O número da licença é informação de apoio à verificação
   da entidade, não um requisito automático do aviso. A folha separa validação jurídica,
   conservação manual e publicação. A leitura antes do login está agora implementada
   em `/aviso-de-privacidade`; [validação técnica](validacao-privacidade-publica-2026-11-18.md).
   Aprovar o texto antes de publicar; a regra confirmada exclui a eliminação automática.
   O rascunho da migração não é aprovação jurídica. Texto de confirmação de leitura já no
   frontend publicado; aviso jurídico ainda sem publicação.
   [Constatações e decisões](revisao-privacidade-e-acesso-2026-11-18.md).
6. **Ensaio final:** convite, reenvio de convite, entrada e MFA concluídos. Após aprovação da
   privacidade, validar consentimento, envio, revisão, rejeição/reenvio de documentos, download,
   isolamento entre clientes, cronologia e prazos no domínio final. Usar documentos fictícios
   controlados, sem importar o seed de testes.
7. **Eliminação:** manter `RETENTION_ENABLED=false`, `purge-documents` sem deploy e sem cron.
   Não ativar limpeza automática. Definir o procedimento manual para o fim da relação com o
   cliente, com responsável, prazo de atuação e exceções. O mecanismo existente baseado no
   fecho de processos não corresponde a esta regra; não há eliminação autorizada nesta etapa.
8. **Acesso após proposta aceite:** implementado no frontend e na base de dados. O convite
   abre a área inicial com Proposta/Contacto (após a leitura do aviso). Aceitar dentro do portal
   liberta apenas o respetivo processo, sem exigir pagamento. Ensaios automáticos e no Chrome
   concluídos em testes; a produção continua bloqueada pelo aviso jurídico em falta.
   [Evidência desta alteração](validacao-proposta-2026-11-18.md).

Na revisão do aviso em 18/11, nova consulta de leitura confirmou 0 avisos publicados, 0
documentos, 0 tarefas de eliminação e ausência de `pg_cron`. Sem alterações remotas nesta revisão.

## Histórico preservado do ambiente de testes

O projeto `xdakbbvnpoojhyapznkf` já tinha recebido as 14 migrações,
`auth-send-email` v12, `invite-client` v12 e `sign-download` v4.
Conserva contas/processos fictícios. A Preview atual inclui a etapa 6, cujo backend já está
instalado; a validação autenticada dessa etapa continua pendente.
A validação anterior de documentos no Chrome está em
[validacao-documentos-2026-11-17.md](validacao-documentos-2026-11-17.md).

## Atualização: proposta dentro do portal — 18/11, 16:46 UTC

A migração de acesso foi instalada nos dois projetos, completando **15 migrações**. A versão
funcional `e9b68118ffecceafbda6b8827ff7b133cc947588` está em:

| Ambiente | Deployment | Resultado |
|---|---|---|
| Preview | `dpl_D8etEP8DyHa29xuZRJhf9ip4jVfy` | READY, Supabase de testes; percurso autenticado no Chrome aprovado. |
| Production | `dpl_DYTJpvpp61oZutz9XgNUttrLofN2` | READY, novo build com variáveis de produção; `portal.orvelpartners.com` responde HTTP 200. |

O JavaScript servido no domínio final contém o backend `ilwkiruybzxplnhwcwrs`, a nova consulta
de processos e a redação de confirmação de leitura; não contém a referência do projeto de
testes. O alias da Preview permanece no deployment de testes. **100 testes de frontend e
437 verificações SQL** passaram, além de typecheck e build. O ensaio preservou os dados
fictícios e não executou a limpeza do script remoto.

Mantêm-se zero avisos publicados, zero documentos em produção, fila de eliminação vazia,
ausência de cron e de `purge-documents`. Nenhum plano pago contratado; a publicação técnica
não equivale à abertura comercial do portal.

Este registo documenta preparação e verificações concretas. Não certifica segurança integral
nem substitui uma auditoria independente, aprovação jurídica ou um ensaio de recuperação.
