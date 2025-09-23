CREATE TABLE botzilla.telegram_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    branch_id INTEGER,
    telegram_id BIGINT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_branch
        FOREIGN KEY(branch_id) 
        REFERENCES botzilla.branch(id)
        ON DELETE SET NULL
);
