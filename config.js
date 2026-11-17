/**
 * ============================================================================
 * CONFIGURAÇÃO DO SUPABASE (BANCO DE DADOS POSTGRESQL NA NUVEM)
 * ============================================================================
 * Para acessar o site de qualquer lugar (GitHub Pages, Vercel, Netlify ou outro PC)
 * salvando tudo na nuvem:
 * 1. Crie um projeto gratuito em https://supabase.com
 * 2. Rode o arquivo `supabase_schema.sql` no SQL Editor do Supabase.
 * 3. Vá em Project Settings -> API no Supabase e copie:
 *    - Project URL (ex.: https://xyzcompany.supabase.co)
 *    - Project API Key (anon / public)
 * 4. Cole os valores abaixo (ou configure diretamente pelo botão "Configurar Supabase" na tela do sistema).
 */

window.SUPABASE_CONFIG = {
    // Cole aqui a URL do seu projeto Supabase (ou deixe vazio para usar o que for salvo na tela / SQLite local)
    url: "https://hyzqecbemuzdgiakzpyu.supabase.co/",

    // Cole aqui a sua chave pública "anon public" do Supabase
    anonKey: "sb_publishable_jUcBSuzmFoML4etTOQ6KAw_R9hBpQnO"
};
