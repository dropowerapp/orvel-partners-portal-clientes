# Revisão do aviso de privacidade e acesso — 18/11/2026

**Revisão editorial consolidada; validação jurídica e condições de publicação pendentes.**
O [texto limpo 1.0](aviso-privacidade-2026-11-19.md) substitui editorialmente a revisão 16 e
está guardado como rascunho em produção, sem publicação. O
[registo atualizado](fecho-privacidade-e-backup-2026-11-19.md) documenta o resultado e o
backup diário. Após a confirmação da responsável, o percurso de proposta dentro do portal foi
implementado e instalado em produção. Não foram contratados serviços nem ativada eliminação.
Esta revisão não é uma certificação de conformidade.

As confirmações estão reunidas numa [folha de decisões](confirmacoes-privacidade-2026-11-18.md):
C1–C4 para os factos e escolhas da Orvel; J1–J4 para fundamentos, regime, contratos e prazos;
P1 para a publicação posterior. Inclui a regra de conservação confirmada, detalhes ainda
pendentes e procedimento de resposta a pedidos, sem execução. Foram colocadas no chat as perguntas sobre licença/contacto,
países e documentos/destinatários. A resposta parcial «Exames médicos, e corporate tax»
foi incorporada na revisão 5. Na revisão 6 ficou registada a visibilidade apenas para a Orvel
e o respetivo cliente. Na revisão 7 foram confirmados envios de alguns documentos pela equipa
fora do portal para tratar dos serviços. Na revisão 8 ficaram identificados os destinatários
como IFZA ou entidade junto da qual é constituída a empresa, apenas nos EAU. A revisão 11
fecha o âmbito médico e fiscal: documento de aptidão para emissão do visto e apenas registo
e certificado de Corporate Tax. A revisão 16 distingue as origens: cliente para aptidão médica,
portal da autoridade fiscal para registo/certificado. Mantém-se a limitação dos envios à
IFZA/entidade de constituição nos EAU. Os papéis jurídicos dos intervenientes continuam por avaliar.

A revisão 9 reúne as respostas ainda necessárias em seis grupos na folha de decisões,
separa informação de apoio à identidade de requisitos do aviso e explicita os passos de
publicação. Não voltou a pedir destinatários ou países dos envios já confirmados.

A revisão 10 incorpora a decisão de não apagar cópias automaticamente e de rever manualmente
os documentos quando o cliente deixar de trabalhar com a Orvel. Substitui a sugestão de
30 dias após o fecho do processo; C4 fica parcialmente confirmado, com execução e exceções
legais ainda por definir.

A revisão 11 reduz as confirmações de negócio pendentes a quatro grupos: entidade/contacto,
países de atividade e acesso, origem/circulação dos dados e procedimento de conservação manual.
As validações jurídicas e a publicação ficam identificadas separadamente.

A revisão 12 regista a confirmação da entidade contratante e a escolha de backup cifrado
local provisório. A resposta «Sim» não fornece zona franca, pessoa responsável pelo email
ou países; esses dados não foram inferidos. A preparação do backup não equivale a uma cópia
operacional nem resolve a localização/condições de tratamento de documentos médicos.

Atualização de 19/11 — revisão 13: Catia Fernandes e Fabio Roque, ambos General Manager,
acompanham o contacto de privacidade. Clientes, acessos da equipa e Mac dos backups foram
confirmados nos EAU. «Free zone» não identifica a autoridade de registo, que permanece por
confirmar. Duas cópias cifradas e um ensaio técnico SQL/ficheiros foram concluídos; a recuperação
completa dos serviços e a guarda da chave fora do Mac continuam pendentes. Não há agendamento,
eliminação automática, contratação ou publicação do aviso.

Ainda em 19/11 — revisão 14: a responsável identificou expressamente **IFZA** como zona
franca/entidade de registo. C1 está respondido, sem voltar a pedir dados da entidade/contacto.
Este facto não designa a IFZA como autoridade de proteção de dados nem resolve, por si só,
fundamentos, transferências, informação médica e conservação. As referências atuais incluem
o [guia da IFZA](https://ifza.com/en/uae-pdpl-compliance-guide-personal-data-protection-law/)
e a [informação oficial sobre PDPL](https://ai.gov.ae/personal-data-protection-law/).

Revisão 15: em resposta às perguntas sobre aptidão médica e registo/certificado fiscal, a
responsável confirmou que os documentos são fornecidos pelo cliente e enviados apenas à
IFZA ou à entidade onde é aberta a empresa, sempre nos EAU. O aviso e a folha de decisões
passam a refletir essa origem e esses destinatários, sem voltar a perguntar. Não se acrescentam
clínicas, bancos, contabilistas ou autoridades fiscais como destinatários por suposição.
A confirmação dos envios da equipa não altera o alojamento na Irlanda nem aprova o
tratamento de saúde ou as transferências tecnológicas; o aviso permanece por publicar.

Revisão 16: a resposta específica posterior sobre Corporate Tax corrige a origem descrita
na revisão 15. A equipa obtém o registo e o certificado diretamente no portal da autoridade
fiscal; o documento de aptidão médica continua a ser recebido do cliente. A resposta não
especifica uma nova partilha dos certificados: não se acrescentaram destinatários nem se
alterou a limitação anteriormente confirmada dos envios do serviço. Sem publicação,
alteração de dados no portal, eliminação ou contratação.

## Decisões da responsável

- **Proposta aceite dentro do portal.** Antes da aceitação, o cliente acede à proposta e ao
  contacto da equipa. Depois, abre o acompanhamento do respetivo processo. A confirmação
  «Exatamente, o cliente aceita a proposta dentro do portal» resolve a dúvida anterior.
  Não exigir pagamento integral nem sinal como condição de abertura.
- **Sem planos pagos por enquanto.** A proposta anterior de backups e custos fica adiada.
  Não iniciar subscrições, destinos pagos ou recursos faturáveis.
- **Sem eliminação automática.** A responsável determinou que as cópias só devem ser
  apagadas quando o cliente deixar de trabalhar com a Orvel. Esse evento exige revisão manual,
  com análise separada das obrigações legais e de pedidos válidos de direitos. A conclusão
  de um processo não significa o fim da relação. Preservar `RETENTION_ENABLED=false`, sem
  publicar `purge-documents` e sem agendar cron; o mecanismo existente baseado no fecho de
  processos não corresponde à regra decidida. Não executar eliminações nesta revisão.
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
| Orvel | Aptidão médica recebida do cliente; registo/certificado fiscal obtidos diretamente no portal da autoridade fiscal. Mantém-se a limitação dos envios à IFZA/entidade de constituição nos EAU. Documentar canais/controlos e outros pontos de C3 sem voltar a pedir origens, países ou entidade/contacto. |
| Orvel + assessor jurídico | Regra confirmada: sem eliminação automática e revisão manual no fim da relação com o cliente. Definir registo desse evento, responsável, prazo de atuação e exceções por categoria; tratar separadamente propostas não aceites, logs, contas e futuras cópias. O valor técnico de 30 dias não está autorizado para execução. |
| Orvel + assessor jurídico | Confirmar contratos de tratamento, entidades, subcontratantes e garantias de transferências. Não apresentar um DPA público como prova de contrato adequado ao plano utilizado. |
| Equipa técnica | Condição de acesso implementada e ensaiada. Falta disponibilizar o aviso aprovado antes da recolha e concluir os restantes ensaios no domínio final. A renderização atual divide texto por parágrafos; preparar versão de publicação legível sem tabelas Markdown não suportadas. |
| Orvel + assessor jurídico | Aprovar o texto final, versão/data, autoridade/canal de reclamação e procedimento de resposta a direitos. Publicar só depois de fechar os campos pendentes. |

A ausência de eliminação automática não permite ignorar um pedido válido de
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

## Preparação técnica posterior — leitura pública

Após autorização para avançar com os passos necessários, foi implementada a leitura pública
em `/aviso-de-privacidade`, separada da confirmação autenticada em `/privacidade`. O aviso
jurídico permanece por aprovar e não foi publicado. A migração de consulta pública está
instalada em testes e produção; a alteração não muda dados de clientes ou conservação.

Esta etapa substitui a pendência técnica de leitura antes do login e de formatação do texto
mencionada nas revisões anteriores. Continuam pendentes os factos e validações jurídicas.
Passaram 106 testes de frontend, 453 verificações SQL e build. Evidências e limites:
[validação da leitura pública](validacao-privacidade-publica-2026-11-18.md).

## Regra de conservação confirmada, revisão 10

A responsável esclareceu que as cópias não podem ser apagadas automaticamente e que a
eliminação só deve ocorrer quando o cliente deixar de trabalhar com a Orvel. A decisão
foi incorporada no aviso e na folha de confirmações: conservar as cópias necessárias durante
a relação e avaliar manualmente a eliminação no seu termo, ressalvando obrigações legais e
pedidos válidos relativos aos dados. A conclusão de um processo ou emissão de licença não
é o evento de fim da relação. Foram retiradas as sugestões de 30 dias para identificação
e de revisão do acesso 90 dias após o fecho de um serviço.

Faltam definir o registo do fim da relação, responsável e prazo de atuação, além das
exceções e critérios por categoria. Informação médica não pode ser conservada sem
necessidade apenas por existir uma relação ativa; Corporate Tax mantém análise própria.
A proposta de backups fica adiada e sem regras de expiração/limpeza automática autorizadas.

Atualização apenas documental, sem publicar o aviso, eliminar dados, alterar configurações
ou contratar serviços. Não foi feita nova inspeção remota; mantêm-se as evidências técnicas
datadas acima. Verificadas diferenças, ligações locais e consistência das referências; testes
de aplicação não repetidos por não haver alterações executáveis.

## Fecho editorial e âmbito dos documentos, revisão 11

No pedido de finalização, a responsável especificou «o documento que atesta o cliente para
receber o visa» e «Apenas registo e certificado fiscal». O aviso passa a identificar o
documento de aptidão médica para emissão do visto e a restringir Corporate Tax ao registo
e certificado. Não foram inspecionados documentos reais. A recolha de relatórios clínicos,
resultados detalhados, declarações fiscais e contabilidade não faz parte do âmbito definido.

Foram retiradas as perguntas de escolha de âmbito já respondidas. A folha de decisões reúne
quatro grupos de confirmações de negócio ainda necessários, os pontos jurídicos por fechar
e os passos de publicação. As notas de conservação no aviso foram encurtadas, mantendo a
regra confirmada sem eliminação automática e sem decisões presumidas sobre prazos legais.

Fontes oficiais reconferidas em 18/11/2026:

- [Governo dos EAU — proteção de dados](https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws):
  enquadramento federal, regras específicas e UAE Data Office. O resumo não resolve o
  enquadramento da entidade nem o canal de reclamação concreto a publicar.
- [Governo dos EAU — informação de saúde](https://u.ae/en/about-the-uae/digital-uae/whole-of-government-approach/digital-health/ict-in-the-health-sector):
  legislação específica de informação de saúde; não constitui autorização para guardar
  o documento de aptidão na infraestrutura atual. O texto integral das leis 45/2021 e
  2/2019 voltou a devolver HTTP 403 no portal legislativo.
- [Comissão Europeia — aplicação do RGPD](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en)
  e [informação a prestar](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en):
  os mercados e estabelecimentos importam para o âmbito; identidade, finalidades, bases,
  fontes, conservação e direitos devem ser concretizados quando o regime seja aplicável.

Sem publicação, alterações à aplicação, consultas remotas, eliminação, envios ou contratação.
Diferenças, ligações locais e referências C/J/P verificadas. Os testes técnicos citados nas
etapas anteriores não foram repetidos nesta atualização exclusivamente documental.
