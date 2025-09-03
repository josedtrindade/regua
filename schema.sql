-- Régua 3.0 Database Schema
-- Execute este SQL no seu projeto Supabase

CREATE TABLE IF NOT EXISTS times (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    nome_completo VARCHAR(200),
    liga VARCHAR(100),
    pais VARCHAR(50),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS criterios (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    peso DECIMAL(3,2) DEFAULT 1.0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analises (
    id BIGSERIAL PRIMARY KEY,
    jogo VARCHAR(200) NOT NULL,
    time_mandante VARCHAR(100),
    time_visitante VARCHAR(100),
    nivel_confianca VARCHAR(50),
    confianca_percentual DECIMAL(5,2),
    previsao_regua TEXT,
    resultado_real VARCHAR(100),
    acerto VARCHAR(50),
    observacoes TEXT,
    odd_mandante DECIMAL(6,2),
    odd_empate DECIMAL(6,2),
    odd_visitante DECIMAL(6,2),
    favorito_mercado VARCHAR(100),
    urls_noticias TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir critérios padrão
INSERT INTO criterios (nome, descricao, peso) VALUES
('Motivação', 'Nível de motivação das equipes', 1.0),
('Forma Recente', 'Performance nas últimas partidas', 1.0),
('Fator Casa', 'Vantagem do time mandante', 0.8),
('Mercado', 'Análise das odds do mercado', 0.6),
('Contexto', 'Situação atual dos times', 0.9)
ON CONFLICT (nome) DO NOTHING;
