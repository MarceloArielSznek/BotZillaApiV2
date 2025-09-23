CREATE TABLE botzilla.telegram_group_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar categorías por defecto basadas en la estructura de roles
INSERT INTO botzilla.telegram_group_category (name) VALUES
('Sales'),
('Crew Members'),
('Crew Leaders'),
('General');
