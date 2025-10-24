-- Verificar el estado actual de los jobs
SELECT 
    j.id,
    j.name,
    j.crew_leader_id,
    j.notification_sent,
    j.last_notification_sent_at,
    js.id as status_id,
    js.name as status_name,
    j.last_known_status_id
FROM botzilla.job j
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
WHERE j.id IN (754, 817)
ORDER BY j.id;
