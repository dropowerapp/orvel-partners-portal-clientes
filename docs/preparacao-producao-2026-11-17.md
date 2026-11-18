# Preparação de produção — 17/11/2026

O portal continua em testes. O acesso Supabase foi recuperado em 17/11 e o backend existente
recebeu as alterações pendentes. Após a passagem de propriedade em 18/11, a ligação do Codex
voltou a ficar sem permissão; ver o diagnóstico abaixo. Ainda não existe um projeto separado
para clientes reais nem houve um novo deploy Vercel. A eliminação de documentos continua
desativada por decisão da responsável.

## Ambientes e acessos

| Recurso | Estado confirmado |
|---|---|
| Organização Supabase | Orvel Partners, `etjykbrkqrzyurwmocop`, plano gratuito. |
| Projeto existente | `xdakbbvnpoojhyapznkf`, `eu-west-1`, ativo; contém contas e processos fictícios. O rótulo `main / PRODUCTION` do fornecedor não torna estes dados próprios para produção. |
| Novo projeto pretendido | `orvel-portal-producao`, mesma organização e região; criação recusada pelo limite de projetos gratuitos de um membro. Nenhum projeto novo foi criado. |
| Decisão sobre custos | Manter o plano gratuito. Em 18/11, a responsável decidiu criar uma conta própria da Orvel e separar a propriedade da Dropower antes de prosseguir. Não pausar/apagar outros projetos nem contratar um plano automaticamente. |
| Vercel | Equipa `dropower-s-projects`, `team_4UE4GPF895jF3QvZu1crnFMN`, projeto `orvel-partners-portal-clientes`; integração responde 403 por falta de autorização de equipa. O consentimento temporário deve ser concluído na mesma ligação. |

O plano gratuito limita-se a dois projetos ativos e pode pausar projetos após uma semana de
inatividade. Esta limitação de disponibilidade mantém-se mesmo com a configuração de segurança
correta. [Limites publicados pelo Supabase](https://supabase.com/pricing).

## Atualização de 18/11: separar Orvel e Dropower

A responsável pediu uma conta Supabase própria da Orvel, por serem empresas distintas.
A organização **Orvel Partners** já existe separada e o projeto pode permanecer nela.
O procedimento preparado é atribuir a propriedade à nova conta e retirar depois os acessos
Dropower, sem copiar a base de dados nem recriar o projeto. A responsável confirmou a criação
da nova conta e a entrada no painel em 18/11; o email de destino foi indicado na conversa.
A responsável confirmou também que aceitou o convite como **Owner**, removeu a conta Dropower
e voltou a ligar o Supabase pela conta Orvel. A lista final de membros e o MFA da conta não
foram verificados diretamente pela integração. Não foi enviado um convite nem alterado
qualquer membro por esta integração.

Sequência para a passagem:

1. Conta criada e entrada no painel confirmadas pela responsável. Confirmar MFA e recuperação;
   deixar a conta sem criar um projeto novo nesta fase.
2. Convite como Owner aceite pela nova conta, segundo confirmação da responsável. A integração
   Supabase disponível não tem operações de gestão de membros nem identifica a conta OAuth
   atual; a confirmação do papel Owner vem da responsável, não de uma lista obtida pela API.
3. Remoção da conta Dropower e nova ligação confirmadas pela responsável. Contudo, as chamadas
   da integração devolvem zero organizações e projetos, e a consulta direta aos identificadores
   conhecidos devolve `You do not have permission to perform this action`. É preciso resolver
   a autorização da organização Orvel Partners na ligação atual antes de executar alterações.
4. Confirmar os acessos finais da organização Orvel. Não alterar membros nem projetos das organizações
   Dropower. Inventariar credenciais de serviço/integrações já emitidas: remover um membro não
   deve ser tratado como prova de revogação de todas as credenciais que esse membro conhecia.
5. Verificar membros finais, acesso da Orvel, quota gratuita e funcionamento do portal. Após
   resolver a propriedade, retomar a criação do projeto isolado de produção sem dados de teste.

Este é o fluxo de [transferência de propriedade de uma organização documentado pelo Supabase](https://supabase.com/docs/guides/platform/access-control#transferring-ownership-of-an-organization).
É necessário manter pelo menos um proprietário; a saída do anterior acontece depois da
aceitação do novo. A eliminação de documentos continua desativada em todas as fases.

Inventário confirmado antes da passagem: 14 migrações instaladas, até
`20261118140000_platform_privileges`; `auth-send-email` v12, `invite-client` v12 e
`sign-download` v4 ativas; `purge-documents` não publicada. O código local conserva alterações
ainda não enviadas ao remoto Dropower.

A responsável determinou expressamente que **GitHub e Vercel ficam como estão por agora**.
A separação autorizada nesta fase limita-se ao Supabase; a propriedade dos outros recursos
permanece no inventário para uma decisão futura, sem iniciar transferências:

| Recurso | Vínculo atual | Trabalho seguinte |
|---|---|---|
| Vercel | Equipa `dropower-s-projects` | Manter por indicação expressa da responsável. Não transferir nesta fase. |
| GitHub | `dropowerapp/orvel-partners-portal-clientes` | Manter por indicação expressa da responsável. Preservar histórico e alterações locais. |
| Resend | Chave dedicada ao domínio Orvel documentada no projeto; proprietário da conta por confirmar | Confirmar conta, domínio, acessos e credenciais, sem interromper os emails. |

Após a confirmação do convite, mas antes da remoção da conta Dropower, a integração listou
Orvel Partners e o projeto
`xdakbbvnpoojhyapznkf` como `ACTIVE_HEALTHY`. A base confirma 14 migrações, zero reservas de
eliminação, zero documentos marcados como eliminados e ausência de `pg_cron`. Continuam
ativas apenas as três funções inventariadas; `purge-documents` não está publicada. Estas
leituras demonstravam o acesso técnico dessa ligação, mas não identificavam quem a autorizou
nem provam que a Dropower já foi removida.

Depois da remoção e da reconexão comunicadas pela responsável, foram feitas quatro leituras:
`list_organizations` e `list_projects` devolveram listas vazias; `get_organization` e
`get_project` devolveram erro de permissão. A pesquisa de documentação funciona, pelo que a
existência de ferramentas Supabase no chat não comprova autorização sobre o projeto.
Não foi repetida a criação de produção nem executado SQL remoto sem acesso. A documentação
exige selecionar a organização que contém o projeto no consentimento e refere que alguns
clientes precisam de reiniciar depois da autorização. A responsável confirmou uma nova
ligação com a conta Orvel e a seleção explícita de **Orvel Partners**; a nova verificação
continuou a devolver listas vazias e erro de permissão ao consultar a organização diretamente.
Não se deve voltar a tratar a escolha da organização como desconhecida nem repetir a criação
sem acesso. O próximo passo é fechar completamente e reabrir o Codex, retomar esta conversa
e testar uma vez a ligação recarregada. Uma sessão antiga é uma hipótese, não uma causa
comprovada. A produção permanece por criar e a eliminação não foi ativada.
[Autorização do MCP](https://supabase.com/docs/guides/ai-tools/mcp#next-steps).

Orientação sobre as contas e os planos, consultada em 18/11:

- GitHub: preferir uma **organização Orvel**, gerida por contas individuais autorizadas. O
  plano Free permite repositórios públicos/privados ilimitados, com limites de funcionalidades
  e recursos como Actions. Não é necessário um novo login para cada empresa quando a mesma
  pessoa gere organizações distintas. A conta que controla a organização Orvel deve pertencer
  à pessoa autorizada pela Orvel, sem depender de uma conta partilhada da Dropower.
  [Organizações](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/about-organizations)
  e [planos](https://docs.github.com/en/get-started/learning-about-github/githubs-plans).
- Vercel: uma equipa própria permite separar acessos e faturação. Hobby permite até 200
  projetos, mas os termos limitam esse plano a utilização pessoal ou não comercial. O portal
  empresarial Orvel exige um plano adequado a uso comercial; Pro é anunciado a partir de
  20 USD/mês, com custos adicionais conforme membros/consumo. Não foi aprovado nem contratado
  um plano Vercel nesta conversa; verificar o custo concreto antes da criação/transferência.
  [Limites](https://vercel.com/docs/limits), [termos — Hobby](https://vercel.com/legal/terms)
  e [preços](https://vercel.com/pricing).

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
