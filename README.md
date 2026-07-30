# AlkaStudy

<p align="center">
  <img src="public/brand/alkastudy-logo-light.png" alt="AlkaStudy — Ferramenta de Estudos Inteligente" width="520">
</p>

Aplicativo desktop offline de estudos que combina revisão espaçada, organização de baralhos, metas diárias e gamificação. O projeto foi concebido para apoiar estudantes de concursos públicos, escola, exames e outras jornadas de aprendizagem.

> Projeto acadêmico desenvolvido por **Tiago Pereira de Medeiros**, estudante de Engenharia de Software da Uninter, como objeto de estudo para Conclusão de Curso.

## Funcionalidades atuais

- perfil de estudo armazenado localmente;
- criação, edição e exclusão de baralhos e cartas;
- importação de baralhos em TXT e CSV;
- formatação segura de enunciados e respostas;
- revisão espaçada com quatro avaliações: De novo, Difícil, Bom e Fácil;
- persistência do histórico, do intervalo e da próxima revisão;
- metas diárias, XP, níveis, sequência de estudo e estatísticas;
- coleção de dez troféus e rank do usuário;
- temas claro e escuro;
- funcionamento local em uma janela desktop com Electron.

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

- a importação completa de APKG ainda não foi implementada;
- os dados ficam no armazenamento local do aplicativo e ainda não possuem sincronização ou backup automático;
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
