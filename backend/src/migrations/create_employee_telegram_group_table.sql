CREATE TABLE botzilla.employee_telegram_group (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    telegram_group_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    blocked_at TIMESTAMP WITH TIME ZONE,
    
    -- Llaves foráneas y restricciones
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
    
    -- Aseguramos que un empleado solo pueda estar una vez por grupo
    UNIQUE (employee_id, telegram_group_id)
);
