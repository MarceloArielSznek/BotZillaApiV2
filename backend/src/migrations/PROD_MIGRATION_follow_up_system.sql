-- ============================================
-- PRODUCTION MIGRATION: FOLLOW-UP SYSTEM
-- ============================================
-- Descripción: Crea el sistema completo de follow-up para estimates
-- Incluye: tickets, statuses, labels, chat y mensajes
-- Fecha: 2025-11-18
-- Autor: BotZilla Development Team
-- ============================================

-- Iniciar transacción (todo o nada)
BEGIN;

-- ============================================
-- 1. TABLA: follow_up_status
-- ============================================
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

-- Comentario en la tabla
COMMENT ON TABLE botzilla.follow_up_status IS 'Estados posibles de un follow-up ticket (Lost, Sold, Negotiating)';

-- ============================================
-- 2. TABLA: follow_up_label
-- ============================================
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

-- Comentario en la tabla
COMMENT ON TABLE botzilla.follow_up_label IS 'Etiquetas/categorías de follow-up (PMP, Discount, Other)';

-- ============================================
-- 3. TABLA: chat
-- ============================================
-- Contenedor para conversaciones de follow-up

CREATE TABLE IF NOT EXISTS botzilla.chat (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comentario en la tabla
COMMENT ON TABLE botzilla.chat IS 'Contenedor para conversaciones de follow-up';

-- ============================================
-- 4. TABLA: chat_message
-- ============================================
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

-- Comentarios en la tabla
COMMENT ON TABLE botzilla.chat_message IS 'Mensajes individuales dentro de un chat';
COMMENT ON COLUMN botzilla.chat_message.metadata IS 'Datos adicionales en formato JSON: attachments, external IDs (WhatsApp, Telegram), read receipts, etc.';

-- ============================================
-- 5. TABLA: follow_up_ticket
-- ============================================
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
CREATE INDEX IF NOT EXISTS idx_follow_up_ticket_assigned_to ON botzilla.follow_up_ticket(assigned_to);

-- Comentarios en la tabla
COMMENT ON TABLE botzilla.follow_up_ticket IS 'Ticket principal de follow-up relacionado a un estimate';
COMMENT ON COLUMN botzilla.follow_up_ticket.notes IS 'Notas internas del equipo (no visibles para el cliente)';
COMMENT ON COLUMN botzilla.follow_up_ticket.assigned_to IS 'Usuario asignado para hacer el follow-up';

-- ============================================
-- 6. RELACIÓN BIDIRECCIONAL CON ESTIMATE
-- ============================================
-- Agregar columna follow_up_ticket_id a estimate (opcional)

ALTER TABLE botzilla.estimate 
ADD COLUMN IF NOT EXISTS follow_up_ticket_id INTEGER REFERENCES botzilla.follow_up_ticket(id) ON DELETE SET NULL;

-- Índice para la relación
CREATE INDEX IF NOT EXISTS idx_estimate_follow_up_ticket_id ON botzilla.estimate(follow_up_ticket_id);

-- ============================================
-- 7. TRIGGERS PARA AUTO-UPDATE DE updated_at
-- ============================================

-- Crear función genérica para actualizar updated_at (si no existe)
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
-- 8. PERMISOS (OPCIONAL - AJUSTAR SEGÚN NECESIDAD)
-- ============================================
-- Si tienes roles específicos, descomenta y ajusta:

-- GRANT SELECT, INSERT, UPDATE, DELETE ON botzilla.follow_up_status TO botzilla_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON botzilla.follow_up_label TO botzilla_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON botzilla.chat TO botzilla_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON botzilla.chat_message TO botzilla_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON botzilla.follow_up_ticket TO botzilla_app;

-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA botzilla TO botzilla_app;

-- ============================================
-- 9. VERIFICACIÓN FINAL
-- ============================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Verificar que se crearon las 5 tablas principales
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'botzilla'
    AND table_name IN ('follow_up_status', 'follow_up_label', 'chat', 'chat_message', 'follow_up_ticket');
    
    IF v_count <> 5 THEN
        RAISE EXCEPTION 'Error: No se crearon todas las tablas. Se esperaban 5, se encontraron %', v_count;
    END IF;
    
    -- Verificar que se insertaron los statuses
    SELECT COUNT(*) INTO v_count FROM botzilla.follow_up_status;
    IF v_count < 3 THEN
        RAISE EXCEPTION 'Error: No se insertaron todos los statuses. Se esperaban 3, se encontraron %', v_count;
    END IF;
    
    -- Verificar que se insertaron los labels
    SELECT COUNT(*) INTO v_count FROM botzilla.follow_up_label;
    IF v_count < 3 THEN
        RAISE EXCEPTION 'Error: No se insertaron todos los labels. Se esperaban 3, se encontraron %', v_count;
    END IF;
    
    -- Verificar que se agregó la columna a estimate
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'botzilla'
        AND table_name = 'estimate'
        AND column_name = 'follow_up_ticket_id'
    ) THEN
        RAISE EXCEPTION 'Error: No se agregó la columna follow_up_ticket_id a la tabla estimate';
    END IF;
    
    RAISE NOTICE '✅ Verificación exitosa: Todas las tablas, datos y columnas fueron creados correctamente';
END $$;

-- ============================================
-- 10. COMMIT FINAL
-- ============================================

COMMIT;

-- ============================================
-- QUERIES DE VERIFICACIÓN POST-MIGRACIÓN
-- ============================================

-- Ver las tablas creadas con sus tamaños
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'botzilla' 
    AND tablename IN ('follow_up_status', 'follow_up_label', 'chat', 'chat_message', 'follow_up_ticket')
ORDER BY tablename;

-- Ver los estados insertados
SELECT id, name, description, color FROM botzilla.follow_up_status ORDER BY id;

-- Ver los labels insertados
SELECT id, name, description, color FROM botzilla.follow_up_label ORDER BY id;

-- Ver los índices creados
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'botzilla'
    AND tablename IN ('follow_up_ticket', 'chat_message')
ORDER BY tablename, indexname;

-- Contar estimates que ya tienen ticket asignado
SELECT 
    COUNT(*) FILTER (WHERE follow_up_ticket_id IS NOT NULL) as estimates_with_ticket,
    COUNT(*) FILTER (WHERE follow_up_ticket_id IS NULL) as estimates_without_ticket,
    COUNT(*) as total_estimates
FROM botzilla.estimate;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================

-- Notas importantes:
-- 1. Este script es idempotente (se puede ejecutar múltiples veces sin problemas)
-- 2. Si algo falla, todo se revierte automáticamente (transacción)
-- 3. Después de ejecutar, verificar las queries de verificación
-- 4. Los tickets se crearán automáticamente durante el estimate-sync para estimates "Lost"
-- 5. La columna follow_up_ticket_id en estimate es opcional y puede quedarse NULL

