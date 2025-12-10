-- ============================================
-- ADD NEW FOLLOW-UP STATUSES: Pending FU and Texted
-- ============================================
-- Este script agrega dos nuevos statuses al sistema de follow-up:
-- 1. Pending FU - Status por defecto para nuevos tickets
-- 2. Texted - Status para cuando se ha enviado un mensaje de texto
-- ============================================

-- Insertar nuevos statuses
INSERT INTO botzilla.follow_up_status (name, description, color) VALUES
    ('Pending FU', 'Pending follow-up - default status for new tickets', '#6B7280'),
    ('Texted', 'Customer has been texted', '#3B82F6')
ON CONFLICT (name) DO NOTHING;

-- Verificar que se insertaron correctamente
SELECT id, name, description, color 
FROM botzilla.follow_up_status 
WHERE name IN ('Pending FU', 'Texted')
ORDER BY id;

