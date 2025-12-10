-- Insertar configuración de webhook por defecto para QUO
-- NOTA: Reemplaza la URL con la URL real de tu webhook de QUO

INSERT INTO botzilla.sms_webhook_config (
    name,
    provider,
    webhook_url,
    api_key,
    is_active,
    is_default,
    metadata
) VALUES (
    'QUO Production',
    'quo',
    'https://your-quo-webhook-url.com/webhook', -- ⚠️ REEMPLAZAR CON LA URL REAL
    NULL, -- O tu API key si QUO la requiere
    true,
    true,
    '{"timeout": 30000, "retry_count": 3}'::jsonb
) ON CONFLICT DO NOTHING;

-- Verificar que se insertó correctamente
SELECT id, name, provider, webhook_url, is_active, is_default 
FROM botzilla.sms_webhook_config 
WHERE provider = 'quo';

