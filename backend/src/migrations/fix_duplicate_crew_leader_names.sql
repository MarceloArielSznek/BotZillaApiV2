-- Migración para corregir crew leaders con nombres duplicados
-- Ejemplo: first_name='Malik', last_name='Malik' → first_name='Malik', last_name=''
-- 
-- Este problema ocurrió porque anteriormente cuando solo venía un nombre del spreadsheet,
-- se guardaba el mismo valor en first_name y last_name

-- Paso 1: Ver cuántos employees tienen el problema
SELECT 
    id,
    first_name,
    last_name,
    email,
    role,
    CONCAT(first_name, ' ', last_name) as full_name
FROM botzilla.employee
WHERE first_name = last_name
AND first_name IS NOT NULL
AND last_name IS NOT NULL
AND is_deleted = false
ORDER BY first_name;

-- Paso 2: Corregir los employees con apellido duplicado
-- Comentar la consulta SELECT de arriba y ejecutar esta UPDATE:
/*
UPDATE botzilla.employee
SET last_name = ''
WHERE first_name = last_name
AND first_name IS NOT NULL
AND last_name IS NOT NULL
AND is_deleted = false;

-- Verificar los cambios
SELECT 
    id,
    first_name,
    last_name,
    email,
    role,
    CONCAT(first_name, ' ', last_name) as full_name
FROM botzilla.employee
WHERE last_name = ''
AND is_deleted = false
ORDER BY first_name;
*/

