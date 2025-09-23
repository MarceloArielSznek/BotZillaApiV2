-- =====================================================================
-- SCRIPT DE MIGRACIÓN PARA PRODUCCIÓN - ONBOARDING DE EMPLEADOS
-- =====================================================================
-- Este script contiene todos los cambios necesarios en la base de datos
-- para implementar la funcionalidad de onboarding de empleados.
-- Es seguro ejecutarlo varias veces; solo aplicará los cambios que no existan.
-- =====================================================================

BEGIN;

-- 1. Crear la tabla para las categorías de los grupos de Telegram
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS botzilla.telegram_group_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE botzilla.telegram_group_category IS 'Categorías para organizar los grupos de Telegram (ej. Sales, Crew Leaders).';

-- Insertar categorías por defecto si no existen
INSERT INTO botzilla.telegram_group_category (name) VALUES
('Sales'),
('Crew Members'),
('Crew Leaders'),
('General')
ON CONFLICT (name) DO NOTHING;


-- 2. Crear la tabla principal para los grupos de Telegram
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS botzilla.telegram_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    branch_id INTEGER,
    telegram_id BIGINT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_branch
        FOREIGN KEY(branch_id) 
        REFERENCES botzilla.branch(id)
        ON DELETE SET NULL
);

COMMENT ON TABLE botzilla.telegram_group IS 'Almacena la información de los grupos de Telegram utilizados en el sistema.';


-- 3. Crear la tabla para los estados de membresía en los grupos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS botzilla.group_membership_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

COMMENT ON TABLE botzilla.group_membership_status IS 'Define los estados de un empleado en un grupo (ej. member, blocked).';

-- Insertar estados por defecto si no existen
INSERT INTO botzilla.group_membership_status (name) VALUES 
('member'), 
('blocked')
ON CONFLICT (name) DO NOTHING;


-- 4. Crear la tabla intermedia para la relación Empleado <-> Grupo
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS botzilla.employee_telegram_group (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    telegram_group_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    blocked_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_employee
        FOREIGN KEY(employee_id) 
        REFERENCES botzilla.employee(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_telegram_group
        FOREIGN KEY(telegram_group_id) 
        REFERENCES botzilla.telegram_group(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_status
        FOREIGN KEY(status_id)
        REFERENCES botzilla.group_membership_status(id),
    
    UNIQUE (employee_id, telegram_group_id)
);

COMMENT ON TABLE botzilla.employee_telegram_group IS 'Tabla de unión que registra qué empleados pertenecen a qué grupos de Telegram.';


-- 5. Modificar la tabla telegram_group para añadir las nuevas columnas
-- ---------------------------------------------------------------------

-- Añadir columna category_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'botzilla' AND table_name = 'telegram_group' AND column_name = 'category_id') THEN
        ALTER TABLE botzilla.telegram_group ADD COLUMN category_id INTEGER;
        ALTER TABLE botzilla.telegram_group ADD CONSTRAINT fk_telegram_group_category FOREIGN KEY (category_id) REFERENCES botzilla.telegram_group_category(id) ON DELETE SET NULL;
        COMMENT ON COLUMN botzilla.telegram_group.category_id IS 'ID de la categoría a la que pertenece el grupo.';
    END IF;
END $$;


-- Añadir columna is_default si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'botzilla' AND table_name = 'telegram_group' AND column_name = 'is_default') THEN
        ALTER TABLE botzilla.telegram_group ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN botzilla.telegram_group.is_default IS 'Indica si el grupo debe ser asignado por defecto durante el onboarding.';
    END IF;
END $$;


COMMIT;

-- =====================================================================
-- FIN DEL SCRIPT
-- =====================================================================
