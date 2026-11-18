# Aviso de privacidade — rascunho para revisão

**Não aprovado e não publicado.** Preparado em 18/11/2026 para a Orvel. Os campos entre
colchetes exigem confirmação. Este documento não substitui revisão jurídica, especialmente
quanto à entidade responsável, regime aplicável, transferências internacionais e conservação.
Não usar o prazo técnico inicial de 30 dias como política aprovada.

## Texto proposto para o cliente

### Quem trata os seus dados

A sua área de cliente é disponibilizada pela **CATIA DROPFORCE MANAGEMENT - FZCO**, que usa a marca
Orvel Partners, com sede em **Building A1, Dubai Digital Park, Dubai Silicon Oasis, Dubai,
United Arab Emirates, PO BOX 342001**, identificação de registo
**[NÚMERO E ENTIDADE DE REGISTO]**. Para assuntos de privacidade, contacte
**hello@orvelpartners.com**. **[IDENTIFICAR REPRESENTANTE OU ENCARREGADO DE PROTEÇÃO DE
DADOS, SE APLICÁVEL]**.

### Dados e finalidade

Usamos os dados de identificação e contacto, informações do processo, propostas e pagamentos,
documentos pedidos pela equipa e registos de utilização necessários para disponibilizar a área
de cliente, acompanhar os serviços contratados, verificar documentação e comunicar consigo.
O portal permite gerir processos de constituição de empresas e relocalização, incluindo etapas
e prazos associados. Os documentos concretamente necessários dependem do serviço contratado.

O portal regista operações relevantes, como alterações do processo, revisão e acesso a
documentos sensíveis. O endereço de email é usado para enviar convites e links de entrada.
Estes emails de acesso não incluem anexos com os seus documentos.

**[VALIDAR FINALIDADES E FUNDAMENTOS POR CATEGORIA: diligências pré-contratuais/contrato,
obrigações legais concretas e, quando aplicável, interesse legítimo identificado. Qualquer
tratamento que exija consentimento específico terá de o recolher separadamente.]**

Se fornecer dados de familiares ou de outras pessoas envolvidas no processo, a equipa terá
de confirmar a legitimidade dessa comunicação e a informação a prestar a essas pessoas.
**[DEFINIR O PROCEDIMENTO PARA MENORES E EVENTUAIS DADOS DE SAÚDE OU OUTRAS CATEGORIAS
QUE EXIJAM CONDIÇÕES ADICIONAIS; NÃO RECOLHER POR DEFEITO.]**

### Acesso, fornecedores e países

O acesso à documentação no portal é limitado às contas autorizadas para o respetivo processo
e à equipa autorizada da Orvel. A área administrativa exige autenticação de dois passos.
Os ficheiros dos processos ficam num bucket privado e os downloads usam ligações temporárias.

A infraestrutura inclui Supabase para base de dados, autenticação e ficheiros, Vercel para
servir a aplicação e Resend para emails de acesso. O projeto Supabase do portal está alojado
na Irlanda. Esta localização, por si só, não significa que todo o tratamento por todos os
fornecedores ou pela equipa ocorra exclusivamente na União Europeia.

**[CONFIRMAR ENTIDADES CONTRATANTES, SUBCONTRATANTES, PAÍSES, ACESSO DA EQUIPA E GARANTIAS
APLICÁVEIS ÀS TRANSFERÊNCIAS. IDENTIFICAR AUTORIDADES, ZONAS FRANCAS, BANCOS E OUTROS
DESTINATÁRIOS A QUEM A ORVEL ENVIA DADOS PARA EXECUTAR O SERVIÇO.]**

Um fornecedor de cópias de segurança só será incluído depois de selecionado e contratado.
**[ATUALIZAR ESTA SECÇÃO ANTES DE PUBLICAR.]**

### Conservação

Conservamos cada categoria apenas durante o período necessário à finalidade e às obrigações
aplicáveis. **[INSERIR PRAZOS OU CRITÉRIOS APROVADOS PARA DOCUMENTOS DE IDENTIFICAÇÃO,
DOCUMENTOS EMITIDOS, DADOS CONTRATUAIS/PAGAMENTOS, REGISTOS DE SEGURANÇA E BACKUPS.]**

**[EXPLICAR AS EXCEÇÕES POR OBRIGAÇÃO LEGAL OU LITÍGIO, O DESTINO NO TERMO DO PRAZO E O
TRATAMENTO DAS CÓPIAS DE SEGURANÇA. ALINHAR O TEXTO COM O FUNCIONAMENTO REAL.]**

### Pedidos e direitos

Pode contactar-nos para pedir informação sobre os seus dados e exercer os direitos que sejam
aplicáveis, incluindo acesso, correção, apagamento, limitação, oposição e portabilidade.
Quando o fundamento for consentimento, pode retirá-lo nos termos aplicáveis, sem afetar o
tratamento anterior lícito. Pode também apresentar reclamação à autoridade competente
**[IDENTIFICAR CONFORME O REGIME E A SITUAÇÃO DO TITULAR]**.

A equipa poderá pedir os elementos estritamente necessários para confirmar a identidade
e responder ao pedido. **[DEFINIR RESPONSÁVEL INTERNO, CANAL E PRAZOS DE RESPOSTA.]**

### Utilização do portal

O acesso depende do email registado pela equipa. Certos dados são necessários para executar
o serviço; quando não forem disponibilizados, a equipa explicará o efeito no processo.
**[IDENTIFICAR CAMPOS OBRIGATÓRIOS, FUNDAMENTO E CONSEQUÊNCIAS CONCRETAS.]**

O portal regista a versão deste aviso apresentada e a confirmação do utilizador.
**[VALIDAR A REDAÇÃO DESTA CONFIRMAÇÃO: TOMADA DE CONHECIMENTO NÃO É CONSENTIMENTO
GENÉRICO PARA TODO O TRATAMENTO.]** Não foram implementadas decisões automatizadas de
elegibilidade no portal; confirmar também os procedimentos externos da Orvel antes de
declarar a inexistência de decisões desse tipo em todo o serviço.

Versão: **[VERSÃO APROVADA]** · Aplicável desde: **[DATA DE PUBLICAÇÃO]**.

## Notas internas para a revisão

A denominação e a morada acima foram indicadas pela responsável em 18/11/2026 para este
rascunho. A identificação de registo e os restantes campos continuam por confirmar; esta
atualização não constitui aprovação ou publicação do aviso.

O aviso deve identificar responsável, finalidades/fundamentos, destinatários, transferências,
conservação e forma de exercer direitos, com informação clara antes da recolha. A definição
dos fundamentos e das garantias depende da entidade e dos serviços efetivos; confirmar a
aplicação do RGPD e do regime dos EAU com o revisor jurídico. Referências consultadas:
[transparência — DPC](https://www.dataprotection.ie/en/individuals/know-your-rights/right-be-informed-transparency-article-13-14-gdpr)
e [informação aos titulares — Comissão Europeia](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en).

Estado técnico atual: não existe aviso publicado, a área de cliente está bloqueada,
`RETENTION_ENABLED=false`, não existe cron nem worker de eliminação publicado. Não prometer
eliminação automática no texto enquanto essa operação não estiver aprovada e validada.

Depois de preencher/rever: guardar versão aprovada, confirmar política de conservação,
alinhar a redação do checkbox se necessário, publicar de forma explícita e executar o ensaio
de cliente com dados fictícios. Publicar o aviso e ativar eliminação são decisões separadas.
