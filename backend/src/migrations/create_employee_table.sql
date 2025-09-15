-- Migración para crear la tabla employee
-- Ejecutar: psql -U postgres -d postgres -f src/migrations/create_employee_table.sql

-- Crear la tabla employee en el schema botzilla
CREATE TABLE IF NOT EXISTS botzilla.employee (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    nickname VARCHAR(30),
    email VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    telegram_id VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'rejected')),
    registration_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_date TIMESTAMP WITH TIME ZONE,
    approved_by INTEGER REFERENCES botzilla.user(id),
    notes TEXT,
    employee_code VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_email ON botzilla.employee (email);
CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_telegram_id ON botzilla.employee (telegram_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_code ON botzilla.employee (employee_code) WHERE employee_code IS NOT NULL;

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_employee_status ON botzilla.employee (status);
CREATE INDEX IF NOT EXISTS idx_employee_registration_date ON botzilla.employee (registration_date);
CREATE INDEX IF NOT EXISTS idx_employee_full_name ON botzilla.employee (first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_employee_approved_by ON botzilla.employee (approved_by);

-- Agregar comentarios a la tabla y columnas
COMMENT ON TABLE botzilla.employee IS 'Tabla para almacenar información de empleados registrados';
COMMENT ON COLUMN botzilla.employee.id IS 'ID único del empleado';
COMMENT ON COLUMN botzilla.employee.first_name IS 'Nombre del empleado';
COMMENT ON COLUMN botzilla.employee.last_name IS 'Apellido del empleado';
COMMENT ON COLUMN botzilla.employee.nickname IS 'Apodo o nombre preferido del empleado';
COMMENT ON COLUMN botzilla.employee.email IS 'Dirección de correo electrónico única del empleado';
COMMENT ON COLUMN botzilla.employee.phone_number IS 'Número de teléfono del empleado';
COMMENT ON COLUMN botzilla.employee.telegram_id IS 'ID único de Telegram del empleado';
COMMENT ON COLUMN botzilla.employee.status IS 'Estado del empleado: pending, active, inactive, rejected';
COMMENT ON COLUMN botzilla.employee.registration_date IS 'Fecha y hora de registro del empleado';
COMMENT ON COLUMN botzilla.employee.approved_date IS 'Fecha y hora de aprobación del empleado';
COMMENT ON COLUMN botzilla.employee.approved_by IS 'ID del usuario que aprobó al empleado';
COMMENT ON COLUMN botzilla.employee.notes IS 'Notas adicionales sobre el empleado';
COMMENT ON COLUMN botzilla.employee.employee_code IS 'Código único del empleado para identificación interna';
COMMENT ON COLUMN botzilla.employee.created_at IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN botzilla.employee.updated_at IS 'Fecha y hora de última actualización del registro';

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION botzilla.update_employee_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER trigger_update_employee_updated_at
    BEFORE UPDATE ON botzilla.employee
    FOR EACH ROW
    EXECUTE FUNCTION botzilla.update_employee_updated_at();

-- Insertar datos de ejemplo para testing (opcional)
-- INSERT INTO botzilla.employee (
--     first_name, 
--     last_name, 
--     nickname, 
--     email, 
--     phone_number, 
--     telegram_id, 
--     status,
--     employee_code,
--     notes
-- ) VALUES 
-- ('John', 'Doe', 'Johnny', 'john.doe@example.com', '+1234567890', '123456789', 'pending', 'EMPJD001', 'Employee de prueba'),
-- ('Jane', 'Smith', NULL, 'jane.smith@example.com', '+1234567891', '123456790', 'active', 'EMPJS002', 'Employee activo de prueba');

-- Mostrar información de la tabla creada
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'employee'
ORDER BY ordinal_position;

PRINT 'Tabla employee creada exitosamente en el schema botzilla';
