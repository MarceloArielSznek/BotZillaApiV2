-- Verificar cuántos estimates tienen snapshot vs no tienen

-- Total de estimates
SELECT 
    COUNT(*) as total_estimates,
    COUNT(snapshot_multiplier_ranges) as with_snapshot,
    COUNT(*) - COUNT(snapshot_multiplier_ranges) as without_snapshot,
    ROUND(COUNT(snapshot_multiplier_ranges)::numeric / COUNT(*)::numeric * 100, 2) as percentage_with_snapshot
FROM botzilla.estimate;

-- Ver algunos ejemplos de estimates SIN snapshot
SELECT 
    id,
    name,
    attic_tech_estimate_id,
    price,
    created_at,
    updated_at,
    CASE 
        WHEN snapshot_multiplier_ranges IS NULL THEN '❌ No snapshot'
        ELSE '✅ Has snapshot'
    END as snapshot_status
FROM botzilla.estimate
WHERE snapshot_multiplier_ranges IS NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Ver algunos ejemplos de estimates CON snapshot
SELECT 
    id,
    name,
    attic_tech_estimate_id,
    price,
    created_at,
    jsonb_array_length(snapshot_multiplier_ranges) as num_ranges,
    CASE 
        WHEN snapshot_multiplier_ranges IS NULL THEN '❌ No snapshot'
        ELSE '✅ Has snapshot'
    END as snapshot_status
FROM botzilla.estimate
WHERE snapshot_multiplier_ranges IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

