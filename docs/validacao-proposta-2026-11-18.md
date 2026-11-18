# Proposta dentro do portal — validação de 18/11/2026

## Decisão e resultado

A responsável confirmou: «Exatamente, o cliente aceita a proposta dentro do portal».
O convite permite entrar na área inicial, depois da confirmação de leitura do aviso em vigor.
Antes de aceitar, o cliente vê **Proposta** e **Contacto**, abre o PDF e escolhe o plano.
Após aceitar, o acompanhamento e as operações do respetivo processo ficam disponíveis.
O pagamento não é condição de abertura. A aceitação de um processo não abre outro.

Mantêm-se o design azul-marinho, a navegação com espaço e a adaptação ao telemóvel.

## Proteção na base de dados

Migração: `supabase/migrations/20261118122607_proposal_access.sql`, criada através do CLI.

- `private.client_portal_process_ids()` identifica processos próprios com associação ativa
  e aviso atual confirmado. A sua utilização está limitada às propostas e à aceitação.
- `private.client_process_ids()` exige uma proposta aceite. As políticas e operações existentes
  de documentos, uploads, pagamentos, dados, percurso e prazos herdam essa condição.
- A nova consulta `get_client_processes(p_org)` devolve apenas a lista mínima antes de aceitar;
  não expõe o plano interno, nomes da empresa nem dados bancários nessa fase. Verifica
  utilizador, organização, papel, associação ativa e aviso. `anon` não tem execução.
- O PDF da própria proposta enviada pode ser aberto antes de aceitar. Rascunhos e propostas
  de outros clientes continuam fechados. Os documentos do processo ficam bloqueados.
- A aceitação conserva plano, texto apresentado, utilizador, data, IP e navegador. Bloqueia
  propostas expiradas/não abertas e processos encerrados, e serializa alterações concorrentes.
- O frontend não monta as páginas reservadas antes de confirmar o estado de acesso. Falhas
  na consulta mantêm o acesso fechado; mudar de processo limpa o estado dos formulários.

## Testes concluídos

| Verificação | Resultado |
|---|---|
| Frontend (Vitest) | 100 testes em 22 ficheiros aprovados; 6 novos cenários de acesso à proposta. |
| SQL/RLS (PostgreSQL via PGlite) | 437 verificações aprovadas; 56 novos casos no ficheiro `14_proposal_access.sql`. |
| TypeScript e Vite | Typecheck e build aprovados; mantém-se o aviso de dimensão do bundle. |
| Isolamento | Antes/depois, dois clientes, duas organizações e dois processos do mesmo cliente. |
| Falhas e limites | Falta de aviso/leitura, associação inativa, acesso anónimo, proposta expirada/fechada, pagamento pendente. |
| Supabase remoto | Migração instalada e verificação de existência/privilégios nos dois ambientes. |

O script legado `scripts/remote/e2e.mjs` foi adaptado à nova fase de proposta. Exige seed
recente e conserva a aceitação; foi verificada a sintaxe, mas não foi executado nesta sessão
porque inclui limpeza de ficheiros e fatores MFA. As contagens acima referem-se às suites
locais executadas, não a esse script remoto.

## Ensaio no Chrome

Ambiente: Preview ligada a `xdakbbvnpoojhyapznkf`, com a conta fictícia Marta já autenticada.
Criado apenas neste projeto o processo `b9076f13-62f3-4a60-b887-11a31fc10a41` e a proposta
`ORV-2026-99001`, plano **TESTE TÉCNICO — sem contratação**, valor 0 AED.

1. Antes de aceitar, os únicos itens do menu eram Proposta e Contacto. A navegação direta
   para `/documentos` regressou a `/proposta`.
2. O PDF abriu no visualizador do Chrome através da função de download. O ficheiro tem uma
   página e identifica expressamente «SEM DADOS REAIS — SEM VALOR LEGAL» e ausência de contrato.
3. O botão estava desativado até marcar a confirmação. A aceitação fictícia foi efetuada no
   ecrã; o portal abriu a página inicial e disponibilizou o menu completo.
4. A consulta posterior confirmou `status=accepted`, texto guardado e o utilizador correto,
   às **16:45:38 UTC**. Existiam **zero registos de pagamento** nesse processo.
5. A página Documentos ficou acessível e apresentou o estado vazio esperado do processo novo.

O PDF de 2 009 bytes foi carregado pelo painel de Storage autenticado, porque o conector não
dispõe dessa operação. Uma interrupção inicial não carregou o ficheiro; a segunda tentativa
foi confirmada no Storage antes de disponibilizar a proposta. Nenhum contrato real foi aceite.
As contas, o processo, a proposta e o ficheiro fictícios foram preservados; não houve limpeza.

## Publicação e limites

Código funcional: `e9b68118ffecceafbda6b8827ff7b133cc947588`, ramo `codex/documentos-design`.

| Ambiente | Deployment |
|---|---|
| Preview, READY | `dpl_D8etEP8DyHa29xuZRJhf9ip4jVfy` |
| Production, READY | `dpl_DYTJpvpp61oZutz9XgNUttrLofN2` |

A produção foi reconstruída com as suas próprias variáveis. O domínio
[portal.orvelpartners.com](https://portal.orvelpartners.com) respondeu HTTP 200; o bundle
`index-CKR6n_kj.js` contém o backend de produção, a nova consulta e o texto de confirmação de
leitura. Não contém a referência do backend de testes. A Preview continua separada.
Os dois projetos têm 15 migrações, com o histórico da nova migração alinhado com o ficheiro local.

O advisor mantém os avisos conhecidos: função pública de marca intencional, 20 APIs
`SECURITY DEFINER` autenticadas (incluindo a nova consulta com verificação explícita de acesso),
fila privada sem políticas para clientes e proteção contra passwords comprometidas desativada
no plano atual. Estes avisos não foram ocultados nem tratados como certificação de segurança.
[Documentação dos avisos de funções](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

**A produção não foi aberta a clientes reais.** Continuam zero avisos publicados e zero
documentos; a entrada do cliente está bloqueada pelo aviso em falta. A revisão 3 do aviso
é um rascunho. Faltam aprovação jurídica, conservação, backups/restauração, adequação contratual
do alojamento e ensaios finais nesse domínio. Não se publicou um aviso fictício para os contornar.

`RETENTION_ENABLED=false` foi preservado; sem `purge-documents`, cron, execução de eliminação
ou contratação de planos pagos. Nenhum segredo foi incluído neste relatório.
