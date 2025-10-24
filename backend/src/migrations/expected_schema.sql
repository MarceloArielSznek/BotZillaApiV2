--
-- PostgreSQL database dump
--

\restrict 4pih0HgbCL4lKv9cIHF6kdP3urXDzAEplgkwcYs698tgAIccRpR9C0K9nQba2FD

-- Dumped from database version 14.19 (Homebrew)
-- Dumped by pg_dump version 14.19 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: botzilla; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA botzilla;


ALTER SCHEMA botzilla OWNER TO postgres;

--
-- Name: update_employee_updated_at(); Type: FUNCTION; Schema: botzilla; Owner: postgres
--

CREATE FUNCTION botzilla.update_employee_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION botzilla.update_employee_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: branch; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.branch (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    address text,
    telegram_group_id text
);


ALTER TABLE botzilla.branch OWNER TO postgres;

--
-- Name: branch_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.branch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.branch_id_seq OWNER TO postgres;

--
-- Name: branch_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.branch_id_seq OWNED BY botzilla.branch.id;


--
-- Name: crew_member; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.crew_member (
    id integer NOT NULL,
    phone character varying(20),
    telegram_id character varying(50),
    name character varying(100) NOT NULL,
    is_leader boolean DEFAULT false,
    animal character varying(50),
    employee_id integer
);


ALTER TABLE botzilla.crew_member OWNER TO postgres;

--
-- Name: crew_member_branch; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.crew_member_branch (
    crew_member_id integer NOT NULL,
    branch_id integer NOT NULL
);


ALTER TABLE botzilla.crew_member_branch OWNER TO postgres;

--
-- Name: crew_member_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.crew_member_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.crew_member_id_seq OWNER TO postgres;

--
-- Name: crew_member_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.crew_member_id_seq OWNED BY botzilla.crew_member.id;


--
-- Name: employee; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.employee (
    id integer NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    nickname character varying(30),
    email character varying(100) NOT NULL,
    phone_number character varying(20),
    telegram_id character varying(20),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    registration_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_date timestamp with time zone,
    approved_by integer,
    notes text,
    employee_code character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    street character varying(200),
    city character varying(100),
    state character varying(50),
    zip character varying(20),
    date_of_birth date,
    role character varying(20),
    branch_id integer,
    attic_tech_user_id integer,
    CONSTRAINT employee_role_check CHECK (((role)::text = ANY ((ARRAY['crew_member'::character varying, 'crew_leader'::character varying, 'salesperson'::character varying])::text[]))),
    CONSTRAINT employee_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('active'::character varying)::text, ('inactive'::character varying)::text, ('rejected'::character varying)::text])))
);


ALTER TABLE botzilla.employee OWNER TO postgres;

--
-- Name: TABLE employee; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON TABLE botzilla.employee IS 'Tabla para almacenar información de empleados registrados';


--
-- Name: COLUMN employee.id; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.id IS 'ID único del empleado';


--
-- Name: COLUMN employee.first_name; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.first_name IS 'Nombre del empleado';


--
-- Name: COLUMN employee.last_name; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.last_name IS 'Apellido del empleado';


--
-- Name: COLUMN employee.nickname; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.nickname IS 'Apodo o nombre preferido del empleado';


--
-- Name: COLUMN employee.email; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.email IS 'Dirección de correo electrónico única del empleado';


--
-- Name: COLUMN employee.phone_number; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.phone_number IS 'Opcional para pending, requerido al activar';


--
-- Name: COLUMN employee.telegram_id; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.telegram_id IS 'Opcional para pending, requerido al activar';


--
-- Name: COLUMN employee.status; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.status IS 'Estado del empleado: pending, active, inactive, rejected';


--
-- Name: COLUMN employee.registration_date; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.registration_date IS 'Fecha y hora de registro del empleado';


--
-- Name: COLUMN employee.approved_date; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.approved_date IS 'Fecha y hora de aprobación del empleado';


--
-- Name: COLUMN employee.approved_by; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.approved_by IS 'ID del usuario que aprobó al empleado';


--
-- Name: COLUMN employee.notes; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.notes IS 'Notas adicionales sobre el empleado';


--
-- Name: COLUMN employee.employee_code; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.employee_code IS 'Código único del empleado para identificación interna';


--
-- Name: COLUMN employee.created_at; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.created_at IS 'Fecha y hora de creación del registro';


--
-- Name: COLUMN employee.updated_at; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.updated_at IS 'Fecha y hora de última actualización del registro';


--
-- Name: COLUMN employee.street; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.street IS 'Employee street address';


--
-- Name: COLUMN employee.city; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.city IS 'Employee city';


--
-- Name: COLUMN employee.state; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.state IS 'Employee state';


--
-- Name: COLUMN employee.zip; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.zip IS 'Employee zip code';


--
-- Name: COLUMN employee.date_of_birth; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.date_of_birth IS 'Employee date of birth (must be at least 16 years old)';


--
-- Name: COLUMN employee.role; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.role IS 'Employee role: crew_member, crew_leader, or salesperson';


--
-- Name: COLUMN employee.attic_tech_user_id; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.employee.attic_tech_user_id IS 'ID del usuario en Attic Tech (para sincronización)';


--
-- Name: employee_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.employee_id_seq OWNER TO postgres;

--
-- Name: employee_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.employee_id_seq OWNED BY botzilla.employee.id;


--
-- Name: employee_telegram_group; Type: TABLE; Schema: botzilla; Owner: marce
--

CREATE TABLE botzilla.employee_telegram_group (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    telegram_group_id integer NOT NULL,
    status_id integer NOT NULL,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    blocked_at timestamp with time zone
);


ALTER TABLE botzilla.employee_telegram_group OWNER TO marce;

--
-- Name: employee_telegram_group_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: marce
--

CREATE SEQUENCE botzilla.employee_telegram_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.employee_telegram_group_id_seq OWNER TO marce;

--
-- Name: employee_telegram_group_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: marce
--

ALTER SEQUENCE botzilla.employee_telegram_group_id_seq OWNED BY botzilla.employee_telegram_group.id;


--
-- Name: estimate; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.estimate (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    sales_person_id integer,
    status_id integer,
    branch_id integer,
    price numeric(10,2),
    discount numeric(10,2),
    attic_tech_hours numeric(10,2),
    attic_tech_estimate_id integer,
    customer_name character varying(200),
    customer_address text,
    crew_notes text,
    retail_cost numeric(10,2),
    final_price numeric(10,2),
    sub_service_retail_cost numeric(10,2),
    at_updated_date timestamp without time zone,
    at_created_date timestamp without time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    customer_email character varying(200),
    customer_phone character varying(50)
);


ALTER TABLE botzilla.estimate OWNER TO postgres;

--
-- Name: estimate_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.estimate_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.estimate_id_seq OWNER TO postgres;

--
-- Name: estimate_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.estimate_id_seq OWNED BY botzilla.estimate.id;


--
-- Name: estimate_status; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.estimate_status (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE botzilla.estimate_status OWNER TO postgres;

--
-- Name: estimate_status_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.estimate_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.estimate_status_id_seq OWNER TO postgres;

--
-- Name: estimate_status_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.estimate_status_id_seq OWNED BY botzilla.estimate_status.id;


--
-- Name: group_membership_status; Type: TABLE; Schema: botzilla; Owner: marce
--

CREATE TABLE botzilla.group_membership_status (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE botzilla.group_membership_status OWNER TO marce;

--
-- Name: group_membership_status_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: marce
--

CREATE SEQUENCE botzilla.group_membership_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.group_membership_status_id_seq OWNER TO marce;

--
-- Name: group_membership_status_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: marce
--

ALTER SEQUENCE botzilla.group_membership_status_id_seq OWNED BY botzilla.group_membership_status.id;


--
-- Name: inspection_report; Type: TABLE; Schema: botzilla; Owner: marce
--

CREATE TABLE botzilla.inspection_report (
    id integer NOT NULL,
    attic_tech_report_id integer NOT NULL,
    attic_tech_estimate_id integer NOT NULL,
    estimate_name character varying(255),
    salesperson_name character varying(255),
    client_name character varying(255),
    client_phone character varying(50),
    client_email character varying(255),
    client_address text,
    branch_name character varying(255),
    estimate_link text,
    roof_material character varying(100),
    decking_type character varying(100),
    roof_age character varying(50),
    walkable_roof character varying(50),
    roof_condition character varying(100),
    full_roof_inspection_interest boolean DEFAULT false,
    customer_comfort character varying(100),
    hvac_age character varying(50),
    system_condition character varying(100),
    air_ducts_condition character varying(100),
    full_hvac_furnace_inspection_interest boolean DEFAULT false,
    roof_notification_sent boolean DEFAULT false NOT NULL,
    hvac_notification_sent boolean DEFAULT false NOT NULL,
    attic_tech_created_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    salesperson_email character varying(255)
);


ALTER TABLE botzilla.inspection_report OWNER TO marce;

--
-- Name: inspection_report_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: marce
--

CREATE SEQUENCE botzilla.inspection_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.inspection_report_id_seq OWNER TO marce;

--
-- Name: inspection_report_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: marce
--

ALTER SEQUENCE botzilla.inspection_report_id_seq OWNED BY botzilla.inspection_report.id;


--
-- Name: job; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.job (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    closing_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estimate_id integer,
    crew_leader_id integer,
    branch_id integer,
    note text,
    review integer,
    attic_tech_hours numeric(10,2),
    crew_leader_hours numeric(10,2),
    notification_sent boolean DEFAULT false NOT NULL,
    cl_estimated_plan_hours numeric(10,2) DEFAULT NULL::numeric,
    status_id integer,
    attic_tech_job_id integer,
    last_synced_at timestamp without time zone,
    attic_tech_estimate_id integer,
    last_known_status_id integer,
    last_notification_sent_at timestamp without time zone,
    CONSTRAINT job_review_check CHECK (((review >= 0) AND (review <= 5)))
);


ALTER TABLE botzilla.job OWNER TO postgres;

--
-- Name: job_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.job_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.job_id_seq OWNER TO postgres;

--
-- Name: job_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.job_id_seq OWNED BY botzilla.job.id;


--
-- Name: job_special_shift; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.job_special_shift (
    special_shift_id integer NOT NULL,
    job_id integer NOT NULL,
    date date NOT NULL,
    hours numeric(10,2) NOT NULL,
    approved_shift boolean DEFAULT false NOT NULL
);


ALTER TABLE botzilla.job_special_shift OWNER TO postgres;

--
-- Name: COLUMN job_special_shift.approved_shift; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.job_special_shift.approved_shift IS 'Indica si el special shift ha sido aprobado manualmente por un usuario';


--
-- Name: job_state_change_log; Type: TABLE; Schema: botzilla; Owner: marce
--

CREATE TABLE botzilla.job_state_change_log (
    id integer NOT NULL,
    job_sync_id integer,
    attic_tech_job_id integer NOT NULL,
    previous_status_id integer,
    new_status_id integer,
    notified_user_type character varying(50),
    notified_user_id integer,
    notified_telegram_id character varying(20),
    changed_at timestamp without time zone DEFAULT now(),
    change_metadata jsonb
);


ALTER TABLE botzilla.job_state_change_log OWNER TO marce;

--
-- Name: job_state_change_log_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: marce
--

CREATE SEQUENCE botzilla.job_state_change_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.job_state_change_log_id_seq OWNER TO marce;

--
-- Name: job_state_change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: marce
--

ALTER SEQUENCE botzilla.job_state_change_log_id_seq OWNED BY botzilla.job_state_change_log.id;


--
-- Name: job_status; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.job_status (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE botzilla.job_status OWNER TO postgres;

--
-- Name: job_status_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.job_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.job_status_id_seq OWNER TO postgres;

--
-- Name: job_status_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.job_status_id_seq OWNED BY botzilla.job_status.id;


--
-- Name: notification; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.notification (
    id integer NOT NULL,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    recipient_type character varying(20) NOT NULL,
    recipient_id integer NOT NULL,
    read_at timestamp without time zone,
    sent_to_telegram boolean DEFAULT false,
    notification_type_id integer,
    CONSTRAINT notification_recipient_type_check CHECK (((recipient_type)::text = ANY (ARRAY[('user'::character varying)::text, ('sales_person'::character varying)::text, ('crew_member'::character varying)::text])))
);


ALTER TABLE botzilla.notification OWNER TO postgres;

--
-- Name: notification_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.notification_id_seq OWNER TO postgres;

--
-- Name: notification_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.notification_id_seq OWNED BY botzilla.notification.id;


--
-- Name: notification_templates; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.notification_templates (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    notification_type_id integer NOT NULL,
    level integer,
    template_text text NOT NULL
);


ALTER TABLE botzilla.notification_templates OWNER TO postgres;

--
-- Name: notification_templates_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.notification_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.notification_templates_id_seq OWNER TO postgres;

--
-- Name: notification_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.notification_templates_id_seq OWNED BY botzilla.notification_templates.id;


--
-- Name: notification_type; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.notification_type (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE botzilla.notification_type OWNER TO postgres;

--
-- Name: notification_type_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.notification_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.notification_type_id_seq OWNER TO postgres;

--
-- Name: notification_type_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.notification_type_id_seq OWNED BY botzilla.notification_type.id;


--
-- Name: sales_person; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.sales_person (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20),
    telegram_id character varying(50),
    warning_count integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    employee_id integer
);


ALTER TABLE botzilla.sales_person OWNER TO postgres;

--
-- Name: sales_person_branch; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.sales_person_branch (
    sales_person_id integer NOT NULL,
    branch_id integer NOT NULL,
    id integer NOT NULL
);


ALTER TABLE botzilla.sales_person_branch OWNER TO postgres;

--
-- Name: sales_person_branch_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.sales_person_branch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.sales_person_branch_id_seq OWNER TO postgres;

--
-- Name: sales_person_branch_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.sales_person_branch_id_seq OWNED BY botzilla.sales_person_branch.id;


--
-- Name: sales_person_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.sales_person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.sales_person_id_seq OWNER TO postgres;

--
-- Name: sales_person_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.sales_person_id_seq OWNED BY botzilla.sales_person.id;


--
-- Name: sheet_column_map; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.sheet_column_map (
    id integer NOT NULL,
    sheet_name text NOT NULL,
    field_name text NOT NULL,
    column_index integer NOT NULL,
    type text NOT NULL
);


ALTER TABLE botzilla.sheet_column_map OWNER TO postgres;

--
-- Name: sheet_column_map_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.sheet_column_map_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.sheet_column_map_id_seq OWNER TO postgres;

--
-- Name: sheet_column_map_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.sheet_column_map_id_seq OWNED BY botzilla.sheet_column_map.id;


--
-- Name: shift; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.shift (
    crew_member_id integer NOT NULL,
    job_id integer NOT NULL,
    hours numeric(10,2) NOT NULL,
    approved_shift boolean DEFAULT false NOT NULL
);


ALTER TABLE botzilla.shift OWNER TO postgres;

--
-- Name: COLUMN shift.approved_shift; Type: COMMENT; Schema: botzilla; Owner: postgres
--

COMMENT ON COLUMN botzilla.shift.approved_shift IS 'Indica si el shift ha sido aprobado manualmente por un usuario';


--
-- Name: special_shift; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.special_shift (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE botzilla.special_shift OWNER TO postgres;

--
-- Name: special_shift_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.special_shift_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.special_shift_id_seq OWNER TO postgres;

--
-- Name: special_shift_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.special_shift_id_seq OWNED BY botzilla.special_shift.id;


--
-- Name: telegram_group; Type: TABLE; Schema: botzilla; Owner: marce
--

CREATE TABLE botzilla.telegram_group (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    branch_id integer,
    telegram_id bigint NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    category_id integer,
    is_default boolean DEFAULT false NOT NULL
);


ALTER TABLE botzilla.telegram_group OWNER TO marce;

--
-- Name: COLUMN telegram_group.is_default; Type: COMMENT; Schema: botzilla; Owner: marce
--

COMMENT ON COLUMN botzilla.telegram_group.is_default IS 'Indica si el grupo debe ser asignado por defecto durante el onboarding basado en la categoría y branch.';


--
-- Name: telegram_group_category; Type: TABLE; Schema: botzilla; Owner: marce
--

CREATE TABLE botzilla.telegram_group_category (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE botzilla.telegram_group_category OWNER TO marce;

--
-- Name: telegram_group_category_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: marce
--

CREATE SEQUENCE botzilla.telegram_group_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.telegram_group_category_id_seq OWNER TO marce;

--
-- Name: telegram_group_category_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: marce
--

ALTER SEQUENCE botzilla.telegram_group_category_id_seq OWNED BY botzilla.telegram_group_category.id;


--
-- Name: telegram_group_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: marce
--

CREATE SEQUENCE botzilla.telegram_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.telegram_group_id_seq OWNER TO marce;

--
-- Name: telegram_group_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: marce
--

ALTER SEQUENCE botzilla.telegram_group_id_seq OWNED BY botzilla.telegram_group.id;


--
-- Name: user; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla."user" (
    id integer NOT NULL,
    rol_id integer,
    phone character varying(20),
    email character varying(100) NOT NULL,
    password character varying(100) NOT NULL,
    telegram_id character varying(50)
);


ALTER TABLE botzilla."user" OWNER TO postgres;

--
-- Name: user_branch; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.user_branch (
    user_id integer NOT NULL,
    branch_id integer NOT NULL
);


ALTER TABLE botzilla.user_branch OWNER TO postgres;

--
-- Name: user_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.user_id_seq OWNER TO postgres;

--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.user_id_seq OWNED BY botzilla."user".id;


--
-- Name: user_rol; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.user_rol (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE botzilla.user_rol OWNER TO postgres;

--
-- Name: user_rol_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.user_rol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.user_rol_id_seq OWNER TO postgres;

--
-- Name: user_rol_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.user_rol_id_seq OWNED BY botzilla.user_rol.id;


--
-- Name: warning; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.warning (
    id integer NOT NULL,
    sales_person_id integer,
    reason_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE botzilla.warning OWNER TO postgres;

--
-- Name: warning_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.warning_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.warning_id_seq OWNER TO postgres;

--
-- Name: warning_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.warning_id_seq OWNED BY botzilla.warning.id;


--
-- Name: warning_reason; Type: TABLE; Schema: botzilla; Owner: postgres
--

CREATE TABLE botzilla.warning_reason (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE botzilla.warning_reason OWNER TO postgres;

--
-- Name: warning_reason_id_seq; Type: SEQUENCE; Schema: botzilla; Owner: postgres
--

CREATE SEQUENCE botzilla.warning_reason_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE botzilla.warning_reason_id_seq OWNER TO postgres;

--
-- Name: warning_reason_id_seq; Type: SEQUENCE OWNED BY; Schema: botzilla; Owner: postgres
--

ALTER SEQUENCE botzilla.warning_reason_id_seq OWNED BY botzilla.warning_reason.id;


--
-- Name: branch id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.branch ALTER COLUMN id SET DEFAULT nextval('botzilla.branch_id_seq'::regclass);


--
-- Name: crew_member id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.crew_member ALTER COLUMN id SET DEFAULT nextval('botzilla.crew_member_id_seq'::regclass);


--
-- Name: employee id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.employee ALTER COLUMN id SET DEFAULT nextval('botzilla.employee_id_seq'::regclass);


--
-- Name: employee_telegram_group id; Type: DEFAULT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.employee_telegram_group ALTER COLUMN id SET DEFAULT nextval('botzilla.employee_telegram_group_id_seq'::regclass);


--
-- Name: estimate id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.estimate ALTER COLUMN id SET DEFAULT nextval('botzilla.estimate_id_seq'::regclass);


--
-- Name: estimate_status id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.estimate_status ALTER COLUMN id SET DEFAULT nextval('botzilla.estimate_status_id_seq'::regclass);


--
-- Name: group_membership_status id; Type: DEFAULT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.group_membership_status ALTER COLUMN id SET DEFAULT nextval('botzilla.group_membership_status_id_seq'::regclass);


--
-- Name: inspection_report id; Type: DEFAULT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.inspection_report ALTER COLUMN id SET DEFAULT nextval('botzilla.inspection_report_id_seq'::regclass);


--
-- Name: job id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job ALTER COLUMN id SET DEFAULT nextval('botzilla.job_id_seq'::regclass);


--
-- Name: job_state_change_log id; Type: DEFAULT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.job_state_change_log ALTER COLUMN id SET DEFAULT nextval('botzilla.job_state_change_log_id_seq'::regclass);


--
-- Name: job_status id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job_status ALTER COLUMN id SET DEFAULT nextval('botzilla.job_status_id_seq'::regclass);


--
-- Name: notification id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification ALTER COLUMN id SET DEFAULT nextval('botzilla.notification_id_seq'::regclass);


--
-- Name: notification_templates id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification_templates ALTER COLUMN id SET DEFAULT nextval('botzilla.notification_templates_id_seq'::regclass);


--
-- Name: notification_type id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification_type ALTER COLUMN id SET DEFAULT nextval('botzilla.notification_type_id_seq'::regclass);


--
-- Name: sales_person id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sales_person ALTER COLUMN id SET DEFAULT nextval('botzilla.sales_person_id_seq'::regclass);


--
-- Name: sales_person_branch id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sales_person_branch ALTER COLUMN id SET DEFAULT nextval('botzilla.sales_person_branch_id_seq'::regclass);


--
-- Name: sheet_column_map id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sheet_column_map ALTER COLUMN id SET DEFAULT nextval('botzilla.sheet_column_map_id_seq'::regclass);


--
-- Name: special_shift id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.special_shift ALTER COLUMN id SET DEFAULT nextval('botzilla.special_shift_id_seq'::regclass);


--
-- Name: telegram_group id; Type: DEFAULT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.telegram_group ALTER COLUMN id SET DEFAULT nextval('botzilla.telegram_group_id_seq'::regclass);


--
-- Name: telegram_group_category id; Type: DEFAULT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.telegram_group_category ALTER COLUMN id SET DEFAULT nextval('botzilla.telegram_group_category_id_seq'::regclass);


--
-- Name: user id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla."user" ALTER COLUMN id SET DEFAULT nextval('botzilla.user_id_seq'::regclass);


--
-- Name: user_rol id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.user_rol ALTER COLUMN id SET DEFAULT nextval('botzilla.user_rol_id_seq'::regclass);


--
-- Name: warning id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.warning ALTER COLUMN id SET DEFAULT nextval('botzilla.warning_id_seq'::regclass);


--
-- Name: warning_reason id; Type: DEFAULT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.warning_reason ALTER COLUMN id SET DEFAULT nextval('botzilla.warning_reason_id_seq'::regclass);


--
-- Name: branch branch_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.branch
    ADD CONSTRAINT branch_pkey PRIMARY KEY (id);


--
-- Name: crew_member_branch crew_member_branch_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.crew_member_branch
    ADD CONSTRAINT crew_member_branch_pkey PRIMARY KEY (crew_member_id, branch_id);


--
-- Name: crew_member crew_member_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.crew_member
    ADD CONSTRAINT crew_member_pkey PRIMARY KEY (id);


--
-- Name: employee employee_attic_tech_user_id_key; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.employee
    ADD CONSTRAINT employee_attic_tech_user_id_key UNIQUE (attic_tech_user_id);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (id);


--
-- Name: employee_telegram_group employee_telegram_group_employee_id_telegram_group_id_key; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.employee_telegram_group
    ADD CONSTRAINT employee_telegram_group_employee_id_telegram_group_id_key UNIQUE (employee_id, telegram_group_id);


--
-- Name: employee_telegram_group employee_telegram_group_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.employee_telegram_group
    ADD CONSTRAINT employee_telegram_group_pkey PRIMARY KEY (id);


--
-- Name: estimate estimate_attic_tech_estimate_id_key; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.estimate
    ADD CONSTRAINT estimate_attic_tech_estimate_id_key UNIQUE (attic_tech_estimate_id);


--
-- Name: estimate estimate_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.estimate
    ADD CONSTRAINT estimate_pkey PRIMARY KEY (id);


--
-- Name: estimate_status estimate_status_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.estimate_status
    ADD CONSTRAINT estimate_status_pkey PRIMARY KEY (id);


--
-- Name: group_membership_status group_membership_status_name_key; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.group_membership_status
    ADD CONSTRAINT group_membership_status_name_key UNIQUE (name);


--
-- Name: group_membership_status group_membership_status_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.group_membership_status
    ADD CONSTRAINT group_membership_status_pkey PRIMARY KEY (id);


--
-- Name: inspection_report inspection_report_attic_tech_report_id_key; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.inspection_report
    ADD CONSTRAINT inspection_report_attic_tech_report_id_key UNIQUE (attic_tech_report_id);


--
-- Name: inspection_report inspection_report_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.inspection_report
    ADD CONSTRAINT inspection_report_pkey PRIMARY KEY (id);


--
-- Name: job job_attic_tech_job_id_key; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job
    ADD CONSTRAINT job_attic_tech_job_id_key UNIQUE (attic_tech_job_id);


--
-- Name: job job_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job
    ADD CONSTRAINT job_pkey PRIMARY KEY (id);


--
-- Name: job_special_shift job_special_shift_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job_special_shift
    ADD CONSTRAINT job_special_shift_pkey PRIMARY KEY (special_shift_id, job_id, date);


--
-- Name: job_state_change_log job_state_change_log_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.job_state_change_log
    ADD CONSTRAINT job_state_change_log_pkey PRIMARY KEY (id);


--
-- Name: job_status job_status_name_key; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job_status
    ADD CONSTRAINT job_status_name_key UNIQUE (name);


--
-- Name: job_status job_status_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job_status
    ADD CONSTRAINT job_status_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_name_key; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification_templates
    ADD CONSTRAINT notification_templates_name_key UNIQUE (name);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notification_type notification_type_name_key; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification_type
    ADD CONSTRAINT notification_type_name_key UNIQUE (name);


--
-- Name: notification_type notification_type_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification_type
    ADD CONSTRAINT notification_type_pkey PRIMARY KEY (id);


--
-- Name: sales_person_branch sales_person_branch_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sales_person_branch
    ADD CONSTRAINT sales_person_branch_pkey PRIMARY KEY (id);


--
-- Name: sales_person sales_person_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sales_person
    ADD CONSTRAINT sales_person_pkey PRIMARY KEY (id);


--
-- Name: sheet_column_map sheet_column_map_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sheet_column_map
    ADD CONSTRAINT sheet_column_map_pkey PRIMARY KEY (id);


--
-- Name: sheet_column_map sheet_column_map_sheet_name_field_name_key; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sheet_column_map
    ADD CONSTRAINT sheet_column_map_sheet_name_field_name_key UNIQUE (sheet_name, field_name);


--
-- Name: shift shift_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.shift
    ADD CONSTRAINT shift_pkey PRIMARY KEY (crew_member_id, job_id);


--
-- Name: special_shift special_shift_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.special_shift
    ADD CONSTRAINT special_shift_pkey PRIMARY KEY (id);


--
-- Name: telegram_group_category telegram_group_category_name_key; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.telegram_group_category
    ADD CONSTRAINT telegram_group_category_name_key UNIQUE (name);


--
-- Name: telegram_group_category telegram_group_category_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.telegram_group_category
    ADD CONSTRAINT telegram_group_category_pkey PRIMARY KEY (id);


--
-- Name: telegram_group telegram_group_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.telegram_group
    ADD CONSTRAINT telegram_group_pkey PRIMARY KEY (id);


--
-- Name: telegram_group telegram_group_telegram_id_key; Type: CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.telegram_group
    ADD CONSTRAINT telegram_group_telegram_id_key UNIQUE (telegram_id);


--
-- Name: user_branch user_branch_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.user_branch
    ADD CONSTRAINT user_branch_pkey PRIMARY KEY (user_id, branch_id);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user_rol user_rol_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.user_rol
    ADD CONSTRAINT user_rol_pkey PRIMARY KEY (id);


--
-- Name: warning warning_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.warning
    ADD CONSTRAINT warning_pkey PRIMARY KEY (id);


--
-- Name: warning_reason warning_reason_pkey; Type: CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.warning_reason
    ADD CONSTRAINT warning_reason_pkey PRIMARY KEY (id);


--
-- Name: idx_crew_member_employee_id; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_crew_member_employee_id ON botzilla.crew_member USING btree (employee_id);


--
-- Name: idx_employee_approved_by; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_approved_by ON botzilla.employee USING btree (approved_by);


--
-- Name: idx_employee_attic_tech_user_id; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_attic_tech_user_id ON botzilla.employee USING btree (attic_tech_user_id);


--
-- Name: idx_employee_branch_id; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_branch_id ON botzilla.employee USING btree (branch_id);


--
-- Name: idx_employee_city_state; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_city_state ON botzilla.employee USING btree (city, state);


--
-- Name: idx_employee_date_of_birth; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_date_of_birth ON botzilla.employee USING btree (date_of_birth);


--
-- Name: idx_employee_full_name; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_full_name ON botzilla.employee USING btree (first_name, last_name);


--
-- Name: idx_employee_registration_date; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_registration_date ON botzilla.employee USING btree (registration_date);


--
-- Name: idx_employee_role; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_role ON botzilla.employee USING btree (role);


--
-- Name: idx_employee_status; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_employee_status ON botzilla.employee USING btree (status);


--
-- Name: idx_estimate_branch; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_estimate_branch ON botzilla.estimate USING btree (branch_id);


--
-- Name: idx_estimate_sales_person; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_estimate_sales_person ON botzilla.estimate USING btree (sales_person_id);


--
-- Name: idx_estimate_status; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_estimate_status ON botzilla.estimate USING btree (status_id);


--
-- Name: idx_ir_attic_tech_created_at; Type: INDEX; Schema: botzilla; Owner: marce
--

CREATE INDEX idx_ir_attic_tech_created_at ON botzilla.inspection_report USING btree (attic_tech_created_at);


--
-- Name: idx_ir_attic_tech_estimate_id; Type: INDEX; Schema: botzilla; Owner: marce
--

CREATE INDEX idx_ir_attic_tech_estimate_id ON botzilla.inspection_report USING btree (attic_tech_estimate_id);


--
-- Name: idx_ir_attic_tech_report_id; Type: INDEX; Schema: botzilla; Owner: marce
--

CREATE INDEX idx_ir_attic_tech_report_id ON botzilla.inspection_report USING btree (attic_tech_report_id);


--
-- Name: idx_job_attic_tech_estimate_id; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_job_attic_tech_estimate_id ON botzilla.job USING btree (attic_tech_estimate_id);


--
-- Name: idx_job_attic_tech_job_id; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_job_attic_tech_job_id ON botzilla.job USING btree (attic_tech_job_id);


--
-- Name: idx_job_crew_leader; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_job_crew_leader ON botzilla.job USING btree (crew_leader_id);


--
-- Name: idx_job_estimate; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_job_estimate ON botzilla.job USING btree (estimate_id);


--
-- Name: idx_job_last_known_status_id; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_job_last_known_status_id ON botzilla.job USING btree (last_known_status_id);


--
-- Name: idx_job_last_synced_at; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_job_last_synced_at ON botzilla.job USING btree (last_synced_at);


--
-- Name: idx_job_special_shift_approved_shift; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_job_special_shift_approved_shift ON botzilla.job_special_shift USING btree (approved_shift);


--
-- Name: idx_job_state_log_attic_tech_job_id; Type: INDEX; Schema: botzilla; Owner: marce
--

CREATE INDEX idx_job_state_log_attic_tech_job_id ON botzilla.job_state_change_log USING btree (attic_tech_job_id);


--
-- Name: idx_job_state_log_changed_at; Type: INDEX; Schema: botzilla; Owner: marce
--

CREATE INDEX idx_job_state_log_changed_at ON botzilla.job_state_change_log USING btree (changed_at);


--
-- Name: idx_job_state_log_job_sync_id; Type: INDEX; Schema: botzilla; Owner: marce
--

CREATE INDEX idx_job_state_log_job_sync_id ON botzilla.job_state_change_log USING btree (job_sync_id);


--
-- Name: idx_notification_created_at; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_notification_created_at ON botzilla.notification USING btree (created_at);


--
-- Name: idx_notification_recipient; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_notification_recipient ON botzilla.notification USING btree (recipient_type, recipient_id);


--
-- Name: idx_sales_person_employee_id; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_sales_person_employee_id ON botzilla.sales_person USING btree (employee_id);


--
-- Name: idx_shift_approved_shift; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE INDEX idx_shift_approved_shift ON botzilla.shift USING btree (approved_shift);


--
-- Name: unique_employee_code; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE UNIQUE INDEX unique_employee_code ON botzilla.employee USING btree (employee_code) WHERE (employee_code IS NOT NULL);


--
-- Name: unique_employee_email; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE UNIQUE INDEX unique_employee_email ON botzilla.employee USING btree (email);


--
-- Name: unique_employee_telegram_id; Type: INDEX; Schema: botzilla; Owner: postgres
--

CREATE UNIQUE INDEX unique_employee_telegram_id ON botzilla.employee USING btree (telegram_id);


--
-- Name: employee trigger_update_employee_updated_at; Type: TRIGGER; Schema: botzilla; Owner: postgres
--

CREATE TRIGGER trigger_update_employee_updated_at BEFORE UPDATE ON botzilla.employee FOR EACH ROW EXECUTE FUNCTION botzilla.update_employee_updated_at();


--
-- Name: crew_member_branch crew_member_branch_branch_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.crew_member_branch
    ADD CONSTRAINT crew_member_branch_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES botzilla.branch(id);


--
-- Name: crew_member_branch crew_member_branch_crew_member_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.crew_member_branch
    ADD CONSTRAINT crew_member_branch_crew_member_id_fkey FOREIGN KEY (crew_member_id) REFERENCES botzilla.crew_member(id);


--
-- Name: crew_member crew_member_employee_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.crew_member
    ADD CONSTRAINT crew_member_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES botzilla.employee(id);


--
-- Name: employee employee_approved_by_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.employee
    ADD CONSTRAINT employee_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES botzilla."user"(id);


--
-- Name: estimate estimate_branch_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.estimate
    ADD CONSTRAINT estimate_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES botzilla.branch(id);


--
-- Name: estimate estimate_sales_person_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.estimate
    ADD CONSTRAINT estimate_sales_person_id_fkey FOREIGN KEY (sales_person_id) REFERENCES botzilla.sales_person(id);


--
-- Name: estimate estimate_status_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.estimate
    ADD CONSTRAINT estimate_status_id_fkey FOREIGN KEY (status_id) REFERENCES botzilla.estimate_status(id);


--
-- Name: telegram_group fk_branch; Type: FK CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.telegram_group
    ADD CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES botzilla.branch(id) ON DELETE SET NULL;


--
-- Name: employee_telegram_group fk_employee; Type: FK CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.employee_telegram_group
    ADD CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES botzilla.employee(id) ON DELETE CASCADE;


--
-- Name: employee fk_employee_branch; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.employee
    ADD CONSTRAINT fk_employee_branch FOREIGN KEY (branch_id) REFERENCES botzilla.branch(id) ON DELETE SET NULL;


--
-- Name: employee_telegram_group fk_status; Type: FK CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.employee_telegram_group
    ADD CONSTRAINT fk_status FOREIGN KEY (status_id) REFERENCES botzilla.group_membership_status(id);


--
-- Name: employee_telegram_group fk_telegram_group; Type: FK CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.employee_telegram_group
    ADD CONSTRAINT fk_telegram_group FOREIGN KEY (telegram_group_id) REFERENCES botzilla.telegram_group(id) ON DELETE CASCADE;


--
-- Name: telegram_group fk_telegram_group_category; Type: FK CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.telegram_group
    ADD CONSTRAINT fk_telegram_group_category FOREIGN KEY (category_id) REFERENCES botzilla.telegram_group_category(id) ON DELETE SET NULL;


--
-- Name: job job_branch_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job
    ADD CONSTRAINT job_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES botzilla.branch(id);


--
-- Name: job job_crew_leader_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job
    ADD CONSTRAINT job_crew_leader_id_fkey FOREIGN KEY (crew_leader_id) REFERENCES botzilla.crew_member(id);


--
-- Name: job job_estimate_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job
    ADD CONSTRAINT job_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES botzilla.estimate(id);


--
-- Name: job job_last_known_status_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job
    ADD CONSTRAINT job_last_known_status_id_fkey FOREIGN KEY (last_known_status_id) REFERENCES botzilla.job_status(id);


--
-- Name: job_special_shift job_special_shift_job_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job_special_shift
    ADD CONSTRAINT job_special_shift_job_id_fkey FOREIGN KEY (job_id) REFERENCES botzilla.job(id);


--
-- Name: job_special_shift job_special_shift_special_shift_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job_special_shift
    ADD CONSTRAINT job_special_shift_special_shift_id_fkey FOREIGN KEY (special_shift_id) REFERENCES botzilla.special_shift(id);


--
-- Name: job_state_change_log job_state_change_log_new_status_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.job_state_change_log
    ADD CONSTRAINT job_state_change_log_new_status_id_fkey FOREIGN KEY (new_status_id) REFERENCES botzilla.job_status(id);


--
-- Name: job_state_change_log job_state_change_log_previous_status_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: marce
--

ALTER TABLE ONLY botzilla.job_state_change_log
    ADD CONSTRAINT job_state_change_log_previous_status_id_fkey FOREIGN KEY (previous_status_id) REFERENCES botzilla.job_status(id);


--
-- Name: job job_status_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.job
    ADD CONSTRAINT job_status_id_fkey FOREIGN KEY (status_id) REFERENCES botzilla.job_status(id);


--
-- Name: notification notification_notification_type_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification
    ADD CONSTRAINT notification_notification_type_id_fkey FOREIGN KEY (notification_type_id) REFERENCES botzilla.notification_type(id) ON DELETE SET NULL;


--
-- Name: notification_templates notification_templates_notification_type_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.notification_templates
    ADD CONSTRAINT notification_templates_notification_type_id_fkey FOREIGN KEY (notification_type_id) REFERENCES botzilla.notification_type(id);


--
-- Name: sales_person_branch sales_person_branch_branch_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sales_person_branch
    ADD CONSTRAINT sales_person_branch_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES botzilla.branch(id);


--
-- Name: sales_person_branch sales_person_branch_sales_person_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sales_person_branch
    ADD CONSTRAINT sales_person_branch_sales_person_id_fkey FOREIGN KEY (sales_person_id) REFERENCES botzilla.sales_person(id);


--
-- Name: sales_person sales_person_employee_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.sales_person
    ADD CONSTRAINT sales_person_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES botzilla.employee(id);


--
-- Name: shift shift_crew_member_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.shift
    ADD CONSTRAINT shift_crew_member_id_fkey FOREIGN KEY (crew_member_id) REFERENCES botzilla.crew_member(id);


--
-- Name: shift shift_job_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.shift
    ADD CONSTRAINT shift_job_id_fkey FOREIGN KEY (job_id) REFERENCES botzilla.job(id);


--
-- Name: user_branch user_branch_branch_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.user_branch
    ADD CONSTRAINT user_branch_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES botzilla.branch(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_branch user_branch_user_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.user_branch
    ADD CONSTRAINT user_branch_user_id_fkey FOREIGN KEY (user_id) REFERENCES botzilla."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user user_rol_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla."user"
    ADD CONSTRAINT user_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES botzilla.user_rol(id);


--
-- Name: warning warning_reason_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.warning
    ADD CONSTRAINT warning_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES botzilla.warning_reason(id);


--
-- Name: warning warning_sales_person_id_fkey; Type: FK CONSTRAINT; Schema: botzilla; Owner: postgres
--

ALTER TABLE ONLY botzilla.warning
    ADD CONSTRAINT warning_sales_person_id_fkey FOREIGN KEY (sales_person_id) REFERENCES botzilla.sales_person(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 4pih0HgbCL4lKv9cIHF6kdP3urXDzAEplgkwcYs698tgAIccRpR9C0K9nQba2FD

