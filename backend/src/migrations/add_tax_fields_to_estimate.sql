-- Agregar campos de tax a la tabla estimate
-- Ejecutar en la base de datos de producción

-- Agregar columnas de tax
ALTER TABLE botzilla.estimate
ADD COLUMN IF NOT EXISTS city_tax_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS state_tax_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS total_tax_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS city_tax_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS state_tax_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS total_tax_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_before_taxes DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_after_taxes DECIMAL(10, 2);

-- Comentarios
COMMENT ON COLUMN botzilla.estimate.city_tax_rate IS 'City tax rate (ejemplo: 0.037 para 3.7%)';
COMMENT ON COLUMN botzilla.estimate.state_tax_rate IS 'State tax rate (0.065 para 6.5% en WA)';
COMMENT ON COLUMN botzilla.estimate.total_tax_rate IS 'Total tax rate (city + state)';
COMMENT ON COLUMN botzilla.estimate.city_tax_amount IS 'Monto de city tax calculado';
COMMENT ON COLUMN botzilla.estimate.state_tax_amount IS 'Monto de state tax calculado';
COMMENT ON COLUMN botzilla.estimate.total_tax_amount IS 'Monto total de taxes (city + state)';
COMMENT ON COLUMN botzilla.estimate.price_before_taxes IS 'Precio final antes de aplicar taxes';
COMMENT ON COLUMN botzilla.estimate.price_after_taxes IS 'Precio final después de aplicar taxes';

-- Verificación
SELECT 
    'Tax fields added to estimate table' as result,
    COUNT(*) as total_estimates
FROM botzilla.estimate;

