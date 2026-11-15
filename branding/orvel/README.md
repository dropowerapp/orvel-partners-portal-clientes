# Marca Orvel Partners

Ficheiros do logótipo enviados pela Orvel (desenho da Cátia). **Não alterar o desenho.**

| Ficheiro | Para quê |
|---|---|
| `originais/logotipo.png`, `originais/simbolo.webp` | Ficheiros recebidos, tal como vieram |
| `logotipo.png` | Logótipo para fundo claro (cabeçalho do portal e emails). Só redimensionado (800×200) |
| `simbolo.png` | Símbolo (esfera) para o painel dos ecrãs de entrada. Só redimensionado e convertido para PNG (800×800) |
| `simbolo-180.png` | Ícone do separador do browser (180×180) |

O logótipo tem o texto em cinzento: usa-se sobre fundo claro. Não há ainda versão para fundo
escuro; se for precisa, pedir à Cátia em vez de a criar.

No Supabase, estes ficheiros vão para o bucket público `branding` (pasta da organização) com
`scripts/remote/branding-upload.sh`, que também preenche `organizations.logo_path` e
`theme.symbol_path`.
