# Guia de Execução e Conexão com o Supabase — Checkpoint 2 (PPI)

Este projeto suporta **dois bancos de dados reais** (você pode usar qualquer um deles ou ambos):
1. **Supabase (PostgreSQL na Nuvem)** — permite acessar e cadastrar prontuários **de qualquer lugar** (inclusive hospedando gratuitamente no GitHub Pages, Vercel ou Netlify, ou abrindo em computadores diferentes do grupo).
2. **SQLite 3 Local (`database.db`)** — roda localmente com dois cliques em `iniciar_servidor.bat`.

---

## Como Vincular ao Supabase em 3 Passos (Para Acessar de Qualquer Lugar)

### Passo 1 — Criar o projeto e as tabelas no Supabase
1. Acesse [https://supabase.com](https://supabase.com), faça login e clique em **New Project**.
2. No menu lateral esquerdo do seu projeto no Supabase, clique em **SQL Editor** → **New query**.
3. Abra o arquivo **`supabase_schema.sql`** (que está nesta pasta), copie todo o código SQL dele, cole no SQL Editor do Supabase e clique em **Run**.
   - Isso criará automaticamente as tabelas `public.cidadaos` e `public.logs_operacoes` no PostgreSQL, além de inserir os 4 prontuários iniciais e configurar as políticas de acesso (RLS).

### Passo 2 — Pegar a URL e a Chave da API no Supabase
1. No menu lateral do Supabase, clique em **Project Settings (ícone de engrenagem)** → **API**.
2. Copie dois valores:
   - **Project URL** (ex.: `https://abcdefghijklm.supabase.co`)
   - **Project API Keys → `anon` `public`** (chave longa que começa com `eyJ...`)

### Passo 3 — Conectar o seu site ao Supabase
Você pode fazer isso de duas formas:
- **Opção 1 (Para deixar fixo e hospedar na internet — GitHub Pages / Vercel / Netlify):**
  Abra o arquivo **`config.js`** e cole a sua `url` e a sua `anonKey`:
  ```javascript
  window.SUPABASE_CONFIG = {
      url: "https://seu-projeto.supabase.co",
      anonKey: "sua-chave-anon-public-aqui"
  };
  ```
  Depois disso, basta subir os arquivos (`index.html`, `prontuario.html`, `style.css`, `script.js`, `config.js` e a pasta `img/`) no **GitHub Pages**, **Vercel** ou **Netlify** (ou abrir o `index.html` em qualquer PC): qualquer cadastro, edição ou exclusão ficará salvo na nuvem do Supabase para todos!
- **Opção 2 (Direto pela tela do sistema):**
  Após fazer login na tela do sistema, clique no botão **"Conectar Supabase (Nuvem)"**, cole a URL e a Anon Key e clique em **Salvar e Conectar ao Supabase**.

---

## O que Explicar para o Professor na Apresentação (Item 8 com Supabase)

1. **Onde os dados ficam e como estão organizados**:
   - Mostre o painel **Table Editor** do Supabase no navegador com as tabelas relacionais `cidadaos` e `logs_operacoes` no **PostgreSQL**, e também o painel **"Inspecionar Banco & JSON-LD"** dentro do próprio site.
2. **Operação de escrita ao vivo**:
   - Clique em **"+ Cadastrar Cidadão"**, cadastre um novo prontuário na hora (ou clique em **Editar / Excluir** em um card) e mostre o registro aparecendo imediatamente na tela do site e na tabela `cidadaos` lá no painel do Supabase!
3. **Como a aplicação conversa com o banco e Segurança contra SQL Injection**:
   - A aplicação conversa com o banco PostgreSQL do Supabase via **API RESTful (PostgREST)** usando cabeçalhos de autenticação (`apikey` e `Bearer token`) e políticas de **Row Level Security (RLS)** no banco.
   - Todos os filtros e dados enviados em JSON pelo `fetch()` são transformados pelo PostgREST do Supabase em **Consultas Parametrizadas (`Prepared Statements` com `$1, $2...`)** no PostgreSQL, impedindo que qualquer texto digitado pelo usuário altere a estrutura do comando SQL (proteção total contra **SQL Injection**).
