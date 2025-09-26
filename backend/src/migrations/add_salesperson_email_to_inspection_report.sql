-- Inicia una transacción segura
BEGIN;

-- Agregar la columna salesperson_email
ALTER TABLE botzilla.inspection_report
    ADD COLUMN salesperson_email VARCHAR(255);

-- Finaliza la transacción para guardar los cambios
COMMIT;
