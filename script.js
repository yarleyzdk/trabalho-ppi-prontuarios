/**
 * ============================================================================
 * SCRIPT PRINCIPAL — SISTEMA DE CONSULTA DE CIDADÃO & PRONTUÁRIOS (CHECKPOINT 2)
 * ============================================================================
 * Suporta DOIS modos de Banco de Dados Real (Item 8):
 * 1. SUPABASE (PostgreSQL na Nuvem):
 *    Permite hospedar o site em qualquer lugar (GitHub Pages, Vercel, Netlify)
 *    ou abrir de qualquer computador/celular e ler/gravar dados na nuvem via
 *    API REST/PostgREST do Supabase (que utiliza Prepared Statements no PostgreSQL).
 * 2. SQLITE 3 LOCAL (`database.db` via `app.py` ou `server.js`):
 *    Funciona localmente sem precisar de internet ou conta externa.
 */

// --- ELEMENTOS DO DOM ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');
const dbCountBadge = document.getElementById('db-count-badge');
const activeDbLabel = document.getElementById('active-db-label');
const inspectorDbType = document.getElementById('inspector-db-type');

// Barra de ferramentas e seções
const btnListAll = document.getElementById('btn-list-all');
const btnToggleCrud = document.getElementById('btn-toggle-crud');
const btnCloseCrud = document.getElementById('btn-close-crud');
const btnToggleSupabase = document.getElementById('btn-toggle-supabase');
const btnCloseSupabase = document.getElementById('btn-close-supabase');
const btnDisconnectSupabase = document.getElementById('btn-disconnect-supabase');
const btnToggleInspector = document.getElementById('btn-toggle-inspector');
const btnRefreshInspector = document.getElementById('btn-refresh-inspector');

const supabaseSection = document.getElementById('supabase-section');
const supabaseForm = document.getElementById('supabase-form');
const supaUrlInput = document.getElementById('supa-url');
const supaKeyInput = document.getElementById('supa-key');

const crudSection = document.getElementById('crud-section');
const crudHeading = document.getElementById('crud-heading');
const crudForm = document.getElementById('crud-form');
const crudId = document.getElementById('crud-id');
const crudNome = document.getElementById('crud-nome');
const crudCpf = document.getElementById('crud-cpf');
const crudDtNasc = document.getElementById('crud-dtnasc');
const crudMatricula = document.getElementById('crud-matricula');
const crudOrigem = document.getElementById('crud-origem');
const crudMae = document.getElementById('crud-mae');
const crudPai = document.getElementById('crud-pai');
const crudLink = document.getElementById('crud-link');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnSaveCrud = document.getElementById('btn-save-crud');

const inspectorSection = document.getElementById('inspector-section');
const operationAlert = document.getElementById('operation-alert');

// Pesquisa
const searchForm = document.getElementById('search-form');
const searchOrigin = document.getElementById('search-origin');
const simpleSearchContainer = document.getElementById('simple-search-container');
const searchQuery = document.getElementById('search-query');
const simpleSearchBtnContainer = document.getElementById('simple-search-btn-container');

// Busca Avançada
const advancedSearchContainer = document.getElementById('advanced-search-container');
const btnToggleAdvanced = document.getElementById('toggle-advanced-btn');
const advNome = document.getElementById('adv-nome');
const advCpf = document.getElementById('adv-cpf');
const advDtNasc = document.getElementById('adv-dtnasc');
const advMatricula = document.getElementById('adv-matricula');
const advMae = document.getElementById('adv-mae');
const advPai = document.getElementById('adv-pai');

// Resultados e Feedback
const resultsSection = document.getElementById('results-section');
const resultsHeading = document.getElementById('results-heading');
const resultsList = document.getElementById('results-list');
const noResults = document.getElementById('no-results');
const searchFeedback = document.getElementById('search-feedback');

// Estado da aplicação
let isAdvancedMode = false;
let currentOperator = 'Operador';
let currentResultsCache = [];

// --- CONFIGURAÇÃO DO SUPABASE ---
function getSupabaseConfig() {
    const fromStorageUrl = localStorage.getItem('ppi_supabase_url') || '';
    const fromStorageKey = localStorage.getItem('ppi_supabase_key') || '';
    const fromFileUrl = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || '';
    const fromFileKey = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anonKey) || '';

    const url = (fromStorageUrl || fromFileUrl).trim().replace(/\/+$/, '');
    const key = (fromStorageKey || fromFileKey).trim();
    return {
        isConfigured: Boolean(url && key),
        url,
        key
    };
}

function atualizarIndicadorBanco() {
    const supa = getSupabaseConfig();
    if (supa.isConfigured) {
        if (activeDbLabel) activeDbLabel.innerText = 'Supabase (PostgreSQL na Nuvem)';
        if (inspectorDbType) inspectorDbType.innerText = 'Supabase PostgreSQL (Nuvem)';
        if (btnToggleSupabase) btnToggleSupabase.innerText = 'Supabase Conectado (Configurar)';
    } else {
        if (activeDbLabel) activeDbLabel.innerText = 'SQLite 3 Local (database.db)';
        if (inspectorDbType) inspectorDbType.innerText = 'SQLite 3 (database.db)';
        if (btnToggleSupabase) btnToggleSupabase.innerText = 'Conectar Supabase (Nuvem)';
    }
}

atualizarIndicadorBanco();

// --- FUNÇÕES UTILITÁRIAS E DE SEGURANÇA (PREVENÇÃO DE XSS) ---
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeText(text) {
    if (!text) return '';
    return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeCpf(cpf) {
    if (!cpf) return '';
    return String(cpf).replace(/\D/g, '');
}

function brDateToIso(dtBr) {
    if (!dtBr) return '';
    const parts = String(dtBr).trim().split('/');
    if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dtBr;
}

function formatarDataHoraBrasil(dataStr) {
    if (!dataStr) return '';
    const iso = dataStr.includes('T') || dataStr.includes('+') || dataStr.endsWith('Z')
        ? dataStr
        : dataStr.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return dataStr;
    return d.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function mapSupabaseRow(r) {
    return {
        id: r.id,
        nome: r.nome,
        cpf: r.cpf,
        dtNascimento: r.dt_nascimento,
        matricula: r.matricula,
        mae: r.mae,
        pai: r.pai,
        origem: r.origem,
        linkProcessoEDocs: r.link_processo_edocs,
        criadoEm: r.criado_em,
        atualizadoEm: r.atualizado_em
    };
}

// --- MÁSCARAS DE ENTRADA (CPF E DATA) ---
function applyCpfMask(inputElement) {
    inputElement.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        e.target.value = v;
    });
}

function applyDateMask(inputElement) {
    inputElement.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        v = v.replace(/(\d{2})(\d)/, '$1/$2');
        v = v.replace(/(\d{2})(\d)/, '$1/$2');
        e.target.value = v;
    });
}

applyCpfMask(advCpf);
applyCpfMask(crudCpf);
applyDateMask(advDtNasc);
applyDateMask(crudDtNasc);

// --- ITEM 7: GERAÇÃO DINÂMICA DE METADADOS, OPEN GRAPH E JSON-LD (SCHEMA.ORG) ---
function atualizarConteudoSemantico(cidadaos, contextoDescricao = 'Catálogo de Prontuários') {
    const baseUrl = window.location.origin.startsWith('http')
        ? window.location.origin
        : 'http://localhost:3000';

    let novoTitulo = '';
    let novaDescricao = '';

    if (cidadaos.length === 1) {
        const c = cidadaos[0];
        const origemLabel = c.origem === 'modulo' ? 'Módulo (Instrução Formativa)' : 'BPE (Banca de Exames Permanente)';
        novoTitulo = `Prontuário ${c.matricula} — ${c.nome} | Consulta de Prontuários`;
        novaDescricao = `Ficha e prontuário digital de ${c.nome} (CPF ${c.cpf}, Matrícula ${c.matricula}, Origem: ${origemLabel}) integrado ao SGBD e E-Docs/ES.`;
    } else {
        const nomesPreview = cidadaos.slice(0, 3).map((c) => c.nome).join(', ');
        novoTitulo = `${contextoDescricao} (${cidadaos.length} registros) | Consulta de Prontuários`;
        novaDescricao = cidadaos.length > 0
            ? `Listagem dinâmica gerada a partir do banco de dados com ${cidadaos.length} prontuário(s): ${nomesPreview}.`
            : `Consulta de prontuários no banco de dados sem registros para o filtro atual.`;
    }

    document.title = novoTitulo;
    const metaDesc = document.getElementById('dynamic-description');
    if (metaDesc) metaDesc.setAttribute('content', novaDescricao);

    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-description');
    const ogUrl = document.getElementById('og-url');
    const twTitle = document.getElementById('twitter-title');
    const twDesc = document.getElementById('twitter-description');

    if (ogTitle) ogTitle.setAttribute('content', novoTitulo);
    if (ogDesc) ogDesc.setAttribute('content', novaDescricao);
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);
    if (twTitle) twTitle.setAttribute('content', novoTitulo);
    if (twDesc) twDesc.setAttribute('content', novaDescricao);

    const jsonLdObject = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                '@id': `${baseUrl}/#website`,
                url: `${baseUrl}/`,
                name: 'Sistema de Consulta de Cidadão & Prontuários',
                description: novaDescricao,
                inLanguage: 'pt-BR'
            },
            {
                '@type': 'ItemList',
                '@id': `${baseUrl}/#itemlist`,
                name: contextoDescricao,
                numberOfItems: cidadaos.length,
                itemListElement: cidadaos.map((c, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    url: `${baseUrl}/prontuario.html?id=${c.id}`,
                    item: {
                        '@type': 'Person',
                        '@id': `${baseUrl}/prontuario.html?id=${c.id}#person`,
                        name: c.nome,
                        birthDate: brDateToIso(c.dtNascimento),
                        identifier: [
                            { '@type': 'PropertyValue', name: 'CPF', value: c.cpf },
                            { '@type': 'PropertyValue', name: 'Matrícula', value: c.matricula }
                        ],
                        parent: [
                            { '@type': 'Person', name: c.mae, description: 'Mãe' },
                            { '@type': 'Person', name: c.pai, description: 'Pai' }
                        ],
                        subjectOf: {
                            '@type': 'DigitalDocument',
                            name: `Prontuário Digital ${c.matricula} - ${c.nome}`,
                            url: c.linkProcessoEDocs,
                            genre: c.origem.toUpperCase()
                        }
                    }
                }))
            }
        ]
    };

    const jsonLdScript = document.getElementById('dynamic-jsonld');
    const jsonLdFormatted = JSON.stringify(jsonLdObject, null, 2);
    if (jsonLdScript) {
        jsonLdScript.textContent = jsonLdFormatted;
    }

    const liveMetaPreview = document.getElementById('live-meta-preview');
    const liveJsonLdPreview = document.getElementById('live-jsonld-preview');
    if (liveMetaPreview) {
        liveMetaPreview.textContent =
`<title>${novoTitulo}</title>
<meta name="description" content="${novaDescricao}">
<meta property="og:title" content="${novoTitulo}">
<meta property="og:description" content="${novaDescricao}">
<meta property="og:type" content="website">
<meta property="og:url" content="${baseUrl}/">`;
    }
    if (liveJsonLdPreview) {
        liveJsonLdPreview.textContent = jsonLdFormatted;
    }
}

// --- ALERTAS DE FEEDBACK DE OPERAÇÕES NO BANCO ---
function mostrarAlertaOperacao(mensagem, tipo = 'success') {
    const supa = getSupabaseConfig();
    const nomeBanco = supa.isConfigured ? 'Supabase (PostgreSQL)' : 'SQLite';
    operationAlert.className = `alert alert-${tipo}`;
    operationAlert.innerHTML = `<strong>${tipo === 'success' ? `Sucesso no ${nomeBanco}:` : 'Atenção:'}</strong> ${escapeHtml(mensagem)}`;
    operationAlert.classList.remove('hidden');
    setTimeout(() => {
        operationAlert.classList.add('hidden');
    }, 7000);
}

// --- AUTENTICAÇÃO (LOGIN / LOGOUT) ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    if (username !== '') {
        currentOperator = username;
        userDisplay.innerText = `Usuário: ${username}`;
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        atualizarIndicadorBanco();
        await carregarTodosDoBanco();
        await atualizarPainelInspecao();
    }
});

logoutBtn.addEventListener('click', () => {
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginForm.reset();
    resetSearchState();
});

// --- PAINEL DE CONFIGURAÇÃO DO SUPABASE ---
btnToggleSupabase.addEventListener('click', () => {
    const isHidden = supabaseSection.classList.contains('hidden');
    if (isHidden) {
        const cfg = getSupabaseConfig();
        supaUrlInput.value = cfg.url;
        supaKeyInput.value = cfg.key;
        supabaseSection.classList.remove('hidden');
        btnToggleSupabase.setAttribute('aria-expanded', 'true');
        supaUrlInput.focus();
    } else {
        supabaseSection.classList.add('hidden');
        btnToggleSupabase.setAttribute('aria-expanded', 'false');
    }
});

btnCloseSupabase.addEventListener('click', () => {
    supabaseSection.classList.add('hidden');
    btnToggleSupabase.setAttribute('aria-expanded', 'false');
});

supabaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = supaUrlInput.value.trim().replace(/\/+$/, '');
    const key = supaKeyInput.value.trim();
    if (!url || !key) {
        mostrarAlertaOperacao('Informe a Project URL e a Anon Public Key do Supabase.', 'warning');
        return;
    }
    localStorage.setItem('ppi_supabase_url', url);
    localStorage.setItem('ppi_supabase_key', key);
    atualizarIndicadorBanco();
    supabaseSection.classList.add('hidden');
    btnToggleSupabase.setAttribute('aria-expanded', 'false');
    mostrarAlertaOperacao('Conectado ao Supabase (PostgreSQL na Nuvem)! Carregando registros...', 'success');
    await carregarTodosDoBanco();
    await atualizarPainelInspecao();
});

btnDisconnectSupabase.addEventListener('click', async () => {
    localStorage.removeItem('ppi_supabase_url');
    localStorage.removeItem('ppi_supabase_key');
    atualizarIndicadorBanco();
    supabaseSection.classList.add('hidden');
    btnToggleSupabase.setAttribute('aria-expanded', 'false');
    mostrarAlertaOperacao('Alternado para o banco SQLite Local (database.db).', 'success');
    await carregarTodosDoBanco();
    await atualizarPainelInspecao();
});

// --- NAVEGAÇÃO ENTRE PAINÉIS (ACESSÍVEL POR TECLADO COM ARIA-EXPANDED) ---
btnToggleCrud.addEventListener('click', () => {
    const isHidden = crudSection.classList.contains('hidden');
    if (isHidden) {
        prepararFormularioNovoCadastro();
        crudSection.classList.remove('hidden');
        btnToggleCrud.setAttribute('aria-expanded', 'true');
        crudNome.focus();
    } else {
        fecharFormularioCrud();
    }
});

btnCloseCrud.addEventListener('click', fecharFormularioCrud);
btnCancelEdit.addEventListener('click', fecharFormularioCrud);

function fecharFormularioCrud() {
    crudSection.classList.add('hidden');
    btnToggleCrud.setAttribute('aria-expanded', 'false');
    crudForm.reset();
    crudId.value = '';
    crudLink.value = 'https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS';
    crudHeading.innerText = 'Cadastrar Novo Cidadão no Banco de Dados';
    btnSaveCrud.innerText = 'Salvar no Banco';
    btnCancelEdit.classList.add('hidden');
}

function prepararFormularioNovoCadastro() {
    crudForm.reset();
    crudId.value = '';
    crudLink.value = 'https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS';
    crudHeading.innerText = 'Cadastrar Novo Cidadão no Banco de Dados (INSERT)';
    btnSaveCrud.innerText = 'Cadastrar no Banco';
    btnCancelEdit.classList.add('hidden');
}

btnToggleInspector.addEventListener('click', async () => {
    const isHidden = inspectorSection.classList.contains('hidden');
    if (isHidden) {
        await atualizarPainelInspecao();
        inspectorSection.classList.remove('hidden');
        btnToggleInspector.setAttribute('aria-expanded', 'true');
        inspectorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        inspectorSection.classList.add('hidden');
        btnToggleInspector.setAttribute('aria-expanded', 'false');
    }
});

btnRefreshInspector.addEventListener('click', atualizarPainelInspecao);

btnListAll.addEventListener('click', async () => {
    searchOrigin.value = 'todas';
    searchQuery.value = '';
    await carregarTodosDoBanco();
});

// --- ALTERNAR BUSCA SIMPLES / AVANÇADA ---
btnToggleAdvanced.addEventListener('click', () => {
    isAdvancedMode = !isAdvancedMode;
    btnToggleAdvanced.setAttribute('aria-expanded', String(isAdvancedMode));
    if (isAdvancedMode) {
        advancedSearchContainer.classList.remove('hidden');
        simpleSearchContainer.classList.add('hidden');
        btnToggleAdvanced.innerText = 'Voltar para Busca Simples';
        btnToggleAdvanced.classList.replace('btn-secondary', 'btn-primary');
        simpleSearchBtnContainer.classList.add('hidden');
        searchQuery.value = '';
        advNome.focus();
    } else {
        advancedSearchContainer.classList.add('hidden');
        simpleSearchContainer.classList.remove('hidden');
        btnToggleAdvanced.innerText = 'Busca Avançada';
        btnToggleAdvanced.classList.replace('btn-primary', 'btn-secondary');
        simpleSearchBtnContainer.classList.remove('hidden');
        advNome.value = '';
        advCpf.value = '';
        advDtNasc.value = '';
        advMatricula.value = '';
        advMae.value = '';
        advPai.value = '';
        searchQuery.focus();
    }
});

// --- ITEM 8: COMUNICAÇÃO COM O BANCO DE DADOS (SUPABASE NUVEM OU SQLITE LOCAL) ---

async function supabaseFetch(endpoint, options = {}) {
    const supa = getSupabaseConfig();
    const headers = {
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    return fetch(`${supa.url}/rest/v1/${endpoint}`, {
        ...options,
        headers
    });
}

async function registrarLogSupabase(acao, nome, matricula, detalhes) {
    try {
        await supabaseFetch('logs_operacoes', {
            method: 'POST',
            body: JSON.stringify({
                acao,
                cidadao_nome: nome,
                cidadao_matricula: matricula,
                operador: currentOperator,
                detalhes
            })
        });
    } catch (e) {
        // Silencioso
    }
}

async function carregarTodosDoBanco() {
    const supa = getSupabaseConfig();

    if (supa.isConfigured) {
        try {
            const resp = await supabaseFetch('cidadaos?select=*&order=id.desc');
            if (!resp.ok) throw new Error('Falha ao consultar tabela cidadaos no Supabase.');
            const rows = await resp.json();
            const dados = rows.map(mapSupabaseRow);
            currentResultsCache = dados;
            if (dbCountBadge) dbCountBadge.innerText = dados.length;
            atualizarSqlPreview(
                'SELECT * FROM public.cidadaos ORDER BY id DESC; -- via Supabase PostgREST API',
                []
            );
            exibirResultados(
                dados,
                ['Banco: <strong>SUPABASE (PostgreSQL na Nuvem)</strong>', 'Listagem Completa'],
                'Todos os Prontuários Cadastrados no Supabase'
            );
            return;
        } catch (err) {
            mostrarAlertaOperacao(
                'Erro ao conectar no Supabase. Verifique se você executou o arquivo supabase_schema.sql no SQL Editor e se a URL/Key estão corretas.',
                'warning'
            );
            return;
        }
    }

    // Modo SQLite Local (/api/cidadaos)
    try {
        const resp = await fetch('/api/cidadaos');
        const json = await resp.json();
        if (json.sucesso) {
            currentResultsCache = json.dados;
            if (dbCountBadge) dbCountBadge.innerText = json.total;
            atualizarSqlPreview(json.consultaParametrizada, json.parametrosSeguros);
            exibirResultados(
                json.dados,
                ['Origem: <strong>TODAS (MÓDULO + BPE)</strong>', 'Listagem Completa do Banco SQLite'],
                'Todos os Prontuários Cadastrados no SQLite'
            );
        }
    } catch (err) {
        mostrarAlertaOperacao(
            'Para usar offline, inicie "iniciar_servidor.bat" (SQLite) ou clique em "Conectar Supabase (Nuvem)" para usar o banco online.',
            'warning'
        );
    }
}

// 1. PESQUISA PARAMETRIZADA NO BANCO (SUPABASE OU SQLITE)
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetSearchState();

    const supa = getSupabaseConfig();
    const originValue = searchOrigin.value;
    const feedbackTextArray = [
        `Origem: <strong>${originValue === 'todas' ? 'TODAS' : escapeHtml(originValue.toUpperCase())}</strong>`
    ];

    if (supa.isConfigured) {
        try {
            let queryParts = ['select=*', 'order=id.desc'];
            const sqlParams = [];
            if (originValue !== 'todas') {
                queryParts.push(`origem=eq.${encodeURIComponent(originValue)}`);
                sqlParams.push(originValue);
            }

            const resp = await supabaseFetch(`cidadaos?${queryParts.join('&')}`);
            const rows = await resp.json();
            let results = (Array.isArray(rows) ? rows : []).map(mapSupabaseRow);

            if (!isAdvancedMode) {
                const q = searchQuery.value.trim();
                if (q) {
                    feedbackTextArray.push(`Termo: '${escapeHtml(q)}'`);
                    sqlParams.push(`%${q}%`);
                    const nq = normalizeText(q);
                    const ncpf = normalizeCpf(q);
                    results = results.filter((c) =>
                        normalizeText(c.nome).includes(nq) ||
                        normalizeText(c.matricula).includes(nq) ||
                        (ncpf && normalizeCpf(c.cpf).includes(ncpf))
                    );
                }
            } else {
                const nome = advNome.value.trim();
                const cpf = advCpf.value.trim();
                const dtNasc = advDtNasc.value.trim();
                const matricula = advMatricula.value.trim();
                const mae = advMae.value.trim();
                const pai = advPai.value.trim();

                if (nome) { feedbackTextArray.push(`Nome: '${escapeHtml(nome)}'`); sqlParams.push(nome); results = results.filter(c => normalizeText(c.nome).includes(normalizeText(nome))); }
                if (cpf) { feedbackTextArray.push(`CPF: '${escapeHtml(cpf)}'`); sqlParams.push(cpf); results = results.filter(c => normalizeCpf(c.cpf).includes(normalizeCpf(cpf))); }
                if (dtNasc) { feedbackTextArray.push(`Nascimento: '${escapeHtml(dtNasc)}'`); sqlParams.push(dtNasc); results = results.filter(c => c.dtNascimento === dtNasc); }
                if (matricula) { feedbackTextArray.push(`Matrícula: '${escapeHtml(matricula)}'`); sqlParams.push(matricula); results = results.filter(c => normalizeText(c.matricula).includes(normalizeText(matricula))); }
                if (mae) { feedbackTextArray.push(`Mãe: '${escapeHtml(mae)}'`); sqlParams.push(mae); results = results.filter(c => normalizeText(c.mae).includes(normalizeText(mae))); }
                if (pai) { feedbackTextArray.push(`Pai: '${escapeHtml(pai)}'`); sqlParams.push(pai); results = results.filter(c => normalizeText(c.pai).includes(normalizeText(pai))); }
            }

            currentResultsCache = results;
            atualizarSqlPreview(
                'SELECT * FROM public.cidadaos WHERE ($1::text IS NULL OR origem = $1) AND ... ORDER BY id DESC',
                sqlParams
            );
            exibirResultados(results, feedbackTextArray, 'Resultado da Pesquisa no Supabase');
            return;
        } catch (err) {
            mostrarAlertaOperacao('Erro ao pesquisar no Supabase.', 'warning');
            return;
        }
    }

    // Modo SQLite Local
    const params = new URLSearchParams();
    if (originValue !== 'todas') {
        params.set('origem', originValue);
    }

    if (!isAdvancedMode) {
        const query = searchQuery.value.trim();
        if (query) {
            params.set('q', query);
            feedbackTextArray.push(`Termo: '${escapeHtml(query)}'`);
        } else {
            feedbackTextArray.push('Todos os registros da origem selecionada');
        }
    } else {
        const nome = advNome.value.trim();
        const cpf = advCpf.value.trim();
        const dtNasc = advDtNasc.value.trim();
        const matricula = advMatricula.value.trim();
        const mae = advMae.value.trim();
        const pai = advPai.value.trim();

        if (!nome && !cpf && !dtNasc && !matricula && !mae && !pai && originValue === 'todas') {
            mostrarAlertaOperacao('Preencha ao menos um campo para filtrar na Busca Avançada.', 'warning');
            return;
        }

        if (nome) { params.set('nome', nome); feedbackTextArray.push(`Nome: '${escapeHtml(nome)}'`); }
        if (cpf) { params.set('cpf', cpf); feedbackTextArray.push(`CPF: '${escapeHtml(cpf)}'`); }
        if (dtNasc) { params.set('dtNascimento', dtNasc); feedbackTextArray.push(`Nascimento: '${escapeHtml(dtNasc)}'`); }
        if (matricula) { params.set('matricula', matricula); feedbackTextArray.push(`Matrícula: '${escapeHtml(matricula)}'`); }
        if (mae) { params.set('mae', mae); feedbackTextArray.push(`Mãe: '${escapeHtml(mae)}'`); }
        if (pai) { params.set('pai', pai); feedbackTextArray.push(`Pai: '${escapeHtml(pai)}'`); }
    }

    try {
        const resp = await fetch(`/api/cidadaos?${params.toString()}`);
        const json = await resp.json();
        if (json.sucesso) {
            currentResultsCache = json.dados;
            atualizarSqlPreview(json.consultaParametrizada, json.parametrosSeguros);
            exibirResultados(json.dados, feedbackTextArray, 'Resultado da Pesquisa de Prontuários');
        }
    } catch (err) {
        mostrarAlertaOperacao('Erro ao consultar o banco de dados.', 'warning');
    }
});

// 2. OPERAÇÕES DE ESCRITA NO BANCO: CADASTRAR (POST) E ALTERAR (PUT/PATCH)
crudForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const supa = getSupabaseConfig();
    const idEdicao = crudId.value.trim();
    const payload = {
        nome: crudNome.value.trim().toUpperCase(),
        cpf: crudCpf.value.trim(),
        dtNascimento: crudDtNasc.value.trim(),
        matricula: crudMatricula.value.trim().toUpperCase(),
        origem: crudOrigem.value.toLowerCase(),
        mae: crudMae.value.trim().toUpperCase(),
        pai: crudPai.value.trim().toUpperCase(),
        linkProcessoEDocs: crudLink.value.trim() || 'https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS',
        operador: currentOperator
    };

    if (supa.isConfigured) {
        const supaBody = {
            nome: payload.nome,
            cpf: payload.cpf,
            dt_nascimento: payload.dtNascimento,
            matricula: payload.matricula,
            origem: payload.origem,
            mae: payload.mae,
            pai: payload.pai,
            link_processo_edocs: payload.linkProcessoEDocs,
            atualizado_em: new Date().toISOString()
        };

        try {
            const endpoint = idEdicao ? `cidadaos?id=eq.${encodeURIComponent(idEdicao)}` : 'cidadaos';
            const method = idEdicao ? 'PATCH' : 'POST';
            const resp = await supabaseFetch(endpoint, {
                method,
                headers: { Prefer: 'return=representation' },
                body: JSON.stringify(supaBody)
            });

            if (!resp.ok) {
                const errObj = await resp.json().catch(() => ({}));
                mostrarAlertaOperacao(errObj.message || 'Erro ao gravar no Supabase (verifique se CPF ou Matrícula já existe).', 'warning');
                return;
            }

            await registrarLogSupabase(
                idEdicao ? 'ALTERACAO' : 'CADASTRO',
                payload.nome,
                payload.matricula,
                idEdicao
                    ? `Registro ID #${idEdicao} atualizado no Supabase PostgreSQL`
                    : `Novo prontuário cadastrado no Supabase (${payload.origem.toUpperCase()})`
            );

            atualizarSqlPreview(
                idEdicao
                    ? 'UPDATE public.cidadaos SET nome=$1, cpf=$2, dt_nascimento=$3, matricula=$4, mae=$5, pai=$6, origem=$7 WHERE id=$8'
                    : 'INSERT INTO public.cidadaos (nome, cpf, dt_nascimento, matricula, mae, pai, origem, link_processo_edocs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [payload.nome, payload.cpf, payload.dtNascimento, payload.matricula, payload.mae, payload.pai, payload.origem]
            );

            mostrarAlertaOperacao(
                idEdicao
                    ? `Prontuário de '${payload.nome}' atualizado na nuvem (Supabase)!`
                    : `Cidadão '${payload.nome}' cadastrado na nuvem (Supabase)!`,
                'success'
            );
            fecharFormularioCrud();
            await carregarTodosDoBanco();
            await atualizarPainelInspecao();
            return;
        } catch (err) {
            mostrarAlertaOperacao('Falha de rede ao gravar no Supabase.', 'warning');
            return;
        }
    }

    // Modo SQLite Local
    const url = idEdicao ? `/api/cidadaos/${idEdicao}` : '/api/cidadaos';
    const method = idEdicao ? 'PUT' : 'POST';

    try {
        const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await resp.json();

        if (!resp.ok || !json.sucesso) {
            mostrarAlertaOperacao(json.erro || 'Erro ao gravar registro no banco SQLite.', 'warning');
            return;
        }

        mostrarAlertaOperacao(json.mensagem, 'success');
        fecharFormularioCrud();
        await carregarTodosDoBanco();
        await atualizarPainelInspecao();
    } catch (err) {
        mostrarAlertaOperacao('Erro de comunicação ao salvar no banco de dados.', 'warning');
    }
});

// 3. PREPARAR EDIÇÃO DE UM REGISTRO EXISTENTE (UPDATE)
window.iniciarEdicaoCidadao = function (id) {
    const cidadao = currentResultsCache.find((c) => Number(c.id) === Number(id));
    if (!cidadao) return;

    crudId.value = cidadao.id;
    crudNome.value = cidadao.nome;
    crudCpf.value = cidadao.cpf;
    crudDtNasc.value = cidadao.dtNascimento;
    crudMatricula.value = cidadao.matricula;
    crudOrigem.value = cidadao.origem;
    crudMae.value = cidadao.mae;
    crudPai.value = cidadao.pai;
    crudLink.value = cidadao.linkProcessoEDocs;

    crudHeading.innerText = `Alterar Prontuário ID #${cidadao.id} no Banco de Dados (UPDATE)`;
    btnSaveCrud.innerText = 'Salvar Alterações (UPDATE)';
    btnCancelEdit.classList.remove('hidden');
    crudSection.classList.remove('hidden');
    btnToggleCrud.setAttribute('aria-expanded', 'true');
    crudSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    crudNome.focus();
};

// 4. EXCLUIR REGISTRO DO BANCO DE DADOS (DELETE)
window.excluirCidadaoDoBanco = async function (id, nome) {
    const confirmar = window.confirm(
        `Confirma a EXCLUSÃO permanente do prontuário de "${nome}" (ID #${id}) no banco de dados?`
    );
    if (!confirmar) return;

    const supa = getSupabaseConfig();
    if (supa.isConfigured) {
        try {
            const c = currentResultsCache.find((x) => Number(x.id) === Number(id));
            const resp = await supabaseFetch(`cidadaos?id=eq.${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            if (resp.ok) {
                await registrarLogSupabase(
                    'EXCLUSAO',
                    nome,
                    c ? c.matricula : 'N/A',
                    `Registro ID #${id} excluído do Supabase PostgreSQL`
                );
                atualizarSqlPreview('DELETE FROM public.cidadaos WHERE id = $1', [id]);
                mostrarAlertaOperacao(`Prontuário de '${nome}' excluído do Supabase!`, 'success');
                await carregarTodosDoBanco();
                await atualizarPainelInspecao();
            } else {
                mostrarAlertaOperacao('Não foi possível excluir o registro no Supabase.', 'warning');
            }
            return;
        } catch (err) {
            mostrarAlertaOperacao('Erro ao executar DELETE no Supabase.', 'warning');
            return;
        }
    }

    try {
        const resp = await fetch(`/api/cidadaos/${id}`, { method: 'DELETE' });
        const json = await resp.json();
        if (resp.ok && json.sucesso) {
            mostrarAlertaOperacao(json.mensagem, 'success');
            await carregarTodosDoBanco();
            await atualizarPainelInspecao();
        } else {
            mostrarAlertaOperacao(json.erro || 'Não foi possível excluir o registro.', 'warning');
        }
    } catch (err) {
        mostrarAlertaOperacao('Erro ao executar DELETE no banco de dados.', 'warning');
    }
};

// --- RENDERIZAÇÃO SEMÂNTICA DOS RESULTADOS (ITEM 7) ---
function exibirResultados(resultados, feedbacks, tituloContexto = 'Resultados da Consulta') {
    const supa = getSupabaseConfig();
    const labelBanco = supa.isConfigured ? 'Supabase (PostgreSQL)' : 'SQLite';
    searchFeedback.innerHTML = `<strong>Consulta executada no ${labelBanco}:</strong> ${feedbacks.join(' + ')} &bull; <strong>${resultados.length}</strong> registro(s) retornado(s).`;
    searchFeedback.classList.remove('hidden');

    atualizarConteudoSemantico(resultados, tituloContexto);

    if (resultados.length === 0) {
        resultsSection.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }

    noResults.classList.add('hidden');
    resultsList.innerHTML = '';
    resultsHeading.innerText = `${tituloContexto} (${resultados.length})`;

    resultados.forEach((citizen) => {
        const isoBirth = brDateToIso(citizen.dtNascimento);
        const origemLabel = citizen.origem === 'modulo'
            ? 'MÓDULO (Instrução Formativa)'
            : 'BPE (Banca de Exames Permanente)';

        const semanticPageHref = supa.isConfigured
            ? `prontuario.html?id=${citizen.id}`
            : `/prontuario/${citizen.id}`;

        const cardHTML = `
            <article class="card result-card" itemscope itemtype="https://schema.org/Person" aria-labelledby="citizen-heading-${citizen.id}">
                <header class="result-header">
                    <div>
                        <h3 id="citizen-heading-${citizen.id}" itemprop="name">${escapeHtml(citizen.nome)}</h3>
                        <span class="record-meta">ID no Banco (${labelBanco}): <strong>#${citizen.id}</strong> &bull; Matrícula: <strong itemprop="identifier">${escapeHtml(citizen.matricula)}</strong></span>
                    </div>
                    <span class="badge">${escapeHtml(origemLabel)}</span>
                </header>

                <dl class="info-grid">
                    <div class="info-item">
                        <dt class="label">Nome Completo</dt>
                        <dd class="value" itemprop="name">${escapeHtml(citizen.nome)}</dd>
                    </div>
                    <div class="info-item">
                        <dt class="label">CPF</dt>
                        <dd class="value" itemprop="taxID">${escapeHtml(citizen.cpf)}</dd>
                    </div>
                    <div class="info-item">
                        <dt class="label">Data de Nascimento</dt>
                        <dd class="value"><time datetime="${escapeHtml(isoBirth)}" itemprop="birthDate">${escapeHtml(citizen.dtNascimento)}</time></dd>
                    </div>
                    <div class="info-item">
                        <dt class="label">Matrícula</dt>
                        <dd class="value" itemprop="identifier">${escapeHtml(citizen.matricula)}</dd>
                    </div>
                    <div class="info-item">
                        <dt class="label">Nome da Mãe</dt>
                        <dd class="value" itemprop="parent">${escapeHtml(citizen.mae)}</dd>
                    </div>
                    <div class="info-item">
                        <dt class="label">Nome do Pai</dt>
                        <dd class="value" itemprop="parent">${escapeHtml(citizen.pai)}</dd>
                    </div>
                </dl>

                <footer class="action-area action-area-split">
                    <div class="crud-card-actions">
                        <a href="${semanticPageHref}" class="btn btn-outline btn-sm" title="Abre a página individual semântica do prontuário">
                            Ver Página Semântica
                        </a>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="iniciarEdicaoCidadao(${citizen.id})" aria-label="Editar prontuário de ${escapeHtml(citizen.nome)}">
                            Editar (UPDATE)
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="excluirCidadaoDoBanco(${citizen.id}, '${escapeHtml(citizen.nome)}')" aria-label="Excluir prontuário de ${escapeHtml(citizen.nome)}">
                            Excluir (DELETE)
                        </button>
                    </div>

                    <a href="${escapeHtml(citizen.linkProcessoEDocs)}" target="_blank" rel="noopener noreferrer" itemprop="url" class="btn btn-success btn-icon-link">
                        <img src="img/e-docs-logo-transparent-small.png" alt="Ícone do sistema E-Docs do Governo do Espírito Santo" width="26" height="26">
                        <span>ACESSAR PRONTUÁRIO E-DOCS</span>
                    </a>
                </footer>
            </article>
        `;
        resultsList.insertAdjacentHTML('beforeend', cardHTML);
    });

    resultsSection.classList.remove('hidden');
}

function atualizarSqlPreview(sql, params) {
    const el = document.getElementById('last-sql-query');
    if (!el || !sql) return;
    el.textContent = `-- Comando Parametrizado no Banco:\n${sql}\n\n-- Parâmetros Seguros (isolados contra SQL Injection):\n${JSON.stringify(params || [])}`;
}

async function atualizarPainelInspecao() {
    const supa = getSupabaseConfig();
    if (supa.isConfigured) {
        const schemaTbody = document.querySelector('#schema-table tbody');
        if (schemaTbody) {
            const pgCols = [
                { name: 'id', type: 'BIGINT IDENTITY', notnull: true, pk: true },
                { name: 'nome', type: 'TEXT', notnull: true, pk: false },
                { name: 'cpf', type: 'TEXT UNIQUE', notnull: true, pk: false },
                { name: 'dt_nascimento', type: 'TEXT', notnull: true, pk: false },
                { name: 'matricula', type: 'TEXT UNIQUE', notnull: true, pk: false },
                { name: 'mae', type: 'TEXT', notnull: true, pk: false },
                { name: 'pai', type: 'TEXT', notnull: true, pk: false },
                { name: 'origem', type: 'TEXT (modulo|bpe)', notnull: true, pk: false },
                { name: 'link_processo_edocs', type: 'TEXT', notnull: true, pk: false }
            ];
            schemaTbody.innerHTML = pgCols.map(col => `
                <tr>
                    <td><code>${col.name}</code></td>
                    <td>${col.type}</td>
                    <td>${col.notnull ? 'Sim (NOT NULL)' : 'Não'}</td>
                    <td>${col.pk ? 'Sim (PRIMARY KEY)' : '-'}</td>
                </tr>
            `).join('');
        }

        try {
            const resp = await supabaseFetch('logs_operacoes?select=*&order=id.desc&limit=15');
            if (resp.ok) {
                const logs = await resp.json();
                const logsTbody = document.querySelector('#logs-table tbody');
                if (logsTbody && Array.isArray(logs)) {
                    logsTbody.innerHTML = logs.map(log => `
                        <tr>
                            <td>#${log.id}</td>
                            <td><span class="badge badge-${String(log.acao || '').toLowerCase()}">${escapeHtml(log.acao)}</span></td>
                            <td>${escapeHtml(log.cidadao_nome)}</td>
                            <td><code>${escapeHtml(log.cidadao_matricula)}</code></td>
                            <td>${escapeHtml(log.detalhes || '')}</td>
                            <td>${escapeHtml(formatarDataHoraBrasil(log.data_hora))}</td>
                        </tr>
                    `).join('');
                }
            }
        } catch (e) {
            // Silencioso
        }
        return;
    }

    try {
        const resp = await fetch('/api/db-info');
        const json = await resp.json();
        if (!json.sucesso) return;

        if (dbCountBadge) {
            dbCountBadge.innerText = json.tabelas.cidadaos.totalRegistros;
        }

        const schemaTbody = document.querySelector('#schema-table tbody');
        if (schemaTbody) {
            schemaTbody.innerHTML = json.tabelas.cidadaos.colunas
                .map(
                    (col) => `
                <tr>
                    <td><code>${escapeHtml(col.name)}</code></td>
                    <td>${escapeHtml(col.type)}</td>
                    <td>${col.notnull ? 'Sim (NOT NULL)' : 'Não'}</td>
                    <td>${col.pk ? 'Sim (PRIMARY KEY)' : '-'}</td>
                </tr>`
                )
                .join('');
        }

        const logsTbody = document.querySelector('#logs-table tbody');
        if (logsTbody) {
            logsTbody.innerHTML = json.tabelas.logs_operacoes.ultimosLogs
                .map(
                    (log) => `
                <tr>
                    <td>#${log.id}</td>
                    <td><span class="badge badge-${log.acao.toLowerCase()}">${escapeHtml(log.acao)}</span></td>
                    <td>${escapeHtml(log.cidadao_nome)}</td>
                    <td><code>${escapeHtml(log.cidadao_matricula)}</code></td>
                    <td>${escapeHtml(log.detalhes || '')}</td>
                    <td>${escapeHtml(formatarDataHoraBrasil(log.data_hora))}</td>
                </tr>`
                )
                .join('');
        }
    } catch (e) {
        // Silencioso caso offline
    }
}

function resetSearchState() {
    resultsSection.classList.add('hidden');
    resultsList.innerHTML = '';
    noResults.classList.add('hidden');
    searchFeedback.classList.add('hidden');
}
