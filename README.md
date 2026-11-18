Guia de Execução e Conexão com o Supabase — Checkpoint 2 (PPI)
Este projeto suporta dois bancos de dados reais (você pode usar qualquer um deles ou ambos):

Supabase (PostgreSQL na Nuvem) — permite acessar e cadastrar prontuários de qualquer lugar (inclusive hospedar gratuitamente no GitHub Pages, Vercel ou Netlify, ou abrir em computadores diferentes do grupo).
SQLite 3 Local( database.db) — roda localmente com dois cliques em iniciar_servidor.bat.
Como Vincular ao Supabase em 3 Passos (Para Acessar de Qualquer Lugar)
Passo 1 — Criar o projeto e as tabelas no Supabase
Acesse https://supabase.com , faça login e clique em Novo Projeto .
No menu lateral esquerdo do seu projeto no Supabase, clique em Editor SQL → Nova consulta .
Abra o arquivo supabase_schema.sql(que está nesta pasta), copie todo o código SQL dele, cole no SQL Editor do Supabase e clique em Run .
Isso criará automaticamente as tabelas public.cidadaose public.logs_operacoesno PostgreSQL, além de inserir os 4 prontuários iniciais e as configurar políticas de acesso (RLS).
Passo 2 — Pegar a URL e a chave da API no Supabase
No menu lateral do Supabase, clique em Configurações do Projeto (ícone de especificação) → API .
Copie dois valores:
URL do projeto (ex.: https://abcdefghijklm.supabase.co)
Chaves de API do projeto →anon public (chave longa que começa com eyJ...)
Passo 3 — Conectar seu site ao Supabase
Você pode fazer isso de duas formas:

Opção 1 (Para deixar fixo e hospedado na internet — GitHub Pages / Vercel / Netlify): Abra o arquivo config.jse cole a sua e a urlsua anonKey:
window.SUPABASE_CONFIG = {
    url: "https://seu-projeto.supabase.co",
    anonKey: "sua-chave-anon-public-aqui"
};
Depois disso, basta subir os arquivos ( index.html, prontuario.html, style.css, script.js, config.jse a pasta img/) no GitHub Pages , Vercel ou Netlify (ou abrir o index.htmlem qualquer PC): qualquer cadastro, edição ou exclusão ficarão salvos na nuvem do Supabase para todos!
Opção 2 (Direto pela tela do sistema): Após fazer login na tela do sistema, clique no botão "Conectar Supabase (Nuvem)" , cole uma URL e a Anon Key e clique em Salvar e Conectar ao Supabase .
O que Explicar para o Professor na Apresentação (Item 8 com Supabase)
Onde os dados ficam e como estão organizados :
Mostre o painel Table Editor do Supabase no navegador com as tabelas relacionais cidadaose logs_operacoesno PostgreSQL , e também o painel "Inspecionar Banco & JSON-LD" no próprio site.
Operação de escrita ao vivo :
Clique em "+ Cadastrar Cidadão" , cadastre um novo prontuário na hora (ou clique em Editar / Excluir em um cartão) e mostre o registro aparecendo imediatamente na tela do site e na tabela cidadaoslá no painel do Supabase!
Como a aplicação conversa com o banco e Segurança contra SQL Injection :
A aplicação conversa com o banco PostgreSQL do Supabase via API RESTful (PostgREST) ​​usando cabeçalhos de autenticação ( apikeye Bearer token) e políticas de Row Level Security (RLS) no banco.
Todos os filtros e dados enviados em JSON pelo fetch()são transformados pelo PostgREST do Supabase em Consultas Parametrizadas ( Prepared Statementscom $1, $2...) no PostgreSQL, impedindo que qualquer texto digitado pelo usuário altere a estrutura do comando SQL (proteção total contra SQL Injection ).
