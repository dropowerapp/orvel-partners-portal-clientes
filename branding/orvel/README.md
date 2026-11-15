# Marca Orvel Partners

Ficheiros do logótipo enviados pela Orvel (desenho da Cátia). **Não alterar o desenho.**
A única variação é a versão para fundo escuro (abaixo), criada com autorização da Orvel.

| Ficheiro | Para quê |
|---|---|
| `originais/logotipo.png`, `originais/simbolo.webp` | Ficheiros recebidos, tal como vieram |
| `logotipo.png` | Logótipo para fundo claro (cabeçalho do portal e emails). Só redimensionado (800×200) |
| `simbolo.png` | Símbolo (esfera) para o painel dos ecrãs de entrada. Só redimensionado e convertido para PNG (800×800) |
| `simbolo-180.png` | Ícone do separador do browser (180×180) |
| `logotipo-fundo-escuro.png` (800×200) e `-2000.png` (2000×500) | Versão para fundo escuro (painel dos ecrãs de entrada) |

O logótipo original tem o texto em cinzento `#546275` e usa-se sobre fundo claro.

**Versão para fundo escuro** (15/11/2026, autorizada pela Orvel, por não existir ficheiro): igual
ao original, só com o texto "ORVEL PARTNERS" na cor `#eef1f5`, a mesma com que o logótipo aparece
nos fundos escuros do guia da marca. A esfera e o desenho das letras não mudam (o texto do original
é de uma só cor e os contornos estão na transparência, por isso a troca de cor é exata). Se a Cátia
enviar uma versão oficial, substitui esta.

No Supabase, estes ficheiros vão para o bucket público `branding` (pasta da organização) com
`scripts/remote/branding-upload.sh`, que também preenche `organizations.logo_path`,
`theme.symbol_path` e `theme.logo_dark_path`.
