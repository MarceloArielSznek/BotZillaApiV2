-- Crear tabla para almacenar los tax rates de Washington por ZIP code
-- Ejecutar en la base de datos de producción

CREATE TABLE IF NOT EXISTS botzilla.wa_tax_rates (
    id SERIAL PRIMARY KEY,
    zip_code VARCHAR(10) NOT NULL,
    city_name VARCHAR(100),
    county_name VARCHAR(100),
    city_tax_rate DECIMAL(5, 4) NOT NULL,
    state_tax_rate DECIMAL(5, 4) DEFAULT 0.065 NOT NULL,
    total_tax_rate DECIMAL(5, 4) NOT NULL,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zip_code)
);

-- Índice para búsquedas rápidas por ZIP code
CREATE INDEX IF NOT EXISTS idx_wa_tax_rates_zip ON botzilla.wa_tax_rates(zip_code);

-- Comentarios
COMMENT ON TABLE botzilla.wa_tax_rates IS 'Tax rates de Washington State por ZIP code (State + City)';
COMMENT ON COLUMN botzilla.wa_tax_rates.city_tax_rate IS 'City tax rate (ejemplo: 0.037 para 3.7%)';
COMMENT ON COLUMN botzilla.wa_tax_rates.state_tax_rate IS 'State tax rate de WA (6.5% fijo)';
COMMENT ON COLUMN botzilla.wa_tax_rates.total_tax_rate IS 'Total tax rate (state + city)';

-- Insertar algunos tax rates iniciales de ciudades principales de WA
INSERT INTO botzilla.wa_tax_rates (zip_code, city_name, county_name, city_tax_rate, state_tax_rate, total_tax_rate, effective_date)
VALUES
    -- Seattle
    ('98101', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98102', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98103', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98104', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98105', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98106', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98107', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98108', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98109', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98112', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98115', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98116', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98117', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98118', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98119', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98121', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98122', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98125', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98126', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98133', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98134', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98136', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98144', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98146', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98154', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98164', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98174', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98177', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98178', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98195', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98199', 'Seattle', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    
    -- Everett
    ('98201', 'Everett', 'Snohomish', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98203', 'Everett', 'Snohomish', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98204', 'Everett', 'Snohomish', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98208', 'Everett', 'Snohomish', 0.0370, 0.065, 0.1020, '2024-01-01'),
    
    -- Bonney Lake (del ejemplo)
    ('98391', 'Bonney Lake', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    
    -- Tacoma
    ('98401', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98402', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98403', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98404', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98405', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98406', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98407', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98408', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98409', 'Tacoma', 'Pierce', 0.0370, 0.065, 0.1020, '2024-01-01'),
    
    -- Bellevue
    ('98004', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98005', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98006', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98007', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98008', 'Bellevue', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    
    -- Kent
    ('98030', 'Kent', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98031', 'Kent', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98032', 'Kent', 'King', 0.0370, 0.065, 0.1020, '2024-01-01'),
    ('98042', 'Kent', 'King', 0.0370, 0.065, 0.1020, '2024-01-01')
ON CONFLICT (zip_code) DO NOTHING;

-- Verificación
SELECT 'wa_tax_rates table created and populated with ' || COUNT(*) || ' records' as result
FROM botzilla.wa_tax_rates;

