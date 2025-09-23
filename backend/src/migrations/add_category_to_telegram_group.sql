-- Añadir la columna category_id a la tabla telegram_group
ALTER TABLE botzilla.telegram_group
ADD COLUMN category_id INTEGER;

-- Añadir la llave foránea para relacionar con la tabla de categorías
ALTER TABLE botzilla.telegram_group
ADD CONSTRAINT fk_telegram_group_category
FOREIGN KEY (category_id)
REFERENCES botzilla.telegram_group_category(id)
ON DELETE SET NULL; -- Si se borra una categoría, el campo en el grupo se pone nulo
