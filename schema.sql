-- ============================================================================
-- ESQUEMA DO BANCO DE DADOS RELACIONAL (SQLite 3)
-- Projeto: Sistema de Consulta de Cidadão & Prontuários (PPI - Checkpoint 2)
-- Item 8 da Ementa: Integração com Sistema Gerenciador de Banco de Dados
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Tabela Principal: cidadaos
-- Armazena os dados cadastrais e prontuários (Módulo e BPE)
CREATE TABLE IF NOT EXISTS cidadaos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    dt_nascimento TEXT NOT NULL,
    matricula TEXT NOT NULL UNIQUE,
    mae TEXT NOT NULL,
    pai TEXT NOT NULL,
    origem TEXT NOT NULL CHECK (origem IN ('modulo', 'bpe')),
    link_processo_edocs TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimizar buscas por CPF, matrícula, nome e origem
CREATE INDEX IF NOT EXISTS idx_cidadaos_origem ON cidadaos(origem);
CREATE INDEX IF NOT EXISTS idx_cidadaos_cpf ON cidadaos(cpf);
CREATE INDEX IF NOT EXISTS idx_cidadaos_matricula ON cidadaos(matricula);
CREATE INDEX IF NOT EXISTS idx_cidadaos_nome ON cidadaos(nome);

-- 2. Tabela de Auditoria: logs_operacoes
-- Registra todas as operações de escrita (INSERT, UPDATE, DELETE) feitas pela aplicação
CREATE TABLE IF NOT EXISTS logs_operacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acao TEXT NOT NULL CHECK (acao IN ('CADASTRO', 'ALTERACAO', 'EXCLUSAO')),
    cidadao_nome TEXT NOT NULL,
    cidadao_matricula TEXT NOT NULL,
    operador TEXT DEFAULT 'Operador',
    detalhes TEXT,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Carga Inicial de Dados (Seed)
INSERT OR IGNORE INTO cidadaos (id, nome, cpf, dt_nascimento, matricula, mae, pai, origem, link_processo_edocs)
VALUES
    (1, 'RYAN LUCAS TEIXEIRA DA SILVA', '123.456.789-00', '03/07/2004', 'MAT-9901', 'TESTE', 'TESTE', 'modulo', 'https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS'),
    (2, 'YARLEY REIS OLIVEIRA TEIXEIRA', '987.654.321-11', '20/10/1990', 'MAT-8842', 'TESTE', 'TESTE', 'modulo', 'https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS'),
    (3, 'PEDRO PEREIRA DOS SANTOS', '456.789.123-22', '15/04/2001', 'MAT-7710', 'MARIA DOS SANTOS', 'JOAO PEREIRA', 'bpe', 'https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS'),
    (4, 'JORDIAN COUTINHO ALMEIDA', '321.654.987-33', '11/09/2002', 'MAT-6520', 'ANA COUTINHO', 'CARLOS ALMEIDA', 'bpe', 'https://treinamento.e-docs.es.gov.br/Processo/Protocolo/2026-D8TCS');

INSERT OR IGNORE INTO logs_operacoes (id, acao, cidadao_nome, cidadao_matricula, operador, detalhes)
VALUES
    (1, 'CADASTRO', 'RYAN LUCAS TEIXEIRA DA SILVA', 'MAT-9901', 'Sistema (Seed)', 'Carga inicial do banco de dados SQLite'),
    (2, 'CADASTRO', 'YARLEY REIS OLIVEIRA TEIXEIRA', 'MAT-8842', 'Sistema (Seed)', 'Carga inicial do banco de dados SQLite'),
    (3, 'CADASTRO', 'PEDRO PEREIRA DOS SANTOS', 'MAT-7710', 'Sistema (Seed)', 'Carga inicial do banco de dados SQLite'),
    (4, 'CADASTRO', 'JORDIAN COUTINHO ALMEIDA', 'MAT-6520', 'Sistema (Seed)', 'Carga inicial do banco de dados SQLite');
