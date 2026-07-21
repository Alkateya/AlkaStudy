# Como publicar o AlkaStudy no GitHub

## 1. Preparar o computador

Instale o Git e crie uma conta no GitHub. No terminal, configure sua identidade:

```bash
git config --global user.name "Tiago Pereira de Medeiros"
git config --global user.email "alkateyadev@gmail.com"
```

## 2. Conferir o projeto

Antes de publicar, confirme que `node_modules/`, `release/`, arquivos temporários e dados pessoais de teste não serão enviados. O `.gitignore` do projeto deve conter essas exclusões.

Teste a versão que será registrada:

```bash
npm install
npm run desktop:build-ui
npm run desktop:start
```

## 3. Criar o repositório no GitHub

1. Entre em `https://github.com/new`.
2. Use o nome `alkastudy`.
3. Informe uma descrição curta do projeto.
4. Escolha **Public** se a banca precisar consultar o código, ou **Private** se o acesso for restrito.
5. Não marque as opções de criar README, `.gitignore` ou licença, pois esses arquivos já existem.
6. Clique em **Create repository**.

## 4. Iniciar o histórico local

Abra o terminal dentro da pasta do projeto e execute:

```bash
git init
git branch -M main
git add .
git status
git commit -m "feat: publica versao academica inicial do AlkaStudy"
```

Leia a saída de `git status` antes do commit. Não prossiga se aparecerem `node_modules`, chaves, senhas, arquivos `.env` ou dados pessoais de usuários.

## 5. Conectar e enviar

Substitua `SEU_USUARIO` pelo seu nome de usuário no GitHub:

```bash
git remote add origin https://github.com/SEU_USUARIO/alkastudy.git
git push -u origin main
```

O GitHub poderá solicitar autenticação pelo navegador. Senhas comuns não são aceitas no Git por HTTPS; utilize o login pelo navegador ou um token pessoal quando solicitado.

## 6. Configurar a página do projeto

Na página do repositório:

- adicione os tópicos `electron`, `react`, `typescript`, `spaced-repetition`, `gamification`, `education` e `offline-first`;
- mantenha a indicação de licença proprietária no README;
- adicione capturas de tela sem dados pessoais;
- crie uma seção **Releases** somente depois de gerar e testar o instalador.

## 7. Publicar a versão estável

Depois de validar a entrega:

```bash
git tag -a v1.0.0 -m "AlkaStudy 1.0.0 - primeira versao estavel"
git push origin v1.0.0
```

No GitHub, abra **Releases**, escolha a tag `v1.0.0`, use o conteúdo de `RELEASE_NOTES_v1.0.0.md` na descrição e anexe o instalador e o pacote portátil já testados. Não anexe `node_modules` nem o código-fonte em ZIP manualmente: o próprio GitHub gera os pacotes do código para cada tag.

## Atualizações posteriores

```bash
git add .
git status
git commit -m "tipo: descricao objetiva da alteracao"
git push
```

Tipos úteis: `feat` para funcionalidade, `fix` para correção, `docs` para documentação, `test` para testes e `refactor` para reorganização interna.
