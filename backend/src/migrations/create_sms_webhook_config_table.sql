-- Tabla para configuración de webhooks de SMS (Make.com, Quo, etc.)
CREATE TABLE IF NOT EXISTS botzilla.sms_webhook_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- 'Make.com Production', 'Quo Staging', etc.
    provider VARCHAR(50) NOT NULL, -- 'make_com' o 'quo'
    webhook_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(255), -- Si requiere autenticación
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}' -- Headers adicionales, timeout, etc.
);

-- Índice para búsqueda rápida del webhook activo por defecto
CREATE INDEX IF NOT EXISTS idx_sms_webhook_config_active_default 
    ON botzilla.sms_webhook_config(is_active, is_default) 
    WHERE is_active = true AND is_default = true;

-- Comentarios
COMMENT ON TABLE botzilla.sms_webhook_config IS 'Configuración de webhooks para envío de SMS (Make.com, Quo, etc.)';
COMMENT ON COLUMN botzilla.sms_webhook_config.provider IS 'Proveedor: make_com, quo, etc.';
COMMENT ON COLUMN botzilla.sms_webhook_config.metadata IS 'Headers adicionales, timeout, retry config, etc.';

