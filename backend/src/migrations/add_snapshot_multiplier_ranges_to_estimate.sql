-- Agregar campo para guardar el snapshot de multiplier ranges del estimate
-- Ejecutar en la base de datos de producción

ALTER TABLE botzilla.estimate
ADD COLUMN IF NOT EXISTS snapshot_multiplier_ranges JSONB;

-- Comentario
COMMENT ON COLUMN botzilla.estimate.snapshot_multiplier_ranges IS 'Snapshot de multiplier ranges vigentes cuando se creó el estimate (de estimateSnapshot.snapshotData.multiplierRanges)';

-- Verificación
SELECT 
    'snapshot_multiplier_ranges field added to estimate table' as result,
    COUNT(*) as total_estimates
FROM botzilla.estimate;

