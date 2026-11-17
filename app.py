#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor Backend e Integração com Banco de Dados SQLite (PPI — Checkpoint 2)
Atende integralmente aos Itens 7 e 8 da Ementa:
- Item 7 (Geração de Conteúdo Semântico):
  Gera dinamicamente no servidor (SSR) os metadados (<title>, <meta name="description">),
  tags Open Graph (og:title, og:description, og:type, og:url, og:image) e dados
  estruturados JSON-LD (schema.org) a partir dos registros do banco de dados SQLite,
  permitindo verificação via Ctrl + U (Código-fonte da página), Google Rich Results Test
  e auditoria do Lighthouse.
- Item 8 (Integração com SGBD Real - SQLite 3):
  Realiza operações de leitura (SELECT) e escrita (INSERT, UPDATE, DELETE) no arquivo
  relacional `database.db` utilizando exclusivamente CONSULTAS PARAMETRIZADAS (placeholders `?`)
  para proteção contra ataques de SQL Injection.
"""

import html
import json
import mimetypes
import os
import re
import sqlite3
import unicodedata
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")
PORT = int(os.environ.get("PORT", 3000))


def normalize_text(text: str) -> str:
    """Remove acentos e converte para minúsculas para comparação flexível."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(text))
    return "".join([c for c in nfkd if not unicodedata.combining(c)]).lower().strip()


def normalize_cpf(cpf: str) -> str:
    """Mantém apenas os dígitos numéricos do CPF."""
    if not cpf:
        return ""
    return re.sub(r"\D", "", str(cpf))


def br_date_to_iso(dt_br: str) -> str:
    """Converte data DD/MM/AAAA para o padrão ISO-8601 (AAAA-MM-DD) exigido pelo schema.org."""
    if not dt_br:
        return ""
    parts = str(dt_br).strip().split("/")
    if len(parts) == 3 and len(parts[2]) == 4:
        return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    return dt_br


def get_db_connection():
    """Abre conexão com o banco SQLite retornando linhas como dicionários (sqlite3.Row)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Registra funções auxiliares para busca insensível a acentos/pontuação dentro do SQL
    conn.create_function("NORM_TEXT", 1, normalize_text)
    conn.create_function("NORM_CPF", 1, normalize_cpf)
    return conn


def init_db():
    """Inicializa o banco de dados SQLite executando o script schema.sql."""
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()
    conn.close()


def row_to_dict(row: sqlite3.Row) -> dict:
    """Converte uma linha da tabela `cidadaos` para o formato JSON consumido pelo frontend."""
    return {
        "id": row["id"],
        "nome": row["nome"],
        "cpf": row["cpf"],
        "dtNascimento": row["dt_nascimento"],
        "matricula": row["matricula"],
        "mae": row["mae"],
        "pai": row["pai"],
        "origem": row["origem"],
        "linkProcessoEDocs": row["link_processo_edocs"],
        "criadoEm": row["criado_em"],
        "atualizadoEm": row["atualizado_em"],
    }


def build_citizen_jsonld(citizen: dict, base_url: str = "http://localhost:3000") -> dict:
    """
    Gera o objeto JSON-LD (schema.org) dinamicamente a partir dos dados de um cidadão do banco.
    Vocabulário utilizado: https://schema.org/Person e https://schema.org/DigitalDocument
    """
    origem_label = (
        "Módulo (Instrução Formativa)"
        if citizen["origem"] == "modulo"
        else "BPE (Banca de Exames Permanente)"
    )
    iso_birth = br_date_to_iso(citizen["dtNascimento"])

    person_schema = {
        "@type": "Person",
        "@id": f"{base_url}/prontuario/{citizen['id']}#person",
        "name": citizen["nome"],
        "identifier": [
            {
                "@type": "PropertyValue",
                "name": "CPF",
                "value": citizen["cpf"],
            },
            {
                "@type": "PropertyValue",
                "name": "Matrícula Funcional / Prontuário",
                "value": citizen["matricula"],
            },
        ],
        "birthDate": iso_birth,
        "parent": [
            {"@type": "Person", "name": citizen["mae"], "description": "Mãe"},
            {"@type": "Person", "name": citizen["pai"], "description": "Pai"},
        ],
        "subjectOf": {
            "@type": "DigitalDocument",
            "@id": f"{base_url}/prontuario/{citizen['id']}#prontuario",
            "name": f"Prontuário Digital {citizen['matricula']} - {citizen['nome']}",
            "url": citizen["linkProcessoEDocs"],
            "genre": origem_label,
            "provider": {
                "@type": "GovernmentOrganization",
                "name": "Sistema E-Docs - Governo do Estado do Espírito Santo",
                "url": "https://e-docs.es.gov.br",
            },
        },
    }
    return person_schema


def build_catalog_jsonld(citizens: list, base_url: str = "http://localhost:3000") -> dict:
    """
    Gera o JSON-LD completo da aplicação (WebSite + GovernmentService + ItemList de Prontuários)
    a partir dos registros reais lidos do banco de dados SQLite.
    """
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": f"{base_url}/#website",
                "url": f"{base_url}/",
                "name": "Sistema de Consulta de Cidadão & Prontuários",
                "description": (
                    f"Portal institucional integrado ao SGBD SQLite e ao E-Docs/ES "
                    f"com {len(citizens)} prontuários ativos no banco de dados."
                ),
                "inLanguage": "pt-BR",
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": f"{base_url}/?q={{search_term_string}}",
                    "query-input": "required name=search_term_string",
                },
            },
            {
                "@type": "GovernmentService",
                "@id": f"{base_url}/#service",
                "name": "Consulta e Gestão de Prontuários de Cidadãos (Módulo e BPE)",
                "serviceType": "Consulta de Prontuários e Processos Eletrônicos E-Docs",
                "provider": {
                    "@type": "GovernmentOrganization",
                    "name": "Governo do Estado do Espírito Santo - Integração E-Docs",
                },
                "areaServed": {
                    "@type": "AdministrativeArea",
                    "name": "Espírito Santo, Brasil",
                },
            },
            {
                "@type": "ItemList",
                "@id": f"{base_url}/#itemlist",
                "name": "Prontuários Cadastrados no Banco de Dados SQLite",
                "numberOfItems": len(citizens),
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": idx + 1,
                        "url": f"{base_url}/prontuario/{c['id']}",
                        "item": build_citizen_jsonld(c, base_url),
                    }
                    for idx, c in enumerate(citizens)
                ],
            },
        ],
    }


def render_index_ssr(base_url: str = "http://localhost:3000") -> str:
    """
    Lê o template `index.html` e injeta dinamicamente no servidor (SSR) os metadados,
    tags Open Graph e o JSON-LD gerados a partir dos dados reais do SQLite.
    Assim, ao pressionar Ctrl + U no navegador, os metadados e o JSON-LD já vêm preenchidos do banco!
    """
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM cidadaos ORDER BY id ASC").fetchall()
    conn.close()
    citizens = [row_to_dict(r) for r in rows]

    total = len(citizens)
    nomes_preview = ", ".join([c["nome"].title() for c in citizens[:3]])
    dynamic_title = f"Sistema de Consulta de Cidadão & Prontuários ({total} Registros no Banco)"
    dynamic_desc = (
        f"Sistema institucional de consulta e gestão de prontuários integrado ao SQLite e E-Docs/ES. "
        f"Atualmente com {total} prontuários cadastrados ({nomes_preview})."
    )
    jsonld_str = json.dumps(build_catalog_jsonld(citizens, base_url), ensure_ascii=False, indent=2)

    index_path = os.path.join(BASE_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Substitui marcadores ou atualiza o <head> com os dados reais do banco
    html_content = html_content.replace("{{SSR_TITLE}}", html.escape(dynamic_title))
    html_content = html_content.replace("{{SSR_DESCRIPTION}}", html.escape(dynamic_desc))
    html_content = html_content.replace("{{SSR_OG_URL}}", html.escape(f"{base_url}/"))
    html_content = html_content.replace("{{SSR_OG_IMAGE}}", html.escape(f"{base_url}/img/logo-trabalhoPPI.png"))
    html_content = html_content.replace("{{SSR_JSONLD}}", jsonld_str)
    html_content = html_content.replace("{{SSR_TOTAL_REGISTROS}}", str(total))

    return html_content


def render_prontuario_ssr(citizen_id: int, base_url: str = "http://localhost:3000"):
    """
    Gera no servidor uma página HTML5 semântica exclusiva para o prontuário de um cidadão (`/prontuario/<id>`).
    Demonstra de forma cristalina o Item 7 da ementa:
    - Título (<title>) e <meta name="description"> gerados a partir dos dados do cidadão no SQLite;
    - Tags Open Graph (og:title, og:description, og:type="profile", og:url, og:image) geradas dinamicamente;
    - Dados estruturados JSON-LD (ProfilePage + Person + DigitalDocument) gerados a partir do banco;
    - HTML5 100% semântico e acessível (header, nav, main, article, dl/dt/dd, footer, breadcrumb).
    """
    conn = get_db_connection()
    # Consulta parametrizada segura com placeholder (?)
    row = conn.execute("SELECT * FROM cidadaos WHERE id = ?", (citizen_id,)).fetchone()
    conn.close()

    if not row:
        return None

    c = row_to_dict(row)
    origem_badge = "MÓDULO (Instrução Formativa)" if c["origem"] == "modulo" else "BPE (Banca de Exames Permanente)"
    page_url = f"{base_url}/prontuario/{c['id']}"
    page_title = f"Prontuário {c['matricula']} — {c['nome']} | Consulta de Prontuários"
    page_desc = (
        f"Prontuário digital de {c['nome']} (Matrícula {c['matricula']}, CPF {c['cpf']}, "
        f"Nascimento {c['dtNascimento']}). Origem: {origem_badge}. Integrado ao E-Docs/ES."
    )

    profile_jsonld = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": page_url,
        "url": page_url,
        "name": page_title,
        "description": page_desc,
        "inLanguage": "pt-BR",
        "dateModified": c["atualizadoEm"] or datetime.now().strftime("%Y-%m-%d"),
        "mainEntity": build_citizen_jsonld(c, base_url),
        "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Painel de Consulta de Prontuários",
                    "item": f"{base_url}/",
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": f"Prontuário {c['matricula']} ({c['nome']})",
                    "item": page_url,
                },
            ],
        },
    }
    jsonld_pretty = json.dumps(profile_jsonld, ensure_ascii=False, indent=2)

    nome_esc = html.escape(c["nome"])
    cpf_esc = html.escape(c["cpf"])
    nasc_esc = html.escape(c["dtNascimento"])
    iso_nasc_esc = html.escape(br_date_to_iso(c["dtNascimento"]))
    mat_esc = html.escape(c["matricula"])
    mae_esc = html.escape(c["mae"])
    pai_esc = html.escape(c["pai"])
    edocs_esc = html.escape(c["linkProcessoEDocs"])
    title_esc = html.escape(page_title)
    desc_esc = html.escape(page_desc)

    return f"""<!DOCTYPE html>
<html lang="pt-BR" prefix="og: https://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title_esc}</title>
    <meta name="description" content="{desc_esc}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="{page_url}">

    <!-- Open Graph (Prévia para WhatsApp, Telegram e Redes Sociais gerada a partir do banco SQLite) -->
    <meta property="og:locale" content="pt_BR">
    <meta property="og:type" content="profile">
    <meta property="og:site_name" content="Sistema de Consulta de Cidadão &amp; Prontuários">
    <meta property="og:title" content="{title_esc}">
    <meta property="og:description" content="{desc_esc}">
    <meta property="og:url" content="{page_url}">
    <meta property="og:image" content="{base_url}/img/logo-trabalhoPPI.png">
    <meta property="og:image:alt" content="Brasão oficial do Sistema de Consulta de Prontuários">
    <meta property="profile:first_name" content="{html.escape(c['nome'].split()[0])}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="{title_esc}">
    <meta name="twitter:description" content="{desc_esc}">
    <meta name="twitter:image" content="{base_url}/img/logo-trabalhoPPI.png">

    <!-- Dados Estruturados JSON-LD (schema.org) gerados dinamicamente pelo Servidor a partir do SQLite -->
    <script type="application/ld+json">
{jsonld_pretty}
    </script>

    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <a href="#main-prontuario" class="skip-link">Pular para os dados do prontuário</a>

    <header class="navbar" role="banner">
        <div class="logo">
            <img src="/img/logo-trabalhoPPI.png" alt="Brasão e logotipo do Sistema de Consulta de Prontuários" width="64" height="64">
            <div>
                <h1>Sistema de Consulta de Prontuários</h1>
                <p class="header-tagline">Ficha Individual Semântica (Gerada no Servidor via SQLite)</p>
            </div>
        </div>
        <nav aria-label="Navegação de retorno">
            <a href="/" class="btn btn-secondary btn-sm">&larr; Voltar ao Painel de Consulta</a>
        </nav>
    </header>

    <main id="main-prontuario" class="container" role="main">
        <nav aria-label="Trilha de navegação (Breadcrumb)" class="breadcrumb-nav">
            <ol class="breadcrumb-list">
                <li><a href="/">Início (Painel de Consulta)</a></li>
                <li aria-current="page">Prontuário {mat_esc} — {nome_esc}</li>
            </ol>
        </nav>

        <article class="card result-card" itemscope itemtype="https://schema.org/Person" aria-labelledby="titulo-prontuario">
            <header class="result-header">
                <div>
                    <h2 id="titulo-prontuario" itemprop="name">{nome_esc}</h2>
                    <p class="subtitle" style="margin-bottom:0;">Registro ID #{c['id']} no banco SQLite &bull; Matrícula <strong itemprop="identifier">{mat_esc}</strong></p>
                </div>
                <span class="badge badge-origin">{origem_badge}</span>
            </header>

            <dl class="info-grid">
                <div class="info-item">
                    <dt class="label">Nome Completo</dt>
                    <dd class="value" itemprop="name">{nome_esc}</dd>
                </div>
                <div class="info-item">
                    <dt class="label">CPF</dt>
                    <dd class="value" itemprop="taxID">{cpf_esc}</dd>
                </div>
                <div class="info-item">
                    <dt class="label">Data de Nascimento</dt>
                    <dd class="value"><time datetime="{iso_nasc_esc}" itemprop="birthDate">{nasc_esc}</time></dd>
                </div>
                <div class="info-item">
                    <dt class="label">Matrícula Funcional</dt>
                    <dd class="value" itemprop="identifier">{mat_esc}</dd>
                </div>
                <div class="info-item">
                    <dt class="label">Nome da Mãe</dt>
                    <dd class="value" itemprop="parent">{mae_esc}</dd>
                </div>
                <div class="info-item">
                    <dt class="label">Nome do Pai</dt>
                    <dd class="value" itemprop="parent">{pai_esc}</dd>
                </div>
            </dl>

            <footer class="action-area" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <a href="/" class="btn btn-secondary">&larr; Voltar à Pesquisa</a>
                <a href="{edocs_esc}" target="_blank" rel="noopener noreferrer" itemprop="url" class="btn btn-success btn-icon-link">
                    <img src="/img/e-docs-logo-transparent-small.png" alt="Ícone do portal E-Docs do Governo do Espírito Santo" width="28" height="28">
                    <span>ACESSAR PROCESSO NO E-DOCS</span>
                </a>
            </footer>
        </article>

        <section class="card semantic-inspector-card" aria-labelledby="titulo-inspecao-ssr">
            <h2 id="titulo-inspecao-ssr">Metadados e JSON-LD Gerados para esta Página (Item 7)</h2>
            <p class="subtitle">
                Pressione <kbd>Ctrl</kbd> + <kbd>U</kbd> para ver o código-fonte original enviado pelo servidor.
                O título, a descrição, as tags Open Graph (prévia do WhatsApp) e o bloco JSON-LD abaixo foram gerados automaticamente a partir do registro <strong>#{c['id']}</strong> no banco SQLite:
            </p>
            <div class="code-preview-grid">
                <div>
                    <h3>Metadados &amp; Open Graph (&lt;head&gt;)</h3>
                    <pre class="code-block"><code>&lt;title&gt;{title_esc}&lt;/title&gt;
&lt;meta name="description" content="{desc_esc}"&gt;
&lt;meta property="og:type" content="profile"&gt;
&lt;meta property="og:title" content="{title_esc}"&gt;
&lt;meta property="og:description" content="{desc_esc}"&gt;
&lt;meta property="og:url" content="{page_url}"&gt;</code></pre>
                </div>
                <div>
                    <h3>Dados Estruturados JSON-LD (schema.org)</h3>
                    <pre class="code-block"><code>{html.escape(jsonld_pretty)}</code></pre>
                </div>
            </div>
        </section>
    </main>
</body>
</html>"""


class RequestHandler(BaseHTTPRequestHandler):
    """Controlador HTTP para rotas SSR, arquivos estáticos e API REST com SQLite."""

    def _send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, status_code: int, html_text: str):
        body = html_text.encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _get_base_url(self) -> str:
        host = self.headers.get("Host", f"localhost:{PORT}")
        return f"http://{host}"

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        base_url = self._get_base_url()

        # 1. Rota Principal SSR (index.html com Metadados + Open Graph + JSON-LD do banco)
        if path in ("/", "/index.html"):
            html_out = render_index_ssr(base_url)
            return self._send_html(200, html_out)

        # 2. Rota SSR de Ficha Semântica Individual (/prontuario/<id>)
        if path.startswith("/prontuario/"):
            parts = path.strip("/").split("/")
            if len(parts) == 2 and parts[1].isdigit():
                html_out = render_prontuario_ssr(int(parts[1]), base_url)
                if html_out:
                    return self._send_html(200, html_out)
            return self._send_html(404, "<h1>404 - Prontuário não encontrado no banco de dados</h1><p><a href='/'>Voltar</a></p>")

        # 3. API: Listar ou Pesquisar Cidadãos no SQLite (com Consultas Parametrizadas)
        if path == "/api/cidadaos":
            conn = get_db_connection()
            sql = "SELECT * FROM cidadaos WHERE 1=1"
            params = []

            origem = query.get("origem", [""])[0].strip()
            q = query.get("q", [""])[0].strip()
            nome = query.get("nome", [""])[0].strip()
            cpf = query.get("cpf", [""])[0].strip()
            dt_nasc = query.get("dtNascimento", [""])[0].strip()
            matricula = query.get("matricula", [""])[0].strip()
            mae = query.get("mae", [""])[0].strip()
            pai = query.get("pai", [""])[0].strip()

            if origem:
                sql += " AND origem = ?"
                params.append(origem)

            if q:
                norm_q = f"%{normalize_text(q)}%"
                norm_q_cpf = normalize_cpf(q)
                if norm_q_cpf:
                    sql += " AND (NORM_TEXT(nome) LIKE ? OR NORM_TEXT(matricula) LIKE ? OR NORM_CPF(cpf) LIKE ?)"
                    params.extend([norm_q, norm_q, f"%{norm_q_cpf}%"])
                else:
                    sql += " AND (NORM_TEXT(nome) LIKE ? OR NORM_TEXT(matricula) LIKE ?)"
                    params.extend([norm_q, norm_q])
            else:
                if nome:
                    sql += " AND NORM_TEXT(nome) LIKE ?"
                    params.append(f"%{normalize_text(nome)}%")
                if cpf:
                    norm_c = normalize_cpf(cpf)
                    if norm_c:
                        sql += " AND NORM_CPF(cpf) LIKE ?"
                        params.append(f"%{norm_c}%")
                if dt_nasc:
                    sql += " AND dt_nascimento = ?"
                    params.append(dt_nasc)
                if matricula:
                    sql += " AND NORM_TEXT(matricula) LIKE ?"
                    params.append(f"%{normalize_text(matricula)}%")
                if mae:
                    sql += " AND NORM_TEXT(mae) LIKE ?"
                    params.append(f"%{normalize_text(mae)}%")
                if pai:
                    sql += " AND NORM_TEXT(pai) LIKE ?"
                    params.append(f"%{normalize_text(pai)}%")

            sql += " ORDER BY id DESC"
            rows = conn.execute(sql, tuple(params)).fetchall()
            conn.close()

            results = [row_to_dict(r) for r in rows]
            return self._send_json(
                200,
                {
                    "sucesso": True,
                    "total": len(results),
                    "consultaParametrizada": sql,
                    "parametrosSeguros": params,
                    "dados": results,
                },
            )

        # 4. API: Obter Cidadão por ID
        if path.startswith("/api/cidadaos/"):
            cid_str = path.split("/")[-1]
            if cid_str.isdigit():
                conn = get_db_connection()
                row = conn.execute("SELECT * FROM cidadaos WHERE id = ?", (int(cid_str),)).fetchone()
                conn.close()
                if row:
                    return self._send_json(200, {"sucesso": True, "dados": row_to_dict(row)})
            return self._send_json(404, {"sucesso": False, "erro": "Registro não encontrado."})

        # 5. API: Inspeção da Estrutura do Banco de Dados SQLite (para demonstração do Item 8)
        if path == "/api/db-info":
            conn = get_db_connection()
            cols_cidadaos = [
                dict(r) for r in conn.execute("PRAGMA table_info(cidadaos)").fetchall()
            ]
            cols_logs = [
                dict(r) for r in conn.execute("PRAGMA table_info(logs_operacoes)").fetchall()
            ]
            todos_cidadaos = [
                row_to_dict(r) for r in conn.execute("SELECT * FROM cidadaos ORDER BY id DESC").fetchall()
            ]
            logs = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM logs_operacoes ORDER BY id DESC LIMIT 15"
                ).fetchall()
            ]
            conn.close()
            return self._send_json(
                200,
                {
                    "sucesso": True,
                    "sgbd": f"SQLite {sqlite3.sqlite_version} (Arquivo: database.db)",
                    "tabelas": {
                        "cidadaos": {
                            "colunas": cols_cidadaos,
                            "totalRegistros": len(todos_cidadaos),
                            "registros": todos_cidadaos,
                        },
                        "logs_operacoes": {
                            "colunas": cols_logs,
                            "ultimosLogs": logs,
                        },
                    },
                },
            )

        # 6. Servir arquivos estáticos (style.css, script.js, imagens, etc.)
        safe_rel = os.path.normpath(path.lstrip("/"))
        if safe_rel.startswith(".."):
            return self._send_json(403, {"erro": "Acesso negado"})
        file_path = os.path.join(BASE_DIR, safe_rel)
        if os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            with open(file_path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self._send_json(404, {"erro": "Rota ou arquivo não encontrado"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/cidadaos":
            return self._send_json(404, {"sucesso": False, "erro": "Rota inválida"})

        try:
            body = self._read_json_body()
        except Exception:
            return self._send_json(400, {"sucesso": False, "erro": "JSON inválido na requisição."})

        nome = str(body.get("nome", "")).strip().upper()
        cpf = str(body.get("cpf", "")).strip()
        dt_nasc = str(body.get("dtNascimento", "")).strip()
        matricula = str(body.get("matricula", "")).strip().upper()
        mae = str(body.get("mae", "")).strip().upper()
        pai = str(body.get("pai", "")).strip().upper()
        origem = str(body.get("origem", "modulo")).strip().lower()
        link_edocs = str(
            body.get(
                "linkProcessoEDocs",
                "https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS",
            )
        ).strip()
        operador = str(body.get("operador", "Operador")).strip()

        if not all([nome, cpf, dt_nasc, matricula, mae, pai]) or origem not in ("modulo", "bpe"):
            return self._send_json(
                400,
                {
                    "sucesso": False,
                    "erro": "Preencha todos os campos obrigatórios (Nome, CPF, Data de Nascimento, Matrícula, Mãe, Pai e Origem).",
                },
            )

        if not link_edocs:
            link_edocs = "https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS"

        conn = get_db_connection()
        try:
            # CONSULTA PARAMETRIZADA (Prepared Statement com ?): previne SQL Injection
            cursor = conn.execute(
                """
                INSERT INTO cidadaos (nome, cpf, dt_nascimento, matricula, mae, pai, origem, link_processo_edocs)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (nome, cpf, dt_nasc, matricula, mae, pai, origem, link_edocs),
            )
            new_id = cursor.lastrowid

            conn.execute(
                """
                INSERT INTO logs_operacoes (acao, cidadao_nome, cidadao_matricula, operador, detalhes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    "CADASTRO",
                    nome,
                    matricula,
                    operador,
                    f"Cidadão cadastrado na origem {origem.upper()} (CPF: {cpf})",
                ),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM cidadaos WHERE id = ?", (new_id,)).fetchone()
            return self._send_json(
                201,
                {
                    "sucesso": True,
                    "mensagem": f"Cidadão '{nome}' cadastrado com sucesso no banco de dados SQLite!",
                    "dados": row_to_dict(row),
                },
            )
        except sqlite3.IntegrityError as e:
            err_msg = str(e)
            if "cpf" in err_msg.lower():
                msg = f"Já existe um cidadão cadastrado com o CPF {cpf}."
            elif "matricula" in err_msg.lower():
                msg = f"Já existe um prontuário cadastrado com a Matrícula {matricula}."
            else:
                msg = "Violação de unicidade no banco de dados (CPF ou Matrícula já existente)."
            return self._send_json(409, {"sucesso": False, "erro": msg})
        finally:
            conn.close()

    def do_PUT(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/cidadaos/"):
            return self._send_json(404, {"sucesso": False, "erro": "Rota inválida"})

        cid_str = parsed.path.split("/")[-1]
        if not cid_str.isdigit():
            return self._send_json(400, {"sucesso": False, "erro": "ID inválido"})
        cid_id = int(cid_str)

        try:
            body = self._read_json_body()
        except Exception:
            return self._send_json(400, {"sucesso": False, "erro": "JSON inválido."})

        nome = str(body.get("nome", "")).strip().upper()
        cpf = str(body.get("cpf", "")).strip()
        dt_nasc = str(body.get("dtNascimento", "")).strip()
        matricula = str(body.get("matricula", "")).strip().upper()
        mae = str(body.get("mae", "")).strip().upper()
        pai = str(body.get("pai", "")).strip().upper()
        origem = str(body.get("origem", "modulo")).strip().lower()
        link_edocs = str(
            body.get(
                "linkProcessoEDocs",
                "https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS",
            )
        ).strip()
        operador = str(body.get("operador", "Operador")).strip()

        if not all([nome, cpf, dt_nasc, matricula, mae, pai]) or origem not in ("modulo", "bpe"):
            return self._send_json(
                400,
                {"sucesso": False, "erro": "Todos os campos obrigatórios devem ser informados."},
            )

        conn = get_db_connection()
        try:
            existing = conn.execute("SELECT * FROM cidadaos WHERE id = ?", (cid_id,)).fetchone()
            if not existing:
                return self._send_json(404, {"sucesso": False, "erro": "Cidadão não encontrado no banco."})

            # CONSULTA PARAMETRIZADA DE ATUALIZAÇÃO (UPDATE com placeholders ?)
            conn.execute(
                """
                UPDATE cidadaos
                SET nome = ?, cpf = ?, dt_nascimento = ?, matricula = ?,
                    mae = ?, pai = ?, origem = ?, link_processo_edocs = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (nome, cpf, dt_nasc, matricula, mae, pai, origem, link_edocs, cid_id),
            )

            conn.execute(
                """
                INSERT INTO logs_operacoes (acao, cidadao_nome, cidadao_matricula, operador, detalhes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    "ALTERACAO",
                    nome,
                    matricula,
                    operador,
                    f"Registro ID #{cid_id} atualizado no SQLite",
                ),
            )
            conn.commit()
            updated = conn.execute("SELECT * FROM cidadaos WHERE id = ?", (cid_id,)).fetchone()
            return self._send_json(
                200,
                {
                    "sucesso": True,
                    "mensagem": f"Prontuário de '{nome}' atualizado com sucesso no banco SQLite!",
                    "dados": row_to_dict(updated),
                },
            )
        except sqlite3.IntegrityError:
            return self._send_json(
                409,
                {"sucesso": False, "erro": "CPF ou Matrícula já pertence a outro registro no banco."},
            )
        finally:
            conn.close()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/cidadaos/"):
            return self._send_json(404, {"sucesso": False, "erro": "Rota inválida"})

        cid_str = parsed.path.split("/")[-1]
        if not cid_str.isdigit():
            return self._send_json(400, {"sucesso": False, "erro": "ID inválido"})
        cid_id = int(cid_str)

        conn = get_db_connection()
        try:
            existing = conn.execute("SELECT * FROM cidadaos WHERE id = ?", (cid_id,)).fetchone()
            if not existing:
                return self._send_json(404, {"sucesso": False, "erro": "Cidadão não encontrado no banco."})

            # CONSULTA PARAMETRIZADA DE EXCLUSÃO (DELETE com placeholder ?)
            conn.execute("DELETE FROM cidadaos WHERE id = ?", (cid_id,))
            conn.execute(
                """
                INSERT INTO logs_operacoes (acao, cidadao_nome, cidadao_matricula, operador, detalhes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    "EXCLUSAO",
                    existing["nome"],
                    existing["matricula"],
                    "Operador",
                    f"Registro ID #{cid_id} (CPF {existing['cpf']}) excluído do SQLite",
                ),
            )
            conn.commit()
            return self._send_json(
                200,
                {
                    "sucesso": True,
                    "mensagem": f"Prontuário de '{existing['nome']}' excluído com sucesso do banco SQLite!",
                },
            )
        finally:
            conn.close()


if __name__ == "__main__":
    init_db()
    server = HTTPServer(("0.0.0.0", PORT), RequestHandler)
    print("=" * 72)
    print(f" Servidor PPI (Checkpoint 2) rodando em: http://localhost:{PORT}")
    print(f" Banco de Dados SQLite ativo em: {DB_PATH}")
    print(" Pressione Ctrl+C para encerrar.")
    print("=" * 72)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
        server.server_close()
