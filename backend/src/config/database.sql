-- Create and use Botzilla schema
DROP SCHEMA IF EXISTS botzilla CASCADE;
CREATE SCHEMA botzilla;
SET search_path TO botzilla;

-- Drop tables if they exist
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS job_special_shift;
DROP TABLE IF EXISTS special_shift;
DROP TABLE IF EXISTS shift;
DROP TABLE IF EXISTS job;
DROP TABLE IF EXISTS crew_member_branch;
DROP TABLE IF EXISTS crew_member;
DROP TABLE IF EXISTS user_rol;
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS sales_person_branch;
DROP TABLE IF EXISTS branch;
DROP TABLE IF EXISTS estimate;
DROP TABLE IF EXISTS estimate_status;
DROP TABLE IF EXISTS warning;
DROP TABLE IF EXISTS warning_reason;
DROP TABLE IF EXISTS sales_person;
DROP TABLE IF EXISTS notification_templates;
DROP TABLE IF EXISTS notification_type;
DROP TABLE IF EXISTS sheet_column_map;
DROP TABLE IF EXISTS automation_error_log;

-- Create tables
CREATE TABLE warning_reason (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE sales_person (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    telegram_id VARCHAR(50),
    warning_count INTEGER DEFAULT 0
);

CREATE TABLE warning (
    id SERIAL PRIMARY KEY,
    sales_person_id INTEGER REFERENCES sales_person(id),
    reason_id INTEGER REFERENCES warning_reason(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE estimate_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE branch (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT
);

CREATE TABLE estimate (
    id SERIAL PRIMARY KEY,
    attic_tech_estimate_id INTEGER UNIQUE,
    name VARCHAR(200),
    customer_name VARCHAR(200),
    customer_address TEXT,
    crew_notes TEXT,
    sales_person_id INTEGER REFERENCES sales_person(id),
    status_id INTEGER REFERENCES estimate_status(id),
    branch_id INTEGER REFERENCES branch(id),
    price DECIMAL(10,2),
    retail_cost DECIMAL(10,2),
    final_price DECIMAL(10,2),
    sub_service_retail_cost DECIMAL(10,2),
    discount DECIMAL(10,2),
    attic_tech_hours INTEGER,
    -- Timestamps de Attic Tech para auditoría
    at_created_date TIMESTAMP,
    at_updated_date TIMESTAMP,
    -- Timestamps de nuestra base de datos (gestionados por Sequelize)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sales_person_branch (
    id SERIAL PRIMARY KEY,
    sales_person_id INT NOT NULL,
    branch_id INT NOT NULL,
    FOREIGN KEY (sales_person_id) REFERENCES botzilla.sales_person(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES botzilla.branch(id) ON DELETE CASCADE,
    UNIQUE (sales_person_id, branch_id)
);

CREATE TABLE user_rol (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    rol_id INTEGER REFERENCES user_rol(id),
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    telegram_id VARCHAR(50)
);

CREATE TABLE crew_member (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20),
    telegram_id VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    is_leader BOOLEAN DEFAULT false
);

CREATE TABLE crew_member_branch (
    crew_member_id INTEGER REFERENCES crew_member(id),
    branch_id INTEGER REFERENCES branch(id),
    PRIMARY KEY (crew_member_id, branch_id)
);

-- Junction table for User and Branch (Many-to-Many)
CREATE TABLE botzilla.user_branch (
    user_id INTEGER NOT NULL REFERENCES botzilla.user(id) ON UPDATE CASCADE ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES botzilla.branch(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE job (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    closing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimate_id INTEGER REFERENCES estimate(id),
    crew_leader_id INTEGER REFERENCES crew_member(id),
    branch_id INTEGER REFERENCES branch(id),
    note TEXT,
    review INTEGER CHECK (review >= 0 AND review <= 5),
    attic_tech_hours INTEGER,
    crew_leader_hours INTEGER
);

CREATE TABLE shift (
    crew_member_id INTEGER REFERENCES crew_member(id),
    job_id INTEGER REFERENCES job(id),
    hours INTEGER NOT NULL,
    PRIMARY KEY (crew_member_id, job_id)
);

CREATE TABLE special_shift (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE job_special_shift (
    special_shift_id INTEGER REFERENCES special_shift(id),
    job_id INTEGER REFERENCES job(id),
    date DATE NOT NULL,
    hours INTEGER NOT NULL,
    PRIMARY KEY (special_shift_id, job_id, date)
);

-- Table for logging sent notifications
CREATE TABLE IF NOT EXISTS botzilla.notification (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    recipient_type VARCHAR(50) NOT NULL, -- 'sales_person', 'manager', etc.
    recipient_id INTEGER,
    notification_type_id INTEGER REFERENCES botzilla.notification_type(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL -- 'warning', 'congratulations', 'manager_alert', etc.
);

CREATE TABLE notification_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    notification_type_id INTEGER NOT NULL REFERENCES notification_type(id),
    level INTEGER,
    template_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS botzilla.sheet_column_map (
    id SERIAL PRIMARY KEY,
    sheet_name TEXT NOT NULL,
    field_name TEXT NOT NULL,
    column_index INT NOT NULL,
    type TEXT NOT NULL,
    UNIQUE(sheet_name, field_name)
);

-- Crear tabla para los errores de automatización
CREATE TABLE IF NOT EXISTS botzilla.automation_error_log (
    id SERIAL PRIMARY KEY,
    sheet_name VARCHAR(255) NOT NULL,
    row_number INT NOT NULL,
    error_type VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    raw_data JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_estimate_sales_person ON estimate(sales_person_id);
CREATE INDEX idx_estimate_status ON estimate(status_id);
CREATE INDEX idx_estimate_branch ON estimate(branch_id);
CREATE INDEX idx_job_estimate ON job(estimate_id);
CREATE INDEX idx_job_crew_leader ON job(crew_leader_id);
CREATE INDEX idx_notification_recipient ON notification(recipient_type, recipient_id);
CREATE INDEX idx_notification_created_at ON notification(created_at);

-- Insert basic roles
INSERT INTO user_rol (name) VALUES 
    ('admin'),
    ('manager'),
    ('supervisor');

-- Insert basic estimate statuses
INSERT INTO estimate_status (name) VALUES 
    ('pending'),
    ('active'),
    ('released'),
    ('completed'),
    ('cancelled');

-- Insert basic special shifts
INSERT INTO special_shift (name) VALUES 
    ('warranty'),
    ('sub_contractor'),
    ('complain'),
    ('quality_check'),
    ('delivery');

-- Insert basic warning reasons
INSERT INTO warning_reason (name) VALUES 
    ('missed_appointment'),
    ('late_submission'),
    ('incomplete_documentation'),
    ('customer_complaint'),
    ('policy_violation'),
    ('Exceeded Active Lead Limit'),
    ('Reduced Active Lead Count');

-- Insert notification types
INSERT INTO notification_type (name) VALUES
    ('warning'),
    ('congratulations'),
    ('manager_alert');

-- Insert notification templates
INSERT INTO notification_templates (name, notification_type_id, level, template_text) VALUES
    ('warning_level_1', 1, 1, '🚨 **Warning 1: High Active Lead Count** 🚨\n\nHi {{salesperson_name}}, this is a friendly reminder. You currently have {{active_leads_count}} active leads, which is above the limit of 12. Please take action to manage your leads.'),
    ('warning_level_2', 1, 2, '⚠️ **Warning 2: Action Required** ⚠️\n\n{{salesperson_name}}, this is your second warning. You currently have {{active_leads_count}} active leads. Your manager has been notified. Please prioritize reducing your active leads.'),
    ('warning_level_3_plus', 1, 3, '🔥 **Final Warning ({{warning_count}}): Immediate Action Required** 🔥\n\n{{salesperson_name}}, this is a serious alert. You have {{active_leads_count}} active leads. This requires your immediate attention to avoid further escalation.'),
    ('congratulations_reset', 2, null, '🎉 Great job {{salesperson_name}}! You''ve brought your active leads down to {{active_leads_count}}. Your warning count has been reset. Keep up the excellent work!');


-- Grant permissions (adjust according to your needs)
GRANT USAGE ON SCHEMA botzilla TO your_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA botzilla TO your_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA botzilla TO your_app_user; 