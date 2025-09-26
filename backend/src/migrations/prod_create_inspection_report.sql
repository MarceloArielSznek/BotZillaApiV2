-- =====================================================================
-- SCRIPT DE PRODUCCIÓN PARA LA TABLA: inspection_report
-- =====================================================================
-- Este script crea la tabla 'inspection_report' con su estructura final,
-- incluyendo todas las modificaciones (columnas booleanas, valores por defecto, etc.).
-- Ejecutar este script en el servidor de producción ANTES de importar los datos.
-- =====================================================================

BEGIN;

-- Crear la tabla para almacenar los reportes de inspección
CREATE TABLE IF NOT EXISTS botzilla.inspection_report (
    id SERIAL PRIMARY KEY,
    attic_tech_report_id INTEGER UNIQUE NOT NULL,
    attic_tech_estimate_id INTEGER NOT NULL,
    
    -- Datos del Estimate, Cliente y Vendedor
    estimate_name VARCHAR(255),
    salesperson_name VARCHAR(255),
    salesperson_email VARCHAR(255),
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    client_email VARCHAR(255),
    client_address TEXT,
    branch_name VARCHAR(255),
    estimate_link TEXT,
    
    -- Datos de la Inspección de Techo (Roof)
    roof_material VARCHAR(100),
    decking_type VARCHAR(100),
    roof_age VARCHAR(50),
    walkable_roof VARCHAR(50),
    roof_condition VARCHAR(100),
    full_roof_inspection_interest BOOLEAN DEFAULT false,
    
    -- Datos de la Inspección de HVAC
    customer_comfort VARCHAR(100),
    hvac_age VARCHAR(50),
    system_condition VARCHAR(100),
    air_ducts_condition VARCHAR(100),
    full_hvac_furnace_inspection_interest BOOLEAN DEFAULT false,
    
    -- Control de Notificaciones y Timestamps
    roof_notification_sent BOOLEAN DEFAULT false NOT NULL,
    hvac_notification_sent BOOLEAN DEFAULT false NOT NULL,
    attic_tech_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar las búsquedas
CREATE INDEX IF NOT EXISTS idx_ir_attic_tech_report_id ON botzilla.inspection_report(attic_tech_report_id);
CREATE INDEX IF NOT EXISTS idx_ir_attic_tech_estimate_id ON botzilla.inspection_report(attic_tech_estimate_id);
CREATE INDEX IF NOT EXISTS idx_ir_attic_tech_created_at ON botzilla.inspection_report(attic_tech_created_at);

COMMIT;
