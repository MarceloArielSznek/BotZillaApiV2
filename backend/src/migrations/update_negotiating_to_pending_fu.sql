-- ============================================
-- UPDATE EXISTING TICKETS FROM "Negotiating" TO "Pending FU"
-- ============================================
-- Este script actualiza todos los tickets que tienen status "Negotiating"
-- y los cambia a "Pending FU" para mantener consistencia
-- ============================================

-- Obtener el ID de "Pending FU"
DO $$
DECLARE
    pending_fu_id INTEGER;
    negotiating_id INTEGER;
    updated_count INTEGER;
BEGIN
    -- Obtener IDs
    SELECT id INTO pending_fu_id FROM botzilla.follow_up_status WHERE name = 'Pending FU';
    SELECT id INTO negotiating_id FROM botzilla.follow_up_status WHERE name = 'Negotiating';
    
    -- Verificar que existen
    IF pending_fu_id IS NULL THEN
        RAISE EXCEPTION 'Pending FU status not found';
    END IF;
    
    IF negotiating_id IS NULL THEN
        RAISE NOTICE 'Negotiating status not found - nothing to update';
        RETURN;
    END IF;
    
    -- Actualizar tickets
    UPDATE botzilla.follow_up_ticket
    SET status_id = pending_fu_id
    WHERE status_id = negotiating_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated % tickets from Negotiating to Pending FU', updated_count;
END $$;

-- Verificar el resultado
SELECT 
    fs.name as status_name,
    COUNT(*) as ticket_count
FROM botzilla.follow_up_ticket ft
JOIN botzilla.follow_up_status fs ON ft.status_id = fs.id
WHERE fs.name IN ('Pending FU', 'Negotiating')
GROUP BY fs.name
ORDER BY fs.name;

