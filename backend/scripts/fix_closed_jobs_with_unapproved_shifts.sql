-- ===============================================================
-- FIX: Jobs en "Closed Job" con shifts no aprobados
-- ===============================================================
-- Estos jobs deberían estar en "Shifts Approval", no en "Job List"
-- Este script los mueve a "In Progress" con performance_status = 'pending_approval'
-- ===============================================================

BEGIN;

-- 1. Actualizar special shifts que tienen approved = NULL a approved = false
UPDATE botzilla.job_special_shift 
SET approved = false 
WHERE approved IS NULL;

-- 2. Cambiar los 11 jobs problemáticos a "In Progress" y pending_approval
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 387; -- James Sheldon - VIS
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 364; -- Ian Caudill - EC
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 376; -- Steven Buehler - SD
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 372; -- Cristina Gurtman - SD
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 374; -- Ronald Parmley - CV#2
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 597; -- Brandi Whitney
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 599; -- Anthony Rodgers
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 602; -- Rich Mayhew
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 603; -- Adams Ave Park HOA
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 598; -- Edgar Manriquez
UPDATE botzilla.job SET status_id = 1, performance_status = 'pending_approval' WHERE id = 368; -- Joanna Mckim - SD

-- 3. Verificar cambios
SELECT 
    j.id,
    j.name,
    js.name as status,
    j.performance_status,
    COUNT(DISTINCT s.crew_member_id) as regular_shifts,
    COUNT(DISTINCT jss.special_shift_id) as special_shifts
FROM botzilla.job j
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
LEFT JOIN botzilla.shift s ON j.id = s.job_id
LEFT JOIN botzilla.job_special_shift jss ON j.id = jss.job_id
WHERE j.id IN (387, 364, 376, 372, 374, 597, 599, 602, 603, 598, 368)
GROUP BY j.id, j.name, js.name, j.performance_status
ORDER BY j.id;

COMMIT;

-- ===============================================================
-- Resultado esperado:
-- ✅ 11 jobs movidos a "In Progress" con performance_status = 'pending_approval'
-- ✅ Special shifts con approved = false explícitamente
-- ✅ Jobs ahora aparecerán en "Shifts Approval" en el frontend
-- ===============================================================

