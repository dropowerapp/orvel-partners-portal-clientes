# Revisão do aviso de privacidade e acesso — 18/11/2026

**Revisão editorial consolidada; validação jurídica e condições de publicação pendentes.**
O [rascunho revisto, revisão 9](aviso-privacidade-rascunho-2026-11-18.md) permanece sem
publicação. Após a confirmação da responsável, o percurso de proposta dentro do portal foi
implementado e instalado em produção. Não foram contratados serviços nem ativada eliminação.
Esta revisão não é uma certificação de conformidade.

As confirmações estão reunidas numa [folha de decisões](confirmacoes-privacidade-2026-11-18.md):
C1–C4 para os factos e escolhas da Orvel; J1–J4 para fundamentos, regime, contratos e prazos;
P1 para a publicação posterior. Inclui proposta de conservação e procedimento de resposta
a pedidos, ambos sem ativação. Foram colocadas no chat as perguntas sobre licença/contacto,
países e documentos/destinatários. A resposta parcial «Exames médicos, e corporate tax»
foi incorporada na revisão 5. Na revisão 6 ficou registada a visibilidade apenas para a Orvel
e o respetivo cliente. Na revisão 7 foram confirmados envios de alguns documentos pela equipa
fora do portal para tratar dos serviços. Na revisão 8 ficaram identificados os destinatários
como IFZA ou entidade junto da qual é constituída a empresa, apenas nos EAU. Faltam identificar
documentos/dados, canais e papéis dos intervenientes, além do nível de informação médica e
do âmbito fiscal.

A revisão 9 reúne as respostas ainda necessárias em seis grupos na folha de decisões,
separa informação de apoio à identidade de requisitos do aviso e explicita os passos de
publicação. Não voltou a pedir destinatários ou países dos envios já confirmados.

## Decisões da responsável

- **Proposta aceite dentro do portal.** Antes da aceitação, o cliente acede à proposta e ao
  contacto da equipa. Depois, abre o acompanhamento do respetivo processo. A confirmação
  «Exatamente, o cliente aceita a proposta dentro do portal» resolve a dúvida anterior.
  Não exigir pagamento integral nem sinal como condição de abertura.
- **Sem planos pagos por enquanto.** A proposta anterior de backups e custos fica adiada.
  Não iniciar subscrições, destinos pagos ou recursos faturáveis.
- **Eliminação desativada.** Preservar `RETENTION_ENABLED=false`, sem publicar
  `purge-documents` e sem agendar cron. Não executar eliminação manual de documentos ou cópias
  nesta revisão. Aprovar uma política não autoriza automaticamente a sua execução.
- Entidade e sede fornecidas: **CATIA DROPFORCE MANAGEMENT - FZCO**, Building A1,
  Dubai Digital Park, Dubai Silicon Oasis, Dubai, United Arab Emirates, PO BOX 342001.
  Estes dados não foram verificados num registo comercial.

## Alterações ao aviso

O texto passa a separar proposta, acesso e privacidade, identifica os dados tratados por
finalidade e descreve sessão no navegador, fornecedores, fontes dos dados e conservação
por categoria. Evita apresentar a região Irlanda como garantia de permanência de todos os
dados na UE ou a desativação da eliminação como autorização para conservação ilimitada.
Mantém campos visíveis onde faltam decisões; não inventa prazos ou obrigações legais.

A proposta de texto para a confirmação é **«Li e tomei conhecimento do aviso de privacidade.»**,
com o botão **«Confirmar leitura e continuar»**. Esta redação está no frontend publicado;
o aviso jurídico continua sem publicação. A confirmação não deve ser usada como consentimento para marketing,
dados especiais ou qualquer outro tratamento que exija uma manifestação específica.

## Constatações na aplicação

| Tema | Evidência e implicação |
|---|---|
| Aviso apenas depois de autenticar | `web/src/routes/client/Privacy.tsx` redireciona visitantes sem sessão para a entrada. É necessário disponibilizar o aviso aprovado antes da primeira recolha, por ligação pública e/ou no contacto inicial; não basta mostrá-lo após o convite. |
| Regra da proposta aplicada por processo | `20261118122607_proposal_access.sql` limita `private.client_process_ids()` aos processos próprios com proposta aceite. As políticas e operações de dados/ficheiros passam a exigir essa condição, além da pertença ativa e confirmação do aviso. |
| Aceitação dentro da área inicial | `ClientLayout.tsx` apresenta apenas Proposta/Contacto antes de aceitar. A consulta mínima `get_client_processes`, a política da proposta e a função de aceitação permitem concluir essa fase sem abrir os restantes dados. |
| Convite pode ser enviado cedo | `NewProcess.tsx` permite enviar convite ao criar o processo e `admin_prepare_invite()` não exige proposta aceite. O convite não é evidência de aceitação. |
| Registos existentes de privacidade | O nome técnico `privacy_consents`, a função `accept_privacy_notice` e o evento `consent.given` são históricos. Alterar o texto do ecrã não transforma esses registos em prova de consentimento específico; manter esta distinção no tratamento de pedidos e na auditoria. |
| Sessão e preferências | O cliente e o SDK instalado usam `localStorage` para autenticação quando disponível, com renovação automática. Não confundir a validade do token com a duração total da sessão. `portal.process` usa `sessionStorage`; a saída/mudança de identidade limpa a escolha e a cache de dados. O aviso explica que fechar o separador não termina a sessão. |
| Tipografia | `web/src/main.tsx` importa ficheiros de `@fontsource/source-sans-3` no pacote da aplicação. Não foi encontrada integração de Google Fonts ou analytics no código analisado. Isto não substitui inspeção de rede nem exclui logs dos fornecedores. |
| Dados de terceiros | A aplicação admite pessoas associadas ao processo. A aceitação da proposta pelo cliente não fornece automaticamente fundamento para todos os dados de familiares ou representantes. |

Consulta de leitura na produção `ilwkiruybzxplnhwcwrs`, em 18/11/2026, confirmou **0 avisos
publicados**, **0 documentos**, **0 tarefas de eliminação** e **ausência de `pg_cron`**.
O valor `RETENTION_ENABLED=false` e a ausência do worker constam da verificação anterior;
esta revisão não alterou esses recursos nem leu valores de segredos.

## Regra de acesso implementada

Foi escolhido e implementado o percurso inicial restrito à proposta e contacto, mantendo
o acesso pessoal, a leitura do aviso e a autorização na base de dados. Uma aceitação
externa pela equipa não foi acrescentada. Os ensaios cobrem:

1. Sem aceitação, não obter os dados, ficheiros ou operações reservados à área de cliente.
2. Na aceitação, guardar versão/texto da proposta, quem aceitou, data e evidência adequada;
   não fabricar aceitação a partir de um convite ou pagamento.
3. Aplicar a regra por processo: uma proposta aceite não pode libertar outros processos
   ainda não aceites do mesmo cliente, nem processos de terceiros.
4. Preservar o acesso ao aviso e ao percurso necessário para aceitar a proposta, sem expor
   documentos do restante processo. Validar sessões e links existentes, não só novos convites.
5. Manter isolados o registo da proposta, a confirmação de leitura e eventuais consentimentos.
6. Ensaiar com dados fictícios: antes/depois da aceitação, proposta expirada, dois processos,
   dois clientes, pedidos diretos à API e downloads. Não usar o aviso jurídico como texto
   de teste publicado em produção.

## Decisões antes de publicar

| Responsável | Informação ou ação necessária |
|---|---|
| Orvel + revisão jurídica | Confirmar entidade responsável, registo e regime aplicável nos EAU, eventuais regras da zona franca e alcance territorial do RGPD. O número de licença é informação de apoio, não um requisito automático do aviso. Não inferir o regime apenas de «FZCO», da língua do portal ou do servidor na Irlanda. |
| Orvel + assessor jurídico | Fechar os fundamentos de cada finalidade e de dados de terceiros; avaliar condições adicionais para menores e dados especiais e a necessidade de representante, encarregado ou avaliação de impacto. |
| Orvel | Destinatários para constituição já confirmados: IFZA ou entidade de constituição, apenas nos EAU. Completar categorias de dados/canais, países de acesso da equipa e fontes fora do portal; confirmar quem gere `hello@orvelpartners.com`. |
| Orvel + assessor jurídico | Fixar prazos ou critérios verificáveis por categoria, incluindo propostas não aceites, logs, contas e futuras cópias; definir exceções, responsável e revisão. O valor técnico inicial de 30 dias não é política aprovada. |
| Orvel + assessor jurídico | Confirmar contratos de tratamento, entidades, subcontratantes e garantias de transferências. Não apresentar um DPA público como prova de contrato adequado ao plano utilizado. |
| Equipa técnica | Condição de acesso implementada e ensaiada. Falta disponibilizar o aviso aprovado antes da recolha e concluir os restantes ensaios no domínio final. A renderização atual divide texto por parágrafos; preparar versão de publicação legível sem tabelas Markdown não suportadas. |
| Orvel + assessor jurídico | Aprovar o texto final, versão/data, autoridade/canal de reclamação e procedimento de resposta a direitos. Publicar só depois de fechar os campos pendentes. |

A desativação da eliminação nesta fase de testes não permite ignorar um pedido válido de
apagamento quando existirem dados reais. Preparar um procedimento de análise, decisão,
execução controlada e registo, sem executar eliminações agora.

## Fontes e limites da revisão

Fontes oficiais consultadas em 18/11/2026:

- [DPC — informação e transparência](https://www.dataprotection.ie/en/individuals/know-your-rights/right-be-informed-transparency-article-13-14-gdpr): base para a estrutura e para apresentar a informação no momento da recolha. A DPC não foi designada como autoridade competente da Orvel.
- [Comissão Europeia — aplicação do RGPD](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en): a oferta de serviços a pessoas na UE pode sujeitar uma entidade fora da UE ao regulamento. A sede no Dubai, por si só, não resolve esta análise.
- [Governo dos EAU — proteção de dados](https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws): identifica o Decreto-Lei Federal 45/2021. O texto integral no portal legislativo devolveu erro 403 nesta consulta; não se concluiu qual o regime concreto da entidade nem foram fixados prazos legais dos EAU.
- [Supabase — DPA](https://supabase.com/legal/customer-resources/data-processing-addendum) e [Resend — DPA](https://resend.com/legal/dpa): documentos públicos para conferir entidades, âmbito e condições contratuais. A sua leitura não substitui a verificação dos contratos e configurações da Orvel.
- [Vercel — DPA](https://vercel.com/legal/dpa), introdução: o âmbito publicado refere clientes Pro e Enterprise. Não considerar o projeto Hobby abrangido sem outro instrumento confirmado.
- [Vercel — termos Hobby](https://vercel.com/legal/terms#hobby-plan): o plano limita-se a uso pessoal ou não comercial. O portal de acompanhamento de serviços comerciais precisa de alojamento contratualmente adequado antes da abertura a clientes; tornar o acesso reservado não elimina esta questão.

**Não contratar planos pagos agora.** O enquadramento do alojamento fica por resolver antes
do lançamento; nenhuma migração de fornecedor foi efetuada. A proposta de backups permanece
adiada, sem cópias externas, agendamento ou compromisso de custos.

## Verificação desta alteração

Passaram **100 testes de frontend e 437 verificações SQL**, incluindo falhas de acesso,
isolamento entre clientes/processos, propostas fechadas e abertura após aceitar sem pagamento.
O Chrome confirmou a passagem da área inicial para o painel e a abertura prévia do PDF,
usando apenas dados fictícios no ambiente de testes. A migração e o frontend foram publicados
em produção; o aviso jurídico continua sem publicação e bloqueia a entrada do cliente.
O relatório de evidência e os limites estão em
[validação da proposta](validacao-proposta-2026-11-18.md).

## Fecho editorial, revisão 4

Alterações apenas em documentos: referências C/J/P ligadas à folha de decisões, conservação
retirada de uma tabela de campos vazios e transformada numa proposta interna concreta,
descrição do armazenamento no navegador afinada com o código/SDK, canais externos indicados
e processamento principal do Resend nos EUA explicitado. O aviso mantém os campos factuais
e jurídicos por fechar e não é apresentado como versão legal final.

### Evidência técnica da descrição do navegador

| Elemento | Evidência no código | Limite da afirmação |
|---|---|---|
| Sessão | `web/src/lib/supabase.ts` tem `persistSession` e `autoRefreshToken`; `GoTrueClient.ts` do SDK escolhe `localStorage`, com memória como alternativa. | A aplicação não fixa um prazo absoluto de armazenamento local. O prazo de um token não representa logout automático. Não foram lidos valores de sessão, tokens ou passwords. |
| Processo selecionado | `web/src/lib/clientData.ts`: chave `portal.process` em `sessionStorage`; `AuthProvider.tsx` remove-a na limpeza de sessão. | Descrição da sessão do separador, sujeita ao comportamento de recuperação do navegador. |
| Preferências de desenvolvimento | `portal.dev-org` é usado apenas com `isDev`; o estado de demo está separado. | Não apresentar estes elementos como armazenamento do portal de produção. |
| Fontes e publicidade | Fontes incluídas no pacote; não foram encontrados scripts de publicidade/analytics no código da aplicação. | Não é uma auditoria de todos os registos, cabeçalhos ou cookies dos fornecedores; não afirmar «sem cookies» ou «sem logs». |

As fontes oficiais foram novamente consultadas. O DPA Resend, introdução e §6, identifica
Plus Five Five, Inc. e tratamento principal nos EUA; foram conferidas as listas públicas de
[Resend](https://resend.com/legal/subprocessors) e
[Supabase](https://supabase.com/legal/customer-resources/subprocessor-list). São informação
para validação contratual, não prova de que cada subcontratante recebeu dados Orvel.
O DPA e os termos Hobby da Vercel mantêm a pendência contratual já identificada. O texto
legislativo dos EAU voltou a devolver 403; não se inventaram normas, autoridade ou prazos.

Verificação remota apenas de leitura: 0 avisos publicados, 0 documentos, 0 tarefas de
eliminação, sem cron e sem `purge-documents`. Sem alterações de configuração, migrations,
dados, contas ou segredos. `RETENTION_ENABLED=false` preservado segundo o estado anteriormente
verificado, sem voltar a ler segredos. Nenhum serviço pago ou email de terceiros contratado/enviado.

Documentos revistos quanto a ligações locais, códigos de decisão e diferenças Git.
Não foram repetidas as suites de aplicação: esta revisão não alterou código executável.

## Resposta parcial C3, revisão 5

A responsável acrescentou exames médicos e Corporate Tax. O aviso passou a distinguir essas
categorias, os respetivos fundamentos e as decisões de conservação. Não se inferiu que sejam
relatórios clínicos completos, que incluam menores ou que o serviço fiscal inclua declarações
e contabilidade. Foram pedidas essas clarificações e os destinatários/países.

A folha de decisões inclui a referência FTA ao mínimo de sete anos para os registos fiscais
abrangidos, sem a aplicar indiscriminadamente a todos os documentos da Orvel. Para saúde,
identifica a condição adicional do RGPD quando aplicável e a necessidade de verificar as
regras dos EAU sobre localização de dados antes de usar o servidor na Irlanda. Fontes e
limites da consulta constam junto das respetivas notas na folha de decisões.

Esta atualização é exclusivamente documental. Sem publicação de aviso, recolha de documentos
médicos/fiscais, alteração de permissões ou configurações, eliminação ou contratação.

## Clarificação de visibilidade, revisão 6

A responsável confirmou: «Os documentos só estão visiveis para nós e para o cliente».
O aviso explicita o acesso reservado à equipa Orvel autorizada e ao cliente do respetivo
processo, sem visibilidade entre clientes. Foi pedida apenas a clarificação sobre eventuais
envios pela equipa fora do portal para executar o serviço. A resposta não foi interpretada
como inexistência de fornecedores de infraestrutura ou como confirmação de destinatários
externos. O nível dos exames e o âmbito de Corporate Tax continuam por confirmar.

Alteração exclusivamente documental, sem nova auditoria de acessos, alteração de código ou
permissões, publicação, eliminação ou contratação. Ligações locais e diferenças Git verificadas.

## Confirmação de envios externos, revisão 7

A responsável confirmou: «Sim; a equipa envia alguns documentos para tratar dos serviços».
O aviso passou a mencionar expressamente esses envios, mantendo a regra de acesso no portal
apenas pela equipa Orvel autorizada e pelo cliente do respetivo processo. Foram pedidos os
destinatários, documentos e países, sem solicitar ficheiros reais ou dados dos clientes.
Os destinatários usados como exemplos nas perguntas não foram tratados como confirmados.

A atualização não concede acesso a terceiros, não efetua envios nem altera permissões.
Aviso por aprovar e sem publicação, eliminação desativada e sem contratação. Verificação
limitada às diferenças e ligações locais dos documentos; sem nova auditoria remota.

## Destinatários para emissão da licença, revisão 8

A responsável esclareceu que os envios são feitos apenas dentro dos Emirados Árabes Unidos,
à IFZA ou à entidade competente para emissão da licença. O aviso e a folha de decisões
incorporam destinatários, país e finalidade. Permanecem por determinar os documentos
abrangidos, o canal e os papéis dos intervenientes. A resposta não foi interpretada como
envio de exames médicos ou Corporate Tax à IFZA, nem como localização de toda a infraestrutura
nos EAU. Não foram acrescentados destinatários não confirmados.

Atualização documental sem publicação, envio, alteração de acesso, eliminação ou contratação.
Diferenças e ligações locais verificadas; sem nova auditoria remota.

Clarificação editorial posterior, incorporada na revisão 8: «IFZA ou entidade onde estamos
a abrir empresa. Só dentro dos uae». A redação atual identifica a IFZA ou a entidade junto
da qual é constituída a empresa e preserva o limite dos envios aos EAU. A finalidade abrange
a constituição e a emissão da respetiva licença. Sem alterações à infraestrutura ou ao
estado de publicação, eliminação e contratação.

## Consolidação para aprovação, revisão 9

O aviso foi revisto de ponta a ponta sem inventar os factos em falta. A folha de decisões
passou a distinguir os pontos já confirmados de seis grupos de respostas: entidade/contacto,
países de atividade/acesso, conteúdo médico, âmbito fiscal, restantes dados/circulação e
conservação. O número de licença saiu dos campos obrigatórios do texto público; continua
útil para verificação de identidade e enquadramento, sem presumir uma exigência automática.
Foram mantidos os campos jurídicos ainda não resolvidos, em vez de os substituir por um
consentimento genérico ou declarar o texto pronto a publicar.

Fontes oficiais reconferidas: DPC sobre informação ao titular e dados de saúde; termos Vercel
Hobby (uso pessoal/não comercial) e DPA (Pro/Enterprise). A consulta integral da lei de saúde
dos EAU voltou a devolver 403; não foi emitida conclusão sobre a sua aplicação à Orvel.

Leitura local do código confirmou que `web/src/routes/client/Privacy.tsx` redireciona quem
não tem sessão e apresenta o texto por parágrafos. O plano de publicação passa a incluir
acesso anterior ao login, preparação do texto sem marcações editoriais, versão/data e
verificação com dados fictícios. Não foi implementada uma nova página nesta revisão.

A aprovação do aviso e o lançamento comercial do portal são decisões distintas: o plano
Hobby e a adequação para dados médicos continuam pendentes. Sem auditoria remota nova,
alterações de código/configuração, publicação, eliminação, envios ou contratação. Diferenças,
ligações locais e correspondência dos códigos de decisão verificadas; não se repetiram
testes de aplicação porque só foram alterados documentos.
