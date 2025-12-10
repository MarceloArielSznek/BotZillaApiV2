-- ============================================
-- SMS BATCH SYSTEM - TABLAS BASE
-- ============================================
-- Este script crea las tablas necesarias para el sistema de batches
-- Fase 1: Solo batches (sin SMS aún)
-- ============================================

-- Tabla 1: sms_batch (Grupos de Estimates)
CREATE TABLE IF NOT EXISTS botzilla.sms_batch (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES botzilla."user"(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'draft', -- draft, ready, sent, cancelled
    total_estimates INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}' -- Guarda los filtros aplicados
);

-- Tabla 2: sms_batch_estimate (Relación Many-to-Many)
CREATE TABLE IF NOT EXISTS botzilla.sms_batch_estimate (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES botzilla.sms_batch(id) ON DELETE CASCADE,
    estimate_id INTEGER NOT NULL REFERENCES botzilla.estimate(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, skipped
    sent_at TIMESTAMP,
    error_message TEXT,
    UNIQUE(batch_id, estimate_id)
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_sms_batch_created_by ON botzilla.sms_batch(created_by);
CREATE INDEX IF NOT EXISTS idx_sms_batch_status ON botzilla.sms_batch(status);
CREATE INDEX IF NOT EXISTS idx_sms_batch_created_at ON botzilla.sms_batch(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_batch_estimate_batch_id ON botzilla.sms_batch_estimate(batch_id);
CREATE INDEX IF NOT EXISTS idx_sms_batch_estimate_estimate_id ON botzilla.sms_batch_estimate(estimate_id);
CREATE INDEX IF NOT EXISTS idx_sms_batch_estimate_status ON botzilla.sms_batch_estimate(status);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION botzilla.update_sms_batch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sms_batch_updated_at
    BEFORE UPDATE ON botzilla.sms_batch
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_sms_batch_updated_at();

-- Trigger para actualizar total_estimates
CREATE OR REPLACE FUNCTION botzilla.update_sms_batch_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE botzilla.sms_batch 
        SET total_estimates = (
            SELECT COUNT(*) 
            FROM botzilla.sms_batch_estimate 
            WHERE batch_id = NEW.batch_id
        )
        WHERE id = NEW.batch_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE botzilla.sms_batch 
        SET total_estimates = (
            SELECT COUNT(*) 
            FROM botzilla.sms_batch_estimate 
            WHERE batch_id = OLD.batch_id
        )
        WHERE id = OLD.batch_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sms_batch_count
    AFTER INSERT OR DELETE ON botzilla.sms_batch_estimate
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_sms_batch_count();

-- Comentarios
COMMENT ON TABLE botzilla.sms_batch IS 'Grupos de estimates para envío masivo de SMS';
COMMENT ON TABLE botzilla.sms_batch_estimate IS 'Relación many-to-many entre batches y estimates';
COMMENT ON COLUMN botzilla.sms_batch.metadata IS 'JSON con filtros aplicados: {priceRange, dateRange, branch, salesperson, etc}';
COMMENT ON COLUMN botzilla.sms_batch.status IS 'draft: en creación, ready: listo para enviar, sent: ya enviado, cancelled: cancelado';

