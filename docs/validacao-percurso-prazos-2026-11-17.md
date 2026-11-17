# Validação local do percurso, prazos e calendário — 17/11/2026

Resultado: etapa 6 implementada e validada localmente no ramo `codex/documentos-design`.
A migração remota, a publicação da nova Preview e os testes autenticados online desta etapa
continuam pendentes. A Preview existente mantém o código da etapa 5.

## Funcionalidade e design

- Gestão dos passos manuais do percurso, datas previstas e reais, notas para o cliente,
  progresso por fase e proteção dos passos automáticos.
- Gestão de prazos manuais, acompanhamento dos prazos documentais, renovações e histórico.
- Calendário mensal com detalhe do dia, vista semanal dos próximos 90 dias, lista de vencidos,
  pesquisa e ligação à ficha de cada processo. A leitura usa paginação para não ficar limitada
  aos primeiros 1000 resultados do PostgREST.
- Área do cliente com prazos ativos, renovações anteriores e download do documento associado;
  o percurso mostra ambas as datas e a nota da equipa, sem identificar membros da equipa.
- Continuidade do design Orvel: azul-marinho, Source Sans 3, cartões claros, espaço entre
  elementos e navegação adaptada ao computador e ao telemóvel.

## Verificações efetuadas

| Verificação | Resultado |
|---|---|
| `npm run web:test` | 20 ficheiros, 89 testes aprovados. |
| `npm run db:test:memory` | 351 verificações SQL aprovadas, incluindo 43 novas desta etapa. |
| `npm run web:build` | TypeScript e Vite concluídos; aviso existente de bundle superior a 500 kB. |
| `git diff --check` | Sem erros de whitespace. |
| Chrome, demonstração local | Vistas mensal/semanal, mudança de mês, seleção do dia, pesquisa, acesso à ficha e abertura dos formulários. |
| Chrome, viewport de 375 × 812 | Calendário legível; cabeçalhos abreviados; sem overflow horizontal da página. Viewport reposto no fim. |

O frontend e o build foram executados com Node 24.22.3, conforme `engines.node >=24`.
Os testes de base de dados usam PostgreSQL/PGlite em memória com pgTAP e todas as migrações.
Não contactam a base remota e não enviam emails. A demonstração local é de leitura e não
constitui prova de gravação autenticada no Supabase.

Os testes novos cobrem limites de datas (incluindo anos bissextos), agrupamento semanal,
ordenação por fase, janela inclusiva de 90 dias, campos obrigatórios, submissão dos formulários,
conflitos de edição e cancelamento sem submissão. Na base de dados cobrem MFA, isolamento entre
organizações e clientes, proteção dos passos automáticos, controlo de versões, auditoria,
restrições dos prazos documentais e continuidade das renovações após conclusão do processo.

## Publicação pendente

Migração preparada: `supabase/migrations/20261118120000_timeline_deadlines.sql`.
Alvo usado pelas Previews: projeto `xdakbbvnpoojhyapznkf`, ramo `main / PRODUCTION`.
A aprovação anterior para este alvo dizia respeito à migração dos documentos; nenhuma migração
desta etapa foi executada remotamente durante esta validação.

O acesso de controlo ao Chrome deixou de estar disponível antes de criar/executar o SQL novo.
Não existe token de gestão Supabase disponível no ambiente de execução. Foi sugerida a
integração Supabase como alternativa; a ligação ainda não foi confirmada.

Ordem de conclusão:

1. Recuperar acesso autenticado ao projeto e confirmar as migrações instaladas.
2. Aplicar a migração nova numa transação, registando a versão no histórico de migrações.
3. Confirmar as três funções, as permissões e a política de visibilidade dos prazos.
4. Publicar o frontend na Preview do ramo existente.
5. Com contas fictícias, criar e editar um passo e um prazo, consultar calendário e atividade,
   entrar como cliente e confirmar datas, notas, renovação e acesso ao documento associado.

O frontend novo exige a migração antes da publicação. Os avisos automáticos por email e as
tarefas agendadas ainda não fazem parte desta etapa; os textos da interface não prometem
esses envios.
