-- Inicia una transacción segura
BEGIN;

-- Cambia el tipo de datos de las columnas de VARCHAR a BOOLEAN
-- La cláusula USING convierte los valores de texto 'true' a boolean true, y cualquier otra cosa a false.
ALTER TABLE botzilla.inspection_report
    ALTER COLUMN full_roof_inspection_interest TYPE BOOLEAN
    USING CASE WHEN full_roof_inspection_interest = 'true' THEN true ELSE false END;

ALTER TABLE botzilla.inspection_report
    ALTER COLUMN full_hvac_furnace_inspection_interest TYPE BOOLEAN
    USING CASE WHEN full_hvac_furnace_inspection_interest = 'true' THEN true ELSE false END;

-- Finaliza la transacción para guardar los cambios
COMMIT;
