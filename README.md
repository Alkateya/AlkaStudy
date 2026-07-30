# AlkaStudy

<p align="center">
  <img src="public/brand/alkastudy-logo-light.png" alt="AlkaStudy — Ferramenta de Estudos Inteligente" width="520">
</p>

Aplicativo desktop offline de estudos que combina revisão espaçada, organização de baralhos, metas diárias e gamificação. O projeto foi concebido para apoiar estudantes de concursos públicos, escola, exames e outras jornadas de aprendizagem.

> Projeto acadêmico desenvolvido por **Tiago Pereira de Medeiros**, estudante de Engenharia de Software da Uninter.

## Funcionalidades atuais — v1.0.3

- perfil, metas, XP, níveis, sequência, troféus e estatísticas;
- criação, edição, importação e organização de baralhos e cartas;
- pastas e subpastas, prioridades, ordenação, grade/lista e vínculo com concursos;
- revisão espaçada com histórico, intervalo e próxima revisão persistentes;
- importação TXT, CSV e APKG;
- concursos abertos, previstos e realizados, calendário e histórico;
- painel comparativo de concursos, matérias, pesos e progresso individual;
- relatórios de compatibilidade entre concursos e progresso geral ponderado;
- backup e restauração dos dados;
- temas claro e escuro com controles de alto contraste;
- funcionamento offline em aplicativo portátil para Windows.

Consulte [RELEASE_NOTES_v1.0.3.md](RELEASE_NOTES_v1.0.3.md) para o histórico
detalhado das melhorias desde a v1.0.0.

## Tecnologias

- React 19 e TypeScript para a interface e regras de apresentação;
- Vite para desenvolvimento e compilação da interface desktop;
- Electron para execução como aplicativo de área de trabalho;
- Web Storage (`localStorage`) para persistência local da versão atual;
- HTML e CSS responsivos para a identidade visual.

## Arquitetura resumida

O processo principal do Electron cria a janela segura do aplicativo e carrega a interface compilada. A camada React gerencia perfil, baralhos, cartas, gamificação e sessões de revisão. O repositório local serializa os dados no dispositivo do usuário. Cada avaliação registra o instante da resposta, o intervalo calculado e a data da próxima revisão, respeitando o relógio da máquina.

Documentação detalhada: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Executar em desenvolvimento

### Requisitos

- Node.js 22.13 ou superior;
- npm;
- Windows, Linux ou macOS para testes; a distribuição configurada atualmente tem como alvo o Windows.

### Comandos

```bash
npm install
npm run desktop:build-ui
npm run desktop:start
```

## Gerar o aplicativo para Windows

Em um computador Windows:

```bash
npm run desktop:dist
```

Os pacotes instalável e portátil serão gravados em `release/`.

## Formato de importação

TXT e CSV aceitam uma carta por linha, separando pergunta e resposta por ponto e vírgula, tabulação ou barra vertical.

```text
Qual é a capital da Bahia? ; Salvador
**Princípio** da Administração Pública | Legalidade, impessoalidade, moralidade, publicidade e eficiência.
```

Marcações reconhecidas: `**negrito**`, `==marca-texto==`, `` `código` ``, `<b>`, `<strong>`, `<i>`, `<u>`, `<mark>`, `<code>` e `<br>`.

## Limitações conhecidas

- os dados ficam no armazenamento local do aplicativo e não possuem sincronização em nuvem;
- o backup e a restauração são iniciados manualmente pelo usuário;
- editais e notícias externas não são coletados automaticamente de uma fonte oficial;
- o algoritmo de revisão é uma implementação própria e deverá ser validado empiricamente no estudo acadêmico;
- não há conexão com serviços externos na versão offline.

## Estrutura do repositório

```text
app/             interface principal e regras do produto
desktop/         processo principal, preload e entrada desktop
docs/            arquitetura e instruções de publicação
public/          recursos visuais públicos
tests/           testes automatizados existentes
```

## Autoria e citação

**Autor:** Tiago Pereira de Medeiros  
**Curso:** Engenharia de Software — Uninter  
**Local e ano:** Camaçari, BA — 2026  
**Contato:** alkateyadev@gmail.com

Para citar o software, consulte [CITATION.cff](CITATION.cff).

## Direitos autorais

Copyright © 2026 Tiago Pereira de Medeiros. Todos os direitos reservados.

Este repositório é disponibilizado para consulta e avaliação acadêmica. A presença pública do código não concede permissão automática para copiar, modificar, redistribuir, sublicenciar ou explorar comercialmente a obra. Consulte [LICENSE](LICENSE).
