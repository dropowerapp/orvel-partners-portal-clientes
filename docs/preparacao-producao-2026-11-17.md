# Preparação de produção — 17/11/2026

O portal continua em testes. O acesso Supabase foi recuperado e o backend existente recebeu
as alterações pendentes. Ainda não existe um projeto separado para clientes reais nem houve
um novo deploy Vercel. A eliminação de documentos continua desativada por decisão da responsável.

## Ambientes e acessos

| Recurso | Estado confirmado |
|---|---|
| Organização Supabase | Orvel Partners, `etjykbrkqrzyurwmocop`, plano gratuito. |
| Projeto existente | `xdakbbvnpoojhyapznkf`, `eu-west-1`, ativo; contém contas e processos fictícios. O rótulo `main / PRODUCTION` do fornecedor não torna estes dados próprios para produção. |
| Novo projeto pretendido | `orvel-portal-producao`, mesma organização e região; criação recusada pelo limite de projetos gratuitos de um membro. Nenhum projeto novo foi criado. |
| Decisão sobre custos | Manter o plano gratuito. A responsável vai libertar uma vaga noutro projeto seu. Não pausar/apagar outros projetos nem contratar um plano automaticamente. |
| Vercel | Equipa `dropower-s-projects`, `team_4UE4GPF895jF3QvZu1crnFMN`, projeto `orvel-partners-portal-clientes`; integração responde 403 por falta de autorização de equipa. O consentimento temporário deve ser concluído na mesma ligação. |

O plano gratuito limita-se a dois projetos ativos e pode pausar projetos após uma semana de
inatividade. Esta limitação de disponibilidade mantém-se mesmo com a configuração de segurança
correta. [Limites publicados pelo Supabase](https://supabase.com/pricing).

## Alterações aplicadas ao Supabase de testes

- `20261118120000_timeline_deadlines.sql`: funções de cronologia e prazos, permissões e RLS.
- `20261118130000_retention.sql`: fila privada e funções reservadas ao servidor, sem executar
  eliminações; validação de caminhos de documentos e PDFs de propostas.
- `20261118140000_platform_privileges.sql`: execução de `rls_auto_enable()` retirada a
  `PUBLIC`, `anon` e `authenticated`; event trigger de ativação de RLS mantido ativo.
- `sign-download`, versão 4: validação do caminho antes de criar o URL assinado. A função
  continua a validar o utilizador e a ler o documento com as permissões da sua sessão.

As versões das migrações remotas foram alinhadas com os nomes locais depois da aplicação pelo
conector. Não houve reset, seed, limpeza de contas, eliminação de documentos ou envio de emails.
`auth-send-email` e `invite-client` mantêm a versão 12.

## Verificações

| Verificação | Resultado |
|---|---|
| Testes SQL locais com todas as migrações | 381 verificações aprovadas, zero falhas. |
| Histórico remoto | Nenhuma das quatro migrações verificadas em falta, incluindo documentos. |
| Tabelas públicas | Nenhuma sem RLS; zero permissões de tabelas para `anon`. |
| Funções | Sem funções anónimas inesperadas; funções administrativas não executáveis por utilizadores. |
| Storage `documents` | Privado, limite de 10 MB, PDF/JPEG/PNG. |
| MFA do administrador do portal | Um administrador ativo, com TOTP verificado. Não verifica o MFA das contas Supabase/Vercel. |
| Ambiente de testes | 11 associações ativas a contas fictícias; aviso de privacidade ainda provisório. |
| Eliminação | Zero reservas, zero documentos marcados como eliminados, `pg_cron` ausente e `purge-documents` não publicada. |
| API sem sessão | Leitura de documentos 401; pedido de download 401. |
| Preflight de download da Preview | 200, com a origem exata da Preview permitida. |

Os testes HTTP foram feitos na API pública do Supabase com uma chave publicável. Não substituem
o fluxo autenticado no Chrome. Os 94 testes de frontend e 39 testes de Edge Functions já tinham
passado na preparação anterior; só a suite SQL foi repetida após esta migração de permissões.

O advisor continua a indicar:

- **Proteção contra passwords comprometidas desativada.** O recurso exige Pro ou superior,
  segundo a documentação atual. A decisão de manter Free conserva esta limitação; confirmar
  passwords fortes e MFA das contas da equipa, sem os apresentar como substituto deste recurso.
  [Orientação do Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Funções `SECURITY DEFINER` acessíveis pela API: `get_org_public` fornece apenas a marca
  pública; as funções autenticadas implementam operações validadas da aplicação. Estes avisos
  exigem revisão dos controlos internos, não a remoção indiscriminada de funções necessárias.
  [Funções anónimas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
  e [funções autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Informação sobre RLS sem políticas na fila privada: intencional, pois só o servidor a gere.
  [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Configuração preparada para concluir após recuperar os acessos

1. Confirmar a vaga, consultar novamente o custo e criar o projeto isolado na organização
   aprovada. Não copiar utilizadores, processos, documentos ou seed de testes.
2. Aplicar as migrações no projeto vazio; carregar apenas a marca e a configuração revista.
   Rever os valores iniciais da organização. Criar a conta real de administração e concluir
   o seu MFA com a responsável; manter o registo público e utilizadores anónimos desligados.
3. Confirmar o domínio final, HTTPS e os callbacks exatos de autenticação. Configurar CORS,
   `PUBLIC_SITE_URL`, o hook de autenticação e a chave Resend limitada ao domínio de envio.
   Guardar segredos no servidor, nunca em variáveis `VITE_*`.
4. Na Vercel, manter Preview ligada ao Supabase de testes e configurar só Production com o
   novo `VITE_SUPABASE_URL` e a respetiva chave publicável em `VITE_SUPABASE_ANON_KEY`.
   Confirmar raiz `web`, Node 24, build e ramo/commit antes de publicar. Não promover uma
   Preview construída com o backend de testes como se fosse a versão de produção.
5. Manter `purge-documents` sem publicação e sem agendamento nesta fase. Caso seja publicada
   para um ensaio futuro, definir explicitamente `RETENTION_ENABLED=false`; não ativar a
   eliminação antes da política aprovada e da validação remota.
6. Definir backups separados para PostgreSQL e para os ficheiros do Storage, com acesso
   restrito, destino aprovado e teste de restauração. Não copiar documentação de clientes para
   um destino de backup ainda não escolhido. No plano gratuito, o fornecedor recomenda
   exportações regulares e cópias externas; os backups diários geridos são de planos pagos e
   não incluem os ficheiros do Storage. [Limites dos backups Supabase](https://supabase.com/docs/guides/platform/backups).
7. Publicar o aviso de privacidade aprovado e rever o texto da proposta. A existência do
   texto provisório na base de dados não equivale a aprovação.
8. Validar o fluxo autenticado no ambiente final: convite, entrada, MFA, consentimento, envio,
   revisão, reenvio, download, isolamento entre clientes, cronologia e prazos. Testar a
   recuperação antes de aceitar documentação real; combinar um teste de entrega de email.

Este registo documenta preparação e verificações concretas. Não certifica a segurança integral
nem substitui uma auditoria independente ou a aprovação do aviso e da conservação.
