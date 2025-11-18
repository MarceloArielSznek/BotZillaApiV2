-- ============================================
-- FOLLOW-UP SYSTEM MIGRATION
-- ============================================
-- Este script crea todas las tablas necesarias para el sistema de follow-up
-- de estimates incluyendo tickets, statuses, labels y chat.
-- ============================================

-- 1. Tabla: follow_up_status
-- Almacena los estados posibles de un follow-up ticket
CREATE TABLE IF NOT EXISTS botzilla.follow_up_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Hex color para UI (ej: #FF0000)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar estados iniciales
INSERT INTO botzilla.follow_up_status (name, description, color) VALUES
    ('Lost', 'Customer decided not to proceed', '#EF4444'),
    ('Sold', 'Customer accepted and purchased', '#10B981'),
    ('Negotiating', 'Actively negotiating with customer', '#F59E0B')
ON CONFLICT (name) DO NOTHING;

-- 2. Tabla: follow_up_label
-- Almacena las etiquetas/categorías de follow-up
CREATE TABLE IF NOT EXISTS botzilla.follow_up_label (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Hex color para UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar labels iniciales
INSERT INTO botzilla.follow_up_label (name, description, color) VALUES
    ('PMP', 'Price Match Promise follow-up', '#3B82F6'),
    ('Discount', 'Discount offer follow-up', '#8B5CF6'),
    ('Other', 'Other follow-up reasons', '#6B7280')
ON CONFLICT (name) DO NOTHING;

-- 3. Tabla: chat
-- Contenedor para conversaciones de follow-up
CREATE TABLE IF NOT EXISTS botzilla.chat (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla: chat_message
-- Almacena mensajes individuales dentro de un chat
CREATE TABLE IF NOT EXISTS botzilla.chat_message (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES botzilla.chat(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('agent', 'customer', 'system')),
    sender_name VARCHAR(100),
    message_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- Para attachments, external IDs, etc.
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para chat_message
CREATE INDEX IF NOT EXISTS idx_chat_message_chat_id ON botzilla.chat_message(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_sent_at ON botzilla.chat_message(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_message_sender_type ON botzilla.chat_message(sender_type);

-- 5. Tabla: follow_up_ticket
-- Ticket principal de follow-up relacionado a un estimate
CREATE TABLE IF NOT EXISTS botzilla.follow_up_ticket (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL REFERENCES botzilla.estimate(id) ON DELETE CASCADE,
    followed_up BOOLEAN DEFAULT FALSE,
    status_id INTEGER REFERENCES botzilla.follow_up_status(id),
    label_id INTEGER REFERENCES botzilla.follow_up_label(id),
    chat_id INTEGER REFERENCES botzilla.chat(id) ON DELETE SET NULL,
    notes TEXT, -- Notas internas del equipo
    assigned_to INTEGER REFERENCES botzilla.user(id), -- Usuario asignado
    follow_up_date DATE, -- Fecha programada para follow-up
    last_contact_date TIMESTAMP, -- Última vez que se contactó al cliente
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para follow_up_ticket
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_estimate_id ON botzilla.follow_up_ticket(estimate_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_status_id ON botzilla.follow_up_ticket(status_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_label_id ON botzilla.follow_up_ticket(label_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_followed_up ON botzilla.follow_up_ticket(followed_up);
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_follow_up_date ON botzilla.follow_up_ticket(follow_up_date);

-- 6. Agregar columna follow_up_ticket_id a estimate (opcional, para relación bidireccional)
ALTER TABLE botzilla.estimate 
ADD COLUMN IF NOT EXISTS follow_up_ticket_id INTEGER REFERENCES botzilla.follow_up_ticket(id) ON DELETE SET NULL;

-- Índice para la relación
CREATE INDEX IF NOT EXISTS idx_estimate_follow_up_ticket_id ON botzilla.estimate(follow_up_ticket_id);

-- ============================================
-- TRIGGERS PARA AUTO-UPDATE DE updated_at
-- ============================================

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION botzilla.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para follow_up_status
DROP TRIGGER IF EXISTS update_follow_up_status_updated_at ON botzilla.follow_up_status;
CREATE TRIGGER update_follow_up_status_updated_at
    BEFORE UPDATE ON botzilla.follow_up_status
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_updated_at_column();

-- Trigger para follow_up_label
DROP TRIGGER IF EXISTS update_follow_up_label_updated_at ON botzilla.follow_up_label;
CREATE TRIGGER update_follow_up_label_updated_at
    BEFORE UPDATE ON botzilla.follow_up_label
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_updated_at_column();

-- Trigger para chat
DROP TRIGGER IF EXISTS update_chat_updated_at ON botzilla.chat;
CREATE TRIGGER update_chat_updated_at
    BEFORE UPDATE ON botzilla.chat
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_updated_at_column();

-- Trigger para follow_up_ticket
DROP TRIGGER IF EXISTS update_follow_up_ticket_updated_at ON botzilla.follow_up_ticket;
CREATE TRIGGER update_follow_up_ticket_updated_at
    BEFORE UPDATE ON botzilla.follow_up_ticket
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_updated_at_column();

-- ============================================
-- COMENTARIOS EN LAS TABLAS
-- ============================================

COMMENT ON TABLE botzilla.follow_up_status IS 'Estados posibles de un follow-up ticket (Lost, Sold, Negotiating)';
COMMENT ON TABLE botzilla.follow_up_label IS 'Etiquetas/categorías de follow-up (PMP, Discount, Other)';
COMMENT ON TABLE botzilla.chat IS 'Contenedor para conversaciones de follow-up';
COMMENT ON TABLE botzilla.chat_message IS 'Mensajes individuales dentro de un chat';
COMMENT ON TABLE botzilla.follow_up_ticket IS 'Ticket principal de follow-up relacionado a un estimate';

COMMENT ON COLUMN botzilla.chat_message.metadata IS 'Datos adicionales en formato JSON: attachments, external IDs (WhatsApp, Telegram), read receipts, etc.';
COMMENT ON COLUMN botzilla.follow_up_ticket.notes IS 'Notas internas del equipo (no visibles para el cliente)';
COMMENT ON COLUMN botzilla.follow_up_ticket.assigned_to IS 'Usuario asignado para hacer el follow-up';

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Ver las tablas creadas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'botzilla' 
    AND tablename IN ('follow_up_status', 'follow_up_label', 'chat', 'chat_message', 'follow_up_ticket')
ORDER BY tablename;

-- Ver los estados insertados
SELECT * FROM botzilla.follow_up_status ORDER BY id;

-- Ver los labels insertados
SELECT * FROM botzilla.follow_up_label ORDER BY id;

