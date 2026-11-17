# Validação online dos documentos — 17/11/2026

Resultado: envio, correção, reenvio, aprovação e download validados no Supabase remoto,
com contas e PDFs fictícios. Não foi necessário alterar o código da aplicação.

## Ambiente e método

- Vercel Preview: <https://orvel-partners-portal-clientes-git-c-7a9f04-dropower-s-projects.vercel.app>.
- Ramo: `codex/documentos-design`; código funcional `a475596`, documentação `5b9d042`.
- Supabase: `xdakbbvnpoojhyapznkf`, ramo `main / PRODUCTION`, alvo previamente confirmado.
- Cliente fictício: Marta Exemplo, `marta.exemplo@exemplo.test`.
- Equipa fictícia: `equipa@exemplo.test`, com MFA configurado e confirmado pela utilizadora.
- Processo: `08bb6ae8-0178-bbe4-0b8f-347d3320c8be`.
- Pedido criado: `TESTE Documentos 17-11 - envio e revisão`
  (`728e866e-c72b-488f-8096-9372e36a5808`).

A criação do pedido, a revisão, a emissão, a mudança de visibilidade, a consulta do histórico
e a abertura de PDFs foram efetuadas na interface publicada, no Chrome. O envio e o reenvio
do cliente foram efetuados pela API pública autenticada, usando o mesmo fluxo Storage +
`register_upload` da interface. Os downloads autenticados foram também verificados por HTTP,
comparando os bytes recebidos com os originais. Não foi utilizada uma chave de serviço nos
testes do cliente, nem foram simulados JWTs ou permissões.

O login do cliente usou links mágicos reais do Supabase, registados exclusivamente no log
de teste (`EMAIL_LOG_DOMAINS=exemplo.test`). Não foram enviados emails reais. As consultas SQL
de confirmação foram apenas de leitura. Não houve reset, seed, alterações de RLS ou remoção
de dados remotos.

## Resultados

| Verificação | Resultado observado |
|---|---|
| Autenticação | Cliente fictício autenticado por link mágico; equipa com MFA real. |
| Pedido | Criado pela equipa e visível ao cliente como `pending`. |
| Envio inicial | PDF de 2009 bytes armazenado; pedido passou a `submitted` / Em análise. |
| Confirmação repetida | `register_upload` repetido para o mesmo objeto devolveu o mesmo ID, nas duas versões. |
| Download inicial | HTTP 200; conteúdo idêntico ao original. A equipa também abriu o PDF no Chrome. |
| Controlo de acesso | Download direto do Storage recusado; pedido anónimo de download recusado; cliente impedido de aprovar o próprio ficheiro. |
| Correção | A equipa rejeitou pela interface com motivo; o cliente recebeu `rejected` e o mesmo motivo. |
| Reenvio | A versão 2 foi aceite; o pedido regressou a `submitted` e o motivo anterior foi limpo. |
| Histórico | As duas versões permaneceram registadas; a interface da equipa mostrou a versão anterior. |
| Aprovação | A equipa aprovou a versão 2; cliente recebeu `approved` e a interface mostrou Aprovado. |
| Emitido interno | PDF carregado pela equipa com `visible_to_client=false`; ausente da listagem do cliente e download recusado com 404. |
| Disponibilização | Após a ação na interface, emitido visível ao cliente; download HTTP 200 e conteúdo idêntico ao original. |
| Interface do cliente | Login na Preview, consulta do pedido aprovado e abertura do PDF emitido no Chrome; consola sem erros observados. |
| Auditoria | Registos de criação, duas submissões, dois uploads, rejeição, aprovação, emissão e alteração de visibilidade confirmados. |

## Integridade dos ficheiros

Todos os PDFs estão marcados como documentos fictícios, sem dados reais e sem valor legal.

| Ficheiro | Bytes | SHA-256 confirmado após download |
|---|---:|---|
| `orvel-teste-v1.pdf` | 2009 | `3c1d05a2a1611fde8d0b0d2c12b1e4b5b7720ffdbc648694d020b08b381b24cd` |
| `orvel-teste-v2.pdf` | 2009 | `50aae95c6f3332d42c745cf64c2a5a9bd53170df75e1bf5771366c2efbf0a92e` |
| `orvel-teste-emitido.pdf` | 2010 | `8817dabcbcdaf8c039741a56c136ba04cbb83051b0460356239602686f7de324` |

Os documentos ficaram no processo fictício para permitir revisão do resultado. A versão 2
está aprovada e o emitido está visível ao cliente. Os acessos existentes e o MFA não foram
removidos. Tokens, links de acesso de uso único e chaves privadas não fazem parte deste relatório.

## Limites desta verificação

Esta execução valida o fluxo remoto com sessão real e complementa os 78 testes de frontend
e 308 verificações SQL locais. O seletor de ficheiros do cliente não foi percorrido no Chrome
nesta execução: os dois envios do cliente foram feitos pela API autenticada. O seletor de
ficheiros da equipa foi exercitado na emissão. Não foram repetidas as matrizes completas de
tipos/tamanhos inválidos, isolamento entre organizações, datas de validade ou expiração dos
URLs assinados. Não se trata de uma auditoria exaustiva de segurança.
