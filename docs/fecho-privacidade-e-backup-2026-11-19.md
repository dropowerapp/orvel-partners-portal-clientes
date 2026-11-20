# Fecho editorial da privacidade e operação do backup — 19/11/2026

## Resultado desta etapa

O [texto destinado ao cliente](aviso-privacidade-2026-11-19.md) está consolidado, sem campos
por preencher nem instruções internas. Substitui a revisão 16 como versão editorial de trabalho.
Não constitui certificação jurídica nem aprovação das condições técnicas/contratuais ainda pendentes.

Foi guardado no rascunho existente do Supabase de produção `ilwkiruybzxplnhwcwrs`, aviso
`19263bb0-b044-4c9e-8f9f-3b616ba76f83`, versão 1, mantendo `published_at = null`.
Não houve publicação, alteração de permissões, abertura a clientes ou ativação de eliminação.
A versão anterior na base de dados ainda continha a indicação automática `{retention_days}`;
essa indicação foi removida do rascunho. O texto novo mantém a decisão da responsável.

O portal formata títulos, listas e negrito; a referência externa do Markdown foi convertida
em texto legível com URL antes de guardar. SHA256 do corpo em produção:
`ddfa6a68841cebc271c4b8b04f6f3a80363335db4e34dadb847091a3281c4449`.
A leitura posterior confirmou correspondência, aviso público nulo, zero documentos no bucket,
zero tarefas de eliminação e ausência de pg_cron.

## O que a redação esclarece

- Entidade, IFZA, morada, contacto e responsáveis já confirmados; não voltar a pedi-los.
- Aptidão médica recebida do cliente; registo/certificado de Corporate Tax obtidos diretamente
  no portal fiscal. Não foram inventados outros destinatários desses documentos.
- Envios do serviço limitados à IFZA/entidade de constituição nos EAU; os fornecedores
  tecnológicos são tratados separadamente e o alojamento Supabase na Irlanda é explícito.
- Aceitação da proposta dentro do portal e confirmação de leitura distintas. Nenhum dos
  atos é apresentado como consentimento geral para dados de saúde ou marketing.
- Sem eliminação automática; revisão manual no fim da relação, com avaliação separada das
  obrigações legais e dos pedidos válidos de direitos. A conclusão de um processo não
  dispara a eliminação. Não foi reintroduzido um prazo automático de 30 dias.
- Contacto para direitos e identificação do UAE Data Office no enquadramento federal, com
  ligação informativa oficial expressamente distinguida de um formulário de reclamação.

## Condições que o texto, por si só, não resolve

1. **Alojamento comercial:** Vercel Hobby não permite esta utilização comercial. Login privado
   ou designação «pessoal» não alteram a finalidade real. O risco concreto inclui suspensão
   ou remoção do projeto sem aviso. Não foi contratada uma subscrição nem alterado o domínio.
2. **Informação de saúde e transferências:** continua por demonstrar o fundamento e as condições
   aplicáveis ao certificado de aptidão, incluindo alojamento nos fornecedores atuais e fora
   dos EAU. Não foi concluído que o certificado está isento de regras por vir do cliente ou
   ter acesso restrito. Não foi implementado neste trabalho um bloqueio específico por tipo
   de documento; a área do cliente continua dependente da publicação do aviso. Não recolher
   certificados reais enquanto este ponto não for resolvido.
3. **Condições contratuais e operação:** verificar a cobertura dos fornecedores para a entidade
   Orvel e o tratamento pretendido; documentar as condições de transferência e conservação
   aplicáveis, sem prometer garantias que ainda não estejam demonstradas. A revisão jurídica
   local é recomendada para resolver o ponto médico e as condições aplicáveis, não foi
   contratada nem apresentada como aprovação já obtida.

Os restantes detalhes históricos C/J da folha anterior são contexto de revisão, não uma
lista de perguntas a repetir nem um requisito para obter outra vez os mesmos dados.
Não atribuir uma DPO a Catia Fernandes/Fabio Roque nem exigir número da licença como
condição automática de publicação. Não afirmar que a infraestrutura fica toda nos EAU.

## Backup diário

Foi criada a automação local Codex **Backup diário da Orvel**, identificador
`backup-di-rio-da-orvel`, ativa diariamente às **09:00 Europe/Lisbon**. A preferência de
notificações foi definida como `failed_runs_only`. A automação chama o executor privado
`daily-backup.py run`; não altera produção e não apaga cópias. Depende de Mac, Codex,
ligação à internet, permissões locais e motor Docker/Rancher disponíveis.

O executor verifica uma cópia com menos de 20 horas ou cria e verifica uma nova; ignora
conjuntos parciais como prova de sucesso, recusa concorrência através do bloqueio existente,
deteta corrupção, impede novas cópias com espaço insuficiente e assinala menos de 10 GiB livres.
Guarda relatórios privados sem mensagens de erro dos processos filhos nem credenciais.
Uma falha/aviso tem de ser apresentado como tal na execução da automação.

Passaram os 15 testes anteriores e 7 testes novos com dados fictícios. O executor instalado
foi executado manualmente e confirmou a integridade da cópia real mais recente. A primeira
execução disparada pelo agendamento e a entrega de uma notificação de falha ainda não foram
observadas; não se confundem com o teste manual do executor.

A responsável respondeu que **ainda não dispõe de gestor de passwords nem de disco externo**
para guardar a chave. Não foi copiada para um destino não autorizado. A chave e as cópias
continuam neste Mac, separadas por pastas privadas. Esta solução não cobre perda, roubo ou
avaria do equipamento. Uma proteção independente futura requer cópia cifrada fora do Mac e
guarda segura da chave; guardar apenas a chave fora não recupera ficheiros perdidos com o Mac.

A recuperação SQL/Storage já ensaiada permanece válida no âmbito descrito no
[relatório de backup](backup-local-2026-11-18.md). A recuperação de todos os serviços e o
percurso funcional ficam para a validação final pedida pela responsável. Não declarar o
lançamento concluído antes de observar esse resultado.

## Procedimento interno mínimo

- Os pedidos de privacidade entram em hello@orvelpartners.com e são acompanhados pelos
  General Managers confirmados. Confirmar identidade com o mínimo de dados necessário.
- Registar o fim da relação com base em comunicação/decisão documentada, não no fecho de
  um processo. Antes de qualquer eliminação manual, listar categorias, fundamento de eventual
  conservação, decisão e cópias afetadas. Não executar eliminações nesta etapa.
- Manter um registo restrito das eliminações aprovadas para o aplicar antes de reabrir dados
  restaurados. Não apagar um conjunto com dados de vários clientes sem avaliar todos os dados
  e as necessidades de recuperação. Não prometer que apagar no portal limpa backups históricos.
- Rever avisos de falta de espaço/falhas de backup. Resolver armazenamento adicional por decisão
  expressa, sem limpeza automática ou aquisição de serviços. No dia de lançamento, confirmar
  que existe uma cópia recente verificada.

## Fontes consultadas em 19/11/2026

- [Termos Vercel, Hobby](https://vercel.com/legal/terms#hobby-plan): restrição de uso e possibilidade de suspensão.
- [DPA Vercel](https://vercel.com/legal/dpa): verificar cobertura do plano contratado, não presumir Hobby abrangido.
- [DPA Supabase](https://supabase.com/legal/customer-resources/data-processing-addendum).
- [DPA Resend](https://resend.com/legal/dpa).
- [Informação oficial EAU sobre proteção de dados](https://ai.gov.ae/personal-data-protection-law/): direitos, transferências e UAE Data Office.

As páginas públicas descrevem as condições gerais; a consulta não prova a aceitação de um
contrato específico nem resolve a aplicabilidade de regras especiais de saúde ao caso Orvel.

## Atualização de 20/11/2026: aviso publicado (versão 2)

- Texto final em [aviso-privacidade-2026-11-19.md](aviso-privacidade-2026-11-19.md) (versão de
  20/11): o certificado de aptidão médica é tratado como os restantes documentos, por decisão da
  responsável; dependentes (cônjuge e filhos) passam a estar previstos; as cópias de segurança
  referem o iCloud Drive (Apple) e a chave guardada pela Orvel.
- Na produção, a versão 1 (SHA-256 `ddfa6a68…`) já estava publicada e tinha 1 confirmação. O texto
  final foi publicado como **versão 2** (`fca8c69e-90a4-4ac2-8764-2b8617e68c86`, 20/11/2026
  12:27 UTC), em vigor; SHA-256 `1e59078313c150d58286f1f74ea3f719e307b819dcc2b9f72a10bf0676a80440`.
  A versão 1 fica como registo; quem a confirmou volta a confirmar na próxima entrada.
- Teste completo no Supabase de testes antes da publicação: db-test 452/452, e2e 68/68; no
  computador, portal 106/106, funções 39/39, backup 26/26.
- Continua pendente, por decisão da responsável, o plano comercial da Vercel.
