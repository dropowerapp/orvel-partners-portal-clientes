# Backups e custos para lançamento — 18/11/2026

**Proposta preparada, sem contratação ou agendamento.** A responsável confirmou que ainda
não existe destino de backups e pediu a solução e os custos. Não foram copiados dados de clientes
para outro fornecedor. A eliminação de documentos e de cópias permanece desativada.

## Solução proposta

1. **Supabase Pro na organização Orvel Partners:** manter o projeto atual na Irlanda e usar
   os backups diários da base de dados, disponíveis durante sete dias. Acrescentar uma cópia
   lógica independente. O Free requer exportações próprias; os backups da base de dados não
   contêm os ficheiros do Storage. [Backups Supabase](https://supabase.com/docs/guides/platform/backups).
2. **Backblaze B2 numa conta exclusiva Orvel, região EU Central:** destino privado para uma
   cópia cifrada da base de dados, dos objetos de `documents` e de `branding`, com inventário
   e hashes. A região europeia corresponde a Amesterdão e é escolhida ao criar a conta;
   não pode ser alterada nessa conta depois. [Regiões B2](https://www.backblaze.com/docs/cloud-storage-data-regions).
3. **Execução diária num ambiente controlado**, por exemplo num workflow protegido do repositório
   atual, após decidir e aprovar o local dos segredos. Credenciais limitadas, sem execução em PRs
   externos, sem conteúdo de documentos nos logs ou artefactos públicos. O job comunica falha
   e ausência de execução. O envio de alertas será configurado apenas após confirmar destinatário.
4. **Recuperação ensaiada num projeto isolado**, sem ligar o domínio de produção e sem enviar
   emails reais. Restaurar primeiro dados fictícios, incluindo ficheiros, e só considerar a solução
   operacional depois de medir e registar a recuperação completa.

O RPO proposto é até 24 horas (perda máxima entre cópias concluídas); o objetivo inicial de
recuperação é um dia útil. São objetivos a validar no ensaio, não garantias já demonstradas.

## Estimativa mensal

Valores em USD, consultados em 18/11/2026. Impostos, câmbio, utilização excedente e serviços
adicionais não incluídos. Os preços finais devem ser conferidos no checkout antes de contratar.

| Componente | Base proposta | Observação |
|---|---:|---|
| Supabase Pro | cerca de $35/mês com os dois projetos atuais | $25 de plano + $20 para dois Micro − $10 de crédito. Confirmar compute no checkout. [Preço](https://supabase.com/pricing). |
| Vercel Pro | desde $20/mês | Estimativa para um lugar de developer; utilizadores adicionais e consumo podem aumentar o total. A alteração é da equipa atual, onde existem outros projetos. [Preço](https://vercel.com/pricing). |
| Resend Free | $0/mês | Até 3 000 emails/mês e 100/dia, partilhados pelo uso da conta. Não exige troca de fornecedor. [Preço](https://resend.com/pricing). |
| Backblaze B2 | desde $6,95/TB/mês armazenado | Exemplos aritméticos: 100 GB ≈ $0,70/mês; 1 TB ≈ $6,95/mês. O volume é o total de cópias/versões conservadas. [Preço](https://www.backblaze.com/cloud-storage/pricing). |

**Base estimada para a organização atual: cerca de $55/mês + backups, impostos e excedentes.**
Com 100 GB de cópias armazenadas, cerca de $55,70/mês antes desses extras. Isto não é um limite de faturação.
O projeto de recuperação pode gerar compute adicional enquanto existir; o runner do agendamento
e a transferência de saída do Supabase podem ter custos conforme o volume e as quotas.

A consulta confirmou **dois projetos ativos na mesma organização**: testes
`xdakbbvnpoojhyapznkf` e produção `ilwkiruybzxplnhwcwrs`. A subscrição é por organização e
abrange ambos. A estimativa inicial de $45/mês assumia apenas um projeto Supabase faturado;
foi corrigida após esta confirmação. Separar testes numa organização Free poderia reduzir a
base para cerca de $45/mês, mas exige uma decisão de transferência; não foi feita nenhuma.
[Faturação por organização](https://supabase.com/docs/guides/platform/billing-on-supabase).

Não multiplicar o preço por apenas o volume atual dos documentos: conservar versões aumenta
o total. Repetir um download integral diário também consome tráfego. A implementação deverá
copiar ficheiros novos/alterados e verificar o inventário completo, preservando versões.

Não foi contratado PITR, armazenamento, plano Pro ou outro extra. A decisão anterior de manter
gratuito continua respeitada até autorização específica. O plano Vercel Hobby tem restrição de
uso comercial, a rever antes da abertura empresarial. [Termos Vercel](https://vercel.com/legal/terms#hobby-plan).

## Conteúdo de uma cópia recuperável

| Parte | Conteúdo e verificação |
|---|---|
| Base de dados | Esquema, dados da aplicação, relações, permissões, RLS, funções e histórico de migrações; Auth e personalizações de schemas geridos conforme o procedimento suportado. Não usar um simples CSV como backup completo. |
| Storage | Bytes dos ficheiros e inventário de bucket/caminho/tamanho/SHA-256; guardar o inventário dentro do conjunto cifrado. Metadados SQL sozinhos não recuperam um PDF. |
| Código | Commit do frontend, migrações e código das Edge Functions; o repositório atual continua a ser a fonte. |
| Configuração | Domínio, callbacks exatos, bucket privado, MIME/limites, nomes dos segredos, funções publicadas e opção de retenção. Guardar valores secretos apenas num cofre separado e controlado pela Orvel. |
| Credenciais de recuperação | Cópia protegida da chave de descodificação e códigos de recuperação, separada do fornecedor e do job de backups. Testar acesso pela responsável. |

O procedimento de exportação/restauração deve seguir a versão efetivamente instalada do CLI.
O ambiente atual não tem Docker nem `pg_dump`/`psql` disponíveis; nenhuma restauração foi
executada nesta etapa. Não improvisar uma exportação parcial de produção nem confundi-la com
um ensaio de recuperação. [Guia oficial](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Critérios de aceitação antes de ativar

- Conta, região, acesso, custos e cofre de recuperação aprovados; destino privado e cifra verificados.
- Primeiro ensaio com dados e documentos fictícios, sem documentos reais nem segredos em Git.
- Cópia identificada por data e projeto; exportação consistente e verificação de que todos os
  caminhos referidos na base de dados existem no snapshot de ficheiros. Uma cópia incompleta falha.
- Restaurar num destino isolado e confirmar contagens, relações, hashes, bucket privado,
  RLS, recusa de acesso anónimo, isolamento entre dois clientes e MFA da equipa.
- Reconfigurar Auth, segredos e funções de forma explícita; não copiar sessões de teste para
  produção. Em recuperação real, avaliar revogação de sessões e rotação conforme o incidente.
- Medir duração e ponto recuperado; guardar o relatório sem dados pessoais. Ensaiar também
  a deteção de falha de backup e a recuperação da chave de cifra.
- Definir a conservação das cópias com a revisão jurídica. Até lá, não configurar `prune`,
  regras de expiração, sincronização com apagamento ou eliminação de versões.
- Antes de uma futura eliminação, impedir que uma restauração volte a disponibilizar documentos
  já eliminados pela política. O prazo dos backups deve integrar a política de conservação.

## Decisões necessárias

Confirmar a solução e o orçamento; criar/autorizar o destino B2 europeu; decidir onde executar
e guardar os segredos; aprovar os objetivos e a política de conservação. Depois implementar,
ensaiar e só então agendar. A proposta não implica autorização de custos ou abertura a clientes.
