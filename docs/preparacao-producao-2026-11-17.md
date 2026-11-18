# Preparação de produção — atualizado em 18/11/2026

O Supabase de produção foi criado e configurado parcialmente. O portal ainda não está lançado
para clientes reais: faltam emails, administração real/MFA, marca no Storage, backups com
restauração, aprovação do aviso de privacidade e publicação/ensaio final na Vercel.
A eliminação de documentos permanece desativada por decisão da responsável.

## Ambientes e propriedade

| Recurso | Estado confirmado em 18/11 |
|---|---|
| Organização Supabase | Orvel Partners, `etjykbrkqrzyurwmocop`, plano Free. |
| Propriedade | Painel Team consultado: exatamente um membro, a conta indicada pela responsável, marcada YOU e Owner; conta Dropower ausente. MFA da conta Supabase ainda não verificado. |
| Ligação Codex | Ligação **ORVEL PARTNERS** operacional. Chamadas dirigidas explicitamente a essa ligação; não usar a ligação DROPFORCE. |
| Produção | `orvel-portal-producao`, `ilwkiruybzxplnhwcwrs`, região `eu-west-1` (Irlanda), ACTIVE_HEALTHY, PostgreSQL 17.12, Nano. |
| Testes | `xdakbbvnpoojhyapznkf`, `orvelpartners's Project`; dados fictícios preservados. O rótulo main/PRODUCTION do fornecedor não altera esta finalidade. |
| Custos | Consulta anterior à criação: 0 USD/mês. Nenhum plano contratado, projeto apagado ou pausado. |
| Vercel | Equipa `dropower-s-projects`, `team_4UE4GPF895jF3QvZu1crnFMN`; projeto `orvel-partners-portal-clientes`. Leitura repetida: 403, falta autorização desta equipa na ligação. |
| GitHub | `dropowerapp/orvel-partners-portal-clientes`, ramo local `codex/documentos-design`. Sem push nesta preparação. |

[Projeto de produção](https://supabase.com/dashboard/project/ilwkiruybzxplnhwcwrs).
**GitHub e Vercel mantêm a propriedade atual**, por indicação expressa da responsável.
A recuperação do acesso Vercel faz-se pelo consentimento específico da equipa, na mesma ligação;
não exige uma transferência nem deve ser confundida com a ligação Supabase já resolvida.

A criação tinha sido recusada pelo limite gratuito antes da separação das contas. Depois da
reconexão e da seleção explícita da ligação ORVEL PARTNERS, o acesso funcionou e a criação
terminou com sucesso. O diagnóstico anterior de acesso bloqueado ao Supabase está ultrapassado.

O Free mantém limitações de disponibilidade e recuperação; não é uma garantia de serviço
contínuo. Confirmar a adequação antes do lançamento.
[Limites Supabase](https://supabase.com/pricing).

## Produção instalada

Foram aplicadas as 14 migrações do repositório, desde `20261031100000_schema` até
`20261118140000_platform_privileges`, incluindo documentos, cronologia/prazos e conservação.
O histórico remoto foi alinhado com as versões dos ficheiros locais após a aplicação pelo
conector; `list_migrations` confirmou todas as versões.

Não houve seed, cópia de clientes, documentos, utilizadores Auth ou credenciais do projeto
de testes. A instalação cria apenas a organização e os valores iniciais da aplicação
(tipos de documento, modelos e rascunho do aviso). O rascunho **não foi publicado**.

| Verificação remota | Resultado |
|---|---|
| Utilizadores Auth / associações / processos / documentos / objetos Storage | 0 / 0 / 0 / 0 / 0 antes do deploy de download. |
| Migrações esperadas | Nenhuma em falta. |
| Tabelas públicas sem RLS | 0. |
| Permissões de tabelas públicas para `anon` | 0. |
| Funções anónimas inesperadas | 0; só a marca pública é acessível. |
| Funções `admin_*` executáveis por utilizadores | 0. |
| Bucket `documents` | Privado; 10 MB; PDF, JPEG e PNG. |
| Administradores ativos do portal | 0 — criação da conta real pendente. |
| Aviso de privacidade publicado | Não existe. |
| Hostnames de teste/Preview na organização | Nenhum. |
| Fila de eliminação `private.document_purge_jobs` | Vazia. |
| `pg_cron` / função `purge-documents` | Ausentes. |

A consulta usada é `scripts/remote/production-readiness.sql`, complementada por contagens
sem dados pessoais. “Zero administradores sem TOTP” nesta instalação vazia não significa que
o MFA de uma conta real já foi validado.

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

`sign-download` publicada em produção, confirmada como v2/ACTIVE na listagem final, com
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

`RESEND_API_KEY` e `SEND_EMAIL_HOOK_SECRET` ainda não configurados. `EMAIL_LOG_DOMAINS`
não definido. Não ativar logging de emails em produção. `invite-client` e
`auth-send-email` ainda não publicadas neste projeto; o hook de envio ainda não configurado.
Não foram enviados emails. A lista remota deve conter apenas `sign-download` nesta fase.

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
- 19 funções SECURITY DEFINER executáveis por utilizadores autenticados: operações validadas
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

## Condições para lançamento

1. **Vercel:** autorizar a equipa na ligação existente, confirmar o plano adequado ao uso
   comercial e o domínio HTTPS. Manter Preview ligada aos testes; definir apenas Production
   com `VITE_SUPABASE_URL=https://ilwkiruybzxplnhwcwrs.supabase.co` e a chave publicável deste
   projeto em `VITE_SUPABASE_ANON_KEY`. Nunca usar service_role/secret em `VITE_*`.
   Confirmar raiz `web`, Node 24, build e commit. Não promover um build feito com os testes.
2. **Emails:** confirmar conta/domínio Resend e chave de envio limitada ao domínio Orvel.
   Guardar a chave no servidor, configurar o segredo assinado do hook e publicar as duas
   funções de email. Validar entrega com um destinatário autorizado antes de convidar clientes.
   Não colocar segredos no chat ou no Git. A integração atual não expõe gestão de segredos;
   a introdução de novas credenciais pelo browser requer intervenção da responsável.
3. **Administração e marca:** confirmar o email da primeira conta real, criar o acesso e
   concluir TOTP com a responsável. Verificar também MFA/recuperação das contas de plataforma.
   Carregar apenas os ficheiros de `branding/orvel` e preencher os caminhos na organização.
   Não copiar o administrador fictício nem reaproveitar chaves do backend de testes.
4. **Backups:** escolher destino restrito e política para PostgreSQL e Storage separadamente.
   Executar e registar a restauração, hashes, permissões e objetivos de perda/tempo de recuperação.
   No painel do novo projeto ainda não existem backups. Não copiar documentação de clientes
   para um destino não aprovado. [Backups Supabase](https://supabase.com/docs/guides/platform/backups).
5. **Privacidade:** aprovar o texto e a conservação antes de publicar o aviso. O rascunho da
   migração não é aprovação jurídica. Rever também o texto das propostas.
6. **Ensaio final:** convite, entrada, MFA, consentimento, envio, revisão, rejeição/reenvio,
   download, isolamento entre clientes, cronologia e prazos no domínio final. Usar documentos
   fictícios controlados, sem importar o seed de testes.
7. **Eliminação:** manter `RETENTION_ENABLED=false`, `purge-documents` sem deploy e sem cron.
   A ativação exige decisão posterior, política aprovada e ensaio; não faz parte desta fase.

## Histórico preservado do ambiente de testes

O projeto `xdakbbvnpoojhyapznkf` já tinha recebido as 14 migrações,
`auth-send-email` v12, `invite-client` v12 e `sign-download` v4.
Conserva contas/processos fictícios e a Preview da etapa 5. A etapa 6 está implementada
localmente e o seu backend instalado, mas ainda aguarda publicação e validação autenticada.
A validação anterior de documentos no Chrome está em
[validacao-documentos-2026-11-17.md](validacao-documentos-2026-11-17.md).

Este registo documenta preparação e verificações concretas. Não certifica segurança integral
nem substitui uma auditoria independente, aprovação jurídica ou um ensaio de recuperação.
