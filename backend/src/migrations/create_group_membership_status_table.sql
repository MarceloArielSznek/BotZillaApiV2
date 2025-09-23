-- 1. Crear la tabla de estados
CREATE TABLE botzilla.group_membership_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- 2. Insertar los estados iniciales
INSERT INTO botzilla.group_membership_status (name) VALUES ('member'), ('blocked');
