-- Añadir la columna is_default a la tabla telegram_group
ALTER TABLE botzilla.telegram_group
ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN botzilla.telegram_group.is_default IS 'Indica si el grupo debe ser asignado por defecto durante el onboarding basado en la categoría y branch.';
