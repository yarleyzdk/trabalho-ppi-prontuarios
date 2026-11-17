/**
 * Alternativa em Node.js (Express + SQLite3) para o Backend do Checkpoint 2.
 * Observação: O projeto também inclui `app.py` (Python 3 + sqlite3 nativo),
 * que roda sem precisar instalar pacotes externos (`python app.py`).
 * Ambos utilizam exatamente o mesmo banco `database.db` e `schema.sql`.
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

app.use(express.json());

// Inicializa o banco SQLite
const db = new sqlite3.Database(DB_PATH);
const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schemaSql);

function normalizeText(str) {
    if (!str) return '';
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeCpf(str) {
    if (!str) return '';
    return String(str).replace(/\D/g, '');
}

function brDateToIso(dtBr) {
    if (!dtBr) return '';
    const parts = String(dtBr).trim().split('/');
    if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dtBr;
}

function rowToDict(r) {
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

// Rota Principal com SSR de Metadados, Open Graph e JSON-LD
app.get(['/', '/index.html'], (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    db.all('SELECT * FROM cidadaos ORDER BY id ASC', [], (err, rows) => {
        const citizens = (rows || []).map(rowToDict);
        const total = citizens.length;
        const preview = citizens.slice(0, 3).map(c => c.nome).join(', ');
        const title = `Sistema de Consulta de Cidadão & Prontuários (${total} Registros no Banco)`;
        const desc = `Sistema institucional integrado ao SQLite e E-Docs/ES com ${total} prontuários cadastrados (${preview}).`;

        const jsonLd = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'WebSite',
                    '@id': `${baseUrl}/#website`,
                    url: `${baseUrl}/`,
                    name: 'Sistema de Consulta de Cidadão & Prontuários',
                    description: desc,
                    inLanguage: 'pt-BR'
                },
                {
                    '@type': 'ItemList',
                    '@id': `${baseUrl}/#itemlist`,
                    name: 'Prontuários Cadastrados no Banco de Dados SQLite',
                    numberOfItems: total,
                    itemListElement: citizens.map((c, i) => ({
                        '@type': 'ListItem',
                        position: i + 1,
                        url: `${baseUrl}/prontuario/${c.id}`,
                        item: {
                            '@type': 'Person',
                            name: c.nome,
                            birthDate: brDateToIso(c.dtNascimento),
                            identifier: c.matricula
                        }
                    }))
                }
            ]
        };

        let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        html = html.replace(/\{\{SSR_TITLE\}\}/g, title)
                   .replace(/\{\{SSR_DESCRIPTION\}\}/g, desc)
                   .replace(/\{\{SSR_OG_URL\}\}/g, `${baseUrl}/`)
                   .replace(/\{\{SSR_OG_IMAGE\}\}/g, `${baseUrl}/img/logo-trabalhoPPI.png`)
                   .replace(/\{\{SSR_JSONLD\}\}/g, JSON.stringify(jsonLd, null, 2))
                   .replace(/\{\{SSR_TOTAL_REGISTROS\}\}/g, String(total));
        res.type('html').send(html);
    });
});

// API: Listar e Pesquisar Cidadãos (Consulta Parametrizada com ?)
app.get('/api/cidadaos', (req, res) => {
    const { origem, q, nome, cpf, dtNascimento, matricula, mae, pai } = req.query;
    let sql = 'SELECT * FROM cidadaos WHERE 1=1';
    const params = [];

    if (origem) {
        sql += ' AND origem = ?';
        params.push(origem);
    }
    if (dtNascimento) {
        sql += ' AND dt_nascimento = ?';
        params.push(dtNascimento);
    }
    sql += ' ORDER BY id DESC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ sucesso: false, erro: err.message });
        let results = (rows || []).map(rowToDict);

        if (q) {
            const nq = normalizeText(q);
            const ncpf = normalizeCpf(q);
            results = results.filter(c =>
                normalizeText(c.nome).includes(nq) ||
                normalizeText(c.matricula).includes(nq) ||
                (ncpf && normalizeCpf(c.cpf).includes(ncpf))
            );
        } else {
            if (nome) results = results.filter(c => normalizeText(c.nome).includes(normalizeText(nome)));
            if (cpf) results = results.filter(c => normalizeCpf(c.cpf).includes(normalizeCpf(cpf)));
            if (matricula) results = results.filter(c => normalizeText(c.matricula).includes(normalizeText(matricula)));
            if (mae) results = results.filter(c => normalizeText(c.mae).includes(normalizeText(mae)));
            if (pai) results = results.filter(c => normalizeText(c.pai).includes(normalizeText(pai)));
        }

        res.json({
            sucesso: true,
            total: results.length,
            consultaParametrizada: sql,
            parametrosSeguros: params,
            dados: results
        });
    });
});

// API: Cadastrar Cidadão (INSERT Parametrizado com ?)
app.post('/api/cidadaos', (req, res) => {
    const { nome, cpf, dtNascimento, matricula, mae, pai, origem, linkProcessoEDocs, operador } = req.body;
    const sql = `INSERT INTO cidadaos (nome, cpf, dt_nascimento, matricula, mae, pai, origem, link_processo_edocs)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        String(nome || '').toUpperCase().trim(),
        String(cpf || '').trim(),
        String(dtNascimento || '').trim(),
        String(matricula || '').toUpperCase().trim(),
        String(mae || '').toUpperCase().trim(),
        String(pai || '').toUpperCase().trim(),
        String(origem || 'modulo').toLowerCase().trim(),
        String(linkProcessoEDocs || 'https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS').trim()
    ];

    db.run(sql, params, function (err) {
        if (err) return res.status(409).json({ sucesso: false, erro: 'CPF ou Matrícula já cadastrados no banco.' });
        const newId = this.lastID;
        db.run(
            `INSERT INTO logs_operacoes (acao, cidadao_nome, cidadao_matricula, operador, detalhes) VALUES (?, ?, ?, ?, ?)`,
            ['CADASTRO', params[0], params[3], operador || 'Operador', `Cadastrado na origem ${params[6].toUpperCase()}`]
        );
        db.get('SELECT * FROM cidadaos WHERE id = ?', [newId], (e2, row) => {
            res.status(201).json({
                sucesso: true,
                mensagem: `Cidadão '${params[0]}' cadastrado com sucesso no SQLite!`,
                dados: rowToDict(row)
            });
        });
    });
});

// API: Alterar Cidadão (UPDATE Parametrizado com ?)
app.put('/api/cidadaos/:id', (req, res) => {
    const cidId = Number(req.params.id);
    const { nome, cpf, dtNascimento, matricula, mae, pai, origem, linkProcessoEDocs, operador } = req.body;
    const sql = `UPDATE cidadaos
                 SET nome = ?, cpf = ?, dt_nascimento = ?, matricula = ?, mae = ?, pai = ?, origem = ?, link_processo_edocs = ?, atualizado_em = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    const params = [
        String(nome || '').toUpperCase().trim(),
        String(cpf || '').trim(),
        String(dtNascimento || '').trim(),
        String(matricula || '').toUpperCase().trim(),
        String(mae || '').toUpperCase().trim(),
        String(pai || '').toUpperCase().trim(),
        String(origem || 'modulo').toLowerCase().trim(),
        String(linkProcessoEDocs || '').trim(),
        cidId
    ];

    db.run(sql, params, function (err) {
        if (err) return res.status(409).json({ sucesso: false, erro: 'Erro ao atualizar registro no SQLite.' });
        db.run(
            `INSERT INTO logs_operacoes (acao, cidadao_nome, cidadao_matricula, operador, detalhes) VALUES (?, ?, ?, ?, ?)`,
            ['ALTERACAO', params[0], params[3], operador || 'Operador', `Registro ID #${cidId} alterado no SQLite`]
        );
        db.get('SELECT * FROM cidadaos WHERE id = ?', [cidId], (e2, row) => {
            res.json({
                sucesso: true,
                mensagem: `Prontuário de '${params[0]}' atualizado com sucesso no SQLite!`,
                dados: rowToDict(row)
            });
        });
    });
});

// API: Excluir Cidadão (DELETE Parametrizado com ?)
app.delete('/api/cidadaos/:id', (req, res) => {
    const cidId = Number(req.params.id);
    db.get('SELECT * FROM cidadaos WHERE id = ?', [cidId], (err, row) => {
        if (!row) return res.status(404).json({ sucesso: false, erro: 'Registro não encontrado.' });
        db.run('DELETE FROM cidadaos WHERE id = ?', [cidId], (e2) => {
            db.run(
                `INSERT INTO logs_operacoes (acao, cidadao_nome, cidadao_matricula, operador, detalhes) VALUES (?, ?, ?, ?, ?)`,
                ['EXCLUSAO', row.nome, row.matricula, 'Operador', `Registro ID #${cidId} excluído do SQLite`]
            );
            res.json({
                sucesso: true,
                mensagem: `Prontuário de '${row.nome}' excluído com sucesso do SQLite!`
            });
        });
    });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Servidor Node.js + SQLite rodando em http://localhost:${PORT}`);
});
