# AlkaStudy Desktop

Copyright © 2026 Tiago Pereira de Medeiros. Todos os direitos reservados.

Aplicativo offline para Windows, com perfil, baralhos, edição de cartas, revisão espaçada, estatísticas e tema claro/escuro. Os dados ficam no armazenamento local do aplicativo.

## Desenvolvimento

1. `npm install`
2. `npm run desktop:build-ui`
3. `npm run desktop:start`

## Gerar instalador do Windows

Em um computador Windows, dê duplo clique em `GERAR_INSTALADOR_WINDOWS.bat`. Os arquivos serão criados na pasta `release` nos formatos instalável (NSIS) e portátil. Também é possível executar `npm run desktop:dist` no terminal.

Antes de distribuir a versão, siga `CHECKLIST_TESTE_INSTALADOR.md`.

## Importação

TXT e CSV aceitam uma carta por linha nos formatos `pergunta ; resposta`, tabulação ou `pergunta | resposta`. A leitura completa de APKG está reservada para a próxima etapa, pois exige extrair o banco SQLite interno do pacote Anki.
