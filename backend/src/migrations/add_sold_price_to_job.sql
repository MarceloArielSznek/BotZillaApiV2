-- =====================================================
-- Migration: Add sold_price to job table
-- Description: 
--   - Add sold_price column to store the actual price charged
--   - This field is populated from Performance sync
--   - Note: closing_date already exists in job table
-- Date: 2025-10-24
-- =====================================================

BEGIN;

-- 1. Agregar columna sold_price (precio cobrado/vendido)
ALTER TABLE botzilla.job 
ADD COLUMN sold_price DECIMAL(10, 2);

-- 2. Agregar comentario
COMMENT ON COLUMN botzilla.job.sold_price IS 'Precio final cobrado al cliente (obtenido de Performance spreadsheet)';

-- 3. Agregar índice para sold_price (para queries de revenue)
CREATE INDEX idx_job_sold_price ON botzilla.job(sold_price);

COMMIT;

-- =====================================================
-- Rollback (si es necesario):
-- =====================================================
-- BEGIN;
-- DROP INDEX botzilla.idx_job_sold_price;
-- ALTER TABLE botzilla.job DROP COLUMN sold_price;
-- COMMIT;

