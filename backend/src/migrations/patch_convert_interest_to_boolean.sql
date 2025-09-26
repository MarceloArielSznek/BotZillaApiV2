-- Inicia una transacción segura para garantizar la integridad de los datos.
BEGIN;

-- Convierte la columna de interés de inspección de techo a BOOLEAN.
-- La cláusula USING se encarga de transformar el texto 'true' al valor booleano true,
-- y cualquier otro valor (como 'false', NULL, o texto vacío) a false.
ALTER TABLE botzilla.inspection_report
    ALTER COLUMN full_roof_inspection_interest TYPE BOOLEAN
    USING CASE WHEN full_roof_inspection_interest = 'true' THEN true ELSE false END;

-- Convierte la columna de interés de inspección de HVAC a BOOLEAN.
ALTER TABLE botzilla.inspection_report
    ALTER COLUMN full_hvac_furnace_inspection_interest TYPE BOOLEAN
    USING CASE WHEN full_hvac_furnace_inspection_interest = 'true' THEN true ELSE false END;

-- Establece un valor por defecto de 'false' para estas columnas.
-- Esto asegura que cualquier nuevo registro que no especifique un valor, sea 'false' por defecto.
ALTER TABLE botzilla.inspection_report
    ALTER COLUMN full_roof_inspection_interest SET DEFAULT false,
    ALTER COLUMN full_hvac_furnace_inspection_interest SET DEFAULT false;
    
-- Actualiza todas las filas existentes que puedan tener NULL a 'false' para consistencia.
UPDATE botzilla.inspection_report
SET 
    full_roof_inspection_interest = COALESCE(full_roof_inspection_interest, false),
    full_hvac_furnace_inspection_interest = COALESCE(full_hvac_furnace_inspection_interest, false);


-- Finaliza la transacción y aplica todos los cambios.
COMMIT;
