-- ============================================================================
-- Script: Agregar rol "operation manager"
-- Fecha: 2025-10-13
-- Descripción: Crea el nuevo rol "operation manager" que recibirá notificaciones
--              cuando lleguen nuevos jobs con estado "Requires Crew Lead"
-- ============================================================================

-- Agregar el nuevo rol "operation manager" (ID 4)
INSERT INTO botzilla.user_rol (id, name) 
VALUES (4, 'operation manager')
ON CONFLICT (id) DO NOTHING;

-- Actualizar la secuencia para que el próximo ID sea 5
SELECT setval('botzilla.user_rol_id_seq', 4, true);

-- ============================================================================
-- NOTA: Los usuarios con rol "operation_manager" deben estar asignados a 
--       branches específicos en la tabla "user_branch" para recibir 
--       notificaciones de jobs de esas branches.
-- ============================================================================

-- Para asignar un operation manager a un branch, usar:
-- INSERT INTO botzilla.user_branch (user_id, branch_id) VALUES (?, ?);
-- 
-- Ejemplo:
-- INSERT INTO botzilla.user_branch (user_id, branch_id) 
-- VALUES (1, 5); -- Asignar user_id 1 como operation manager de branch 5

