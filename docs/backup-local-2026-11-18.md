# Backup local provisório da Orvel — atualizado em 19/11/2026

**Três cópias cifradas concluídas. Integridade da mais recente e recuperação técnica da segunda verificadas.**
Agendamento diário local criado no Codex; sem contratação ou eliminação automática. A solução depende deste Mac e não
equivale a recuperação completa do portal nem a proteção fora do equipamento.

## Cópias e destino

- Destino autorizado: `~/Orvel-Backups`, fora do repositório. Pasta 700;
  ficheiros privados 600. Todas as cópias foram preservadas.
- Primeiro conjunto: `20261119T081259Z-5a91bf8e`, com 7 partes verificadas.
- Conjunto usado no ensaio de recuperação: `20261119T081642Z-4cbba66a`, com 10 partes verificadas, manifesto
  cifrado e `COMPLETE.json`; 2 939 045 bytes cifrados.
- Cópia mais recente: `20261119T131232Z-43ad4f66`, concluída depois da atualização do rascunho
  do aviso de privacidade na produção. Dez partes verificadas, 3 objetos de branding.
- Conteúdo: papéis exportáveis, esquema da aplicação, esquema suplementar Auth/Storage,
  esquema e dados do histórico de migrações, dados, código do commit de produção e Storage.
- Inventário: **3 ficheiros de branding e nenhum ficheiro no bucket documents**. O ensaio
  não recuperou documentos de clientes, porque não existiam nesse bucket.
- Controlo, ferramentas, acesso e chave de recuperação:
  `~/Library/Application Support/OrvelBackup`, separado das cópias.
  Credenciais e chave não foram mostradas no chat nem incluídas em Git.
- A responsável confirmou em 19/11 que o Mac está nos EAU, tal como os clientes e os
  acessos da equipa. Esta informação não muda a região Irlanda do Supabase.

O [exportador](../scripts/backup/orvel-backup.py) cifra os bytes diretamente com age, sem
escrever SQL ou documentos em claro no destino. Nomes e hashes ficam no manifesto cifrado;
objetos usam nomes locais opacos. Falhas de exportação/cifra, corrupção ou inventário alterado
impedem a conclusão. Conjuntos anteriores e eventuais `.partial` não são apagados automaticamente.

## Ensaio real executado

O [verificador de recuperação](../scripts/backup/restore-check.py) restaurou SQL e ficheiros
da segunda cópia num PostgreSQL isolado, num sistema de ficheiros temporário em memória.
Rede desativada, sem portas publicadas, raiz só de leitura, logs do contentor desativados e
limite de memória sem swap adicional. O contentor foi terminado após o ensaio; os backups ficaram intactos.

| Verificação | Resultado |
|---|---|
| Tabelas recuperadas e contagens conferidas | 59 |
| Registos conferidos por contagem | 96 |
| Ficheiros repostos e hashes comparados | 3 ficheiros de branding |
| Tabelas públicas sem RLS após o restauro | 0 |
| Políticas de Storage repostas | 4 |
| Ensaio técnico SQL/ficheiros | Passou |
| Recuperação completa de Supabase/Auth/Edge Functions/emails/frontend | Não executada |

Relatório privado: `Library/Application Support/OrvelBackup/reports/20261119T081642Z-4cbba66a-restore.json`.
Os papéis internos e extensões foram preparados como requisitos locais; os atributos de todos
os papéis da plataforma não foram comparados com produção. Conferir RLS e políticas existentes
não substitui testes funcionais de isolamento entre clientes, login e MFA no ambiente recuperado.

Imagem oficial: `supabase/postgres:17.12.0.001`, digest
`sha256:374df435f973b1d371dbaecb1a69403f4fdbb67238f354be424fe04435a45aee`.
Usar um destino compatível com PostgreSQL 17.12: o ensaio com 17.11 parou por não reconhecer
`pg_attver`. Não se removeram essas instruções dos backups. As políticas de Storage foram
aplicadas após as funções da aplicação de que dependem; a publicação de Realtime foi preparada
no destino. Nenhum ensaio foi feito sobre produção ou sobre o projeto de testes existente.

## Operação diária, manual e limites

Automação **Backup diário da Orvel**, `backup-di-rio-da-orvel`, ativa no Codex diariamente
às **09:00 Europe/Lisbon**, com preferência de notificação `failed_runs_only`.
Executa `daily-backup.py run` na pasta privada de configuração. Uma cópia com menos de
20 horas é verificada; caso contrário, é criada e verificada uma nova. Não duplica cópias
recentes nem apaga as antigas. Falta de espaço impede a criação; menos de 10 GiB gera aviso.
Os relatórios ficam em `OrvelBackup/reports`, sem credenciais ou erros brutos de processos filhos.

O executor diário foi instalado e verificado manualmente com uma cópia real; a execução
disparada pelo agendamento e uma notificação de falha ainda não foram observadas. Mac, Codex,
rede, permissões e motor de contentores têm de estar disponíveis; não é um serviço permanente
na nuvem. Não foram criados cron/launchd paralelos ou agendamentos na base de dados.

Ferramentas: age 1.3.2, Supabase CLI 2.122.0 e Rancher Desktop 1.25.0, obtidas dos releases
oficiais com verificação de integridade. Motor Moby operacional. O CLI usa a sua imagem
PostgreSQL 17.11.0.006 na exportação; o conjunto foi recuperado com sucesso em 17.12.

```sh
python3 "$HOME/Library/Application Support/OrvelBackup/orvel-backup.py" check
python3 "$HOME/Library/Application Support/OrvelBackup/orvel-backup.py" run
python3 "$HOME/Library/Application Support/OrvelBackup/orvel-backup.py" verify "/caminho/do/conjunto"
```

O Mac e o motor de contentores precisam de estar disponíveis. As exportações SQL têm snapshots
próprios e não existe snapshot atómico entre PostgreSQL e Storage; usar uma janela sem alterações.
O backup não copia os valores dos segredos de Edge Functions nem todas as definições da plataforma.
Para recuperar num Supabase gerido, seguir o procedimento oficial e rever as migrações e
customizações Auth/Storage, sem substituir cegamente esquemas geridos.
[Guia oficial](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

O campo antigo `restore_test_completed: false` dos marcadores de integridade não é alterado pelo
ensaio técnico. O relatório separado regista `database_restore_test_completed: true` e
`full_application_restore_test_completed: false`, distinguindo os âmbitos.

## Pontos ainda necessários

1. A responsável confirmou que ainda não tem gestor de passwords nem disco externo disponível.
   A chave permanece neste Mac. Guardar uma cópia da chave num local privado independente e
   testar o acesso quando houver destino autorizado. Para resistir à perda do Mac também é
   necessária uma cópia cifrada independente; só guardar a chave fora não recupera dados perdidos.
2. Observar a primeira execução automática e os avisos de falha. **Agendamento criado e ativo;
   executor testado manualmente.** Não configurar limpeza, expiração ou sincronização com apagamento.
3. Ensaiar um Supabase completo isolado: serviços, funções, configurações, segredos, login/MFA,
   emails, download e isolamento entre clientes. Não enviar emails reais durante o ensaio.
4. Identificar pessoas com acesso e tratamento de pedidos manuais de eliminação em backups
   com vários clientes. O país do Mac já foi confirmado como EAU.

Uma cópia só neste Mac não protege contra perda, roubo ou avaria do mesmo equipamento.
Acompanhar espaço livre, pois não há limpeza automática. Não foi verificado FileVault;
não afirmar que o disco inteiro está cifrado.

## Verificação da implementação

Passaram 22 testes fictícios: os 15 de cifra/descifra, corrupção, falhas de exportação, inventário
alterado, preservação de cópias, concorrência, permissões, projeto/porta, nomes do Storage,
passwords com caracteres especiais e proteção do formulário contra origem externa, Host
adulterado, CSRF, campos duplicados e substituição de credenciais; e 7 do executor diário,
incluindo prevenção de duplicados, cópia desatualizada, corrupção, falta de espaço, data futura,
ficheiros parciais e relatórios sem segredos. A corrupção de uma cópia recente gera falha,
sem ser ocultada pela criação de outra.

A responsável definiu uma nova password da base de dados no Supabase e guardou o acesso pelo
formulário local do browser. O agente não introduziu nem recolheu a password pelo chat/browser.
O servidor escutava apenas em `127.0.0.1`, não carregava recursos externos e fechou após guardar.
O envio foi validado no Chrome com dados fictícios. A política de referência foi corrigida para
`same-origin`, mantendo a rejeição de pedidos externos. O Terminal não foi controlado depois de
a ferramenta recusar esse acesso.

## Atualização de 20/11/2026: cópia fora do Mac

- O executor diário (`daily-backup.py`) passou a copiar cada conjunto completo e cifrado para
  `~/Library/Mobile Documents/com~apple~CloudDocs/Orvel-Backups` (iCloud Drive), com
  `offsite_destination` em `config.json`. Cada ficheiro é comparado por SHA-256 com o original;
  conjuntos parciais nunca saem do Mac; nada é apagado no destino. Uma falha na cópia externa
  marca a execução como falhada (`offsite_copy_failed`), para gerar o aviso.
- Execução manual a 20/11: conjunto novo `20261120T115342Z-b5d03f9f` (13 ficheiros verificados,
  6 objetos de Storage) e os 4 conjuntos copiados e verificados no iCloud Drive.
- Testes: 26 (os 22 anteriores e 4 novos da cópia externa).
- A chave (`identity.agekey`) fica, além deste Mac, na app Palavras-passe da Apple (iCloud
  Keychain), guardada pela responsável. Sem a chave, as cópias do iCloud não se abrem.
- A execução agendada das 09:00 de 20/11 não deixou relatório: o agendamento do Codex depende
  de a app estar aberta. Confirmar nos próximos dias ou passar para um agendamento do macOS.
