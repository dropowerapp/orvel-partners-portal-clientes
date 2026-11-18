# Revisão do aviso de privacidade e acesso — 18/11/2026

**Revisão editorial e técnica concluída; validação jurídica e publicação pendentes.**
O [rascunho revisto, revisão 3](aviso-privacidade-rascunho-2026-11-18.md) permanece sem
publicação. Após a confirmação da responsável, o percurso de proposta dentro do portal foi
implementado e instalado em produção. Não foram contratados serviços nem ativada eliminação.
Esta revisão não é uma certificação de conformidade.

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
| Sessão e preferências | `web/src/lib/supabase.ts` ativa persistência de sessão; `clientData.ts` guarda o processo em `sessionStorage`. Confirmar durações e pedidos reais antes de publicar um inventário definitivo. |
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
| Orvel + assessor jurídico | Confirmar registo/licença e regime aplicável nos EAU, eventuais regras da zona franca e alcance territorial do RGPD. Não inferir o regime apenas de «FZCO», da língua do portal ou do servidor na Irlanda. |
| Orvel + assessor jurídico | Fechar os fundamentos de cada finalidade e de dados de terceiros; avaliar condições adicionais para menores e dados especiais e a necessidade de representante, encarregado ou avaliação de impacto. |
| Orvel | Listar destinatários reais, países de acesso da equipa e fontes dos dados fora do portal. Confirmar quem gere pedidos em `hello@orvelpartners.com`. |
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
