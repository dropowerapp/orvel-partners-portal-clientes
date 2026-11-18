# Validação de convites e login — 18/11/2026

Ensaio controlado no domínio `https://portal.orvelpartners.com`, com Supabase de produção
`ilwkiruybzxplnhwcwrs` e deployment Vercel `dpl_37RzFV4HY4KfptnpmLnr7ipfagK9`, commit
`030d4c1d44f1f6324ebf99f6d89795685ca94373`. Não é autorização de lançamento para clientes reais.

## Contas e autorização

- Administração: `hello@orvelpartners.com`, endereço escolhido pela responsável. A própria
  criou a password e configurou o TOTP. Sessão administrativa observada no browser integrado;
  base de dados confirmou uma associação admin ativa, um TOTP verificado e sessão AAL2.
- Cliente: `dropforcemanagement@gmail.com`, expressamente autorizado para receber o teste.
  Criado pela interface com nome **Cliente de teste — Orvel**, plano **TESTE TÉCNICO — sem
  serviço contratado** e sem morada, telefone ou documentação. Os testes de cliente decorreram
  no Chrome, separados da sessão administrativa.

## Resultados

| Percurso | Evidência observada | Resultado |
|---|---|---|
| Domínio final | DNS correto, HTTPS 200, HSTS e CSP; interface Orvel sem modo demonstração. | Validado. |
| Administração | Painel de processos aberto após login/TOTP; sessão AAL2 confirmada. | Validado. |
| Criar cliente com convite | Interface mostrou «Processo criado e convite enviado»; associação client ativa. | Validado. |
| Entrega do convite | Resend Delivered, email `01a1edf0-06ee-75b2-90c8-d411bfd36622`, 09:14 UTC. | Entrega confirmada pelo fornecedor. |
| Novo link pelo ecrã de entrada | Auth → hook assinado → Resend Delivered; email `01a1edf3-5174-7978-bbac-98c8a1f6568b`, 09:18 UTC. | Login levou a `/privacidade`. |
| Reenviar convite | Botão Reenviar; data atualizada no portal e `last_invite_sent_at=2026-11-18 09:19:28.546019+00`. Resend Delivered, email `01a1edf4-3b78-7b44-827e-f3031b182b0f`. | Validado. |
| Entrada pelo convite reenviado | Nova sessão no Chrome, a partir do link do email, chegou a `/privacidade`; `last_sign_in_at=2026-11-18 09:22:02.559068+00`. | Validado. |
| Reutilizar link após sair | Interface «Este link já não é válido». | Reutilização recusada. |
| Cliente tenta `/equipa/processos` | Regressou a `/privacidade`, sem abrir o painel da equipa. | Restrição da navegação confirmada. |
| Saída | Botão Sair devolveu `/entrar`. | Sessão de teste terminada. |

O primeiro convite já tinha sido consumido às 09:15:21 UTC quando o agente o tentou abrir
às 09:16:33. O Auth registou «One-time token not found» nessa segunda tentativa. Foi emitido
um novo link para completar o ensaio; não foi necessário alterar o código de autenticação.

As mensagens usam o remetente/reply-to `hello@orvelpartners.com`, a marca Orvel e links para
o domínio final. Não foram guardados tokens, passwords ou segredos neste relatório. Delivered
confirma a aceitação pelo servidor destinatário; a caixa de entrada foi confirmada pela responsável
para o email técnico anterior, não separadamente para cada convite.

## Limites e estado preservado

A área do cliente mostra **«A sua área de cliente ainda não está disponível»** porque não existe
aviso de privacidade aprovado/publicado. O login funciona; não foi possível validar nesta produção
os ecrãs seguintes, consentimento e documentos sem a decisão sobre privacidade. O rascunho não
foi publicado ou aceite para desbloquear os testes.

Consulta final: 2 utilizadores Auth, 2 associações, 1 cliente, 1 processo, **0 documentos e
0 objetos Storage**. O teste fictício permanece identificado e não foi apagado.

`RETENTION_ENABLED=false` preservado; **0 tarefas de eliminação**, `pg_cron` ausente e
`purge-documents` não publicada. A função técnica `email-delivery-check` continua desativada
com resposta 410, sem envio de emails. Nenhum documento foi eliminado.

Na passagem inicial, o painel Resend mostrou `Supabase_Orvel` em Full access. Na continuação de
18/11, foi limitada a **Sending access / orvelpartners.com** e novo reenvio foi entregue às
09:34 UTC, email `01a1ee02-5022-7538-b0f0-0ef9d3dc6d2b`. Os três ficheiros da marca também
foram carregados e verificados em produção. As contagens de Storage acima referem-se ao fim
do ensaio inicial; depois existem três imagens de branding e continuam zero documentos.
Permanecem a decisão sobre Vercel Hobby para uso comercial, backups com restauração,
MFA/recuperação das contas de plataforma e os restantes percursos autenticados.
Ver [preparação e condições](preparacao-producao-2026-11-17.md).

Este ensaio confirma os percursos descritos. A restrição de navegação não substitui a auditoria
das permissões nem o teste de isolamento entre dois clientes. O fluxo completo de documentos
anterior foi validado no ambiente de testes, conforme [relatório de documentos](validacao-documentos-2026-11-17.md).
