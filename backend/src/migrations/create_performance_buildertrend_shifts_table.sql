-- Migration: Create performance_buildertrend_shifts table
-- This table stores shifts parsed from BuilderTrend Excel exports
-- for matching with jobs from the performance spreadsheet

CREATE TABLE botzilla.performance_buildertrend_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id UUID NOT NULL, -- Links to performance_sync_jobs
    upload_id UUID NOT NULL, -- Groups shifts from the same Excel upload
    
    -- Raw data from BuilderTrend Excel
    excel_row_number INTEGER NOT NULL, -- Original row in Excel
    date DATE,
    job_name_raw VARCHAR(500), -- Original job name from BuilderTrend (Column B)
    crew_member_name VARCHAR(255), -- Column C
    tags TEXT, -- Column D (important for QC detection)
    regular_time_raw VARCHAR(20), -- Format HH:MM
    ot_raw VARCHAR(20), -- Overtime HH:MM
    ot2_raw VARCHAR(20), -- Double overtime HH:MM
    pto_raw VARCHAR(20), -- PTO HH:MM
    total_work_time_raw VARCHAR(20),
    notes TEXT,
    
    -- Calculated values (converted to decimal hours)
    regular_hours NUMERIC(10, 2) DEFAULT 0.0,
    ot_hours NUMERIC(10, 2) DEFAULT 0.0, -- Already multiplied by 1.5
    ot2_hours NUMERIC(10, 2) DEFAULT 0.0, -- Already multiplied by 2
    pto_hours NUMERIC(10, 2) DEFAULT 0.0,
    total_hours NUMERIC(10, 2) DEFAULT 0.0, -- Sum of all above
    
    -- Tag analysis
    is_qc BOOLEAN DEFAULT FALSE, -- TRUE if tags contain "QC"
    
    -- Matching with performance_sync_jobs
    matched_sync_job_id INTEGER, -- FK to performance_sync_jobs.id
    match_confidence NUMERIC(5, 2) DEFAULT 0.0, -- 0-100 confidence score
    match_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'matched', 'needs_review', 'no_match'
    needs_human_review BOOLEAN DEFAULT FALSE, -- TRUE if confidence < 95%
    similarity_score NUMERIC(5, 2), -- Fuzzy match score for job name
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_buildertrend_shift_sync_job
        FOREIGN KEY (matched_sync_job_id)
        REFERENCES botzilla.performance_sync_jobs (id) ON DELETE SET NULL
);

-- Index for faster lookup by sync_id
CREATE INDEX idx_buildertrend_shifts_sync_id 
    ON botzilla.performance_buildertrend_shifts (sync_id);

-- Index for faster lookup by upload_id
CREATE INDEX idx_buildertrend_shifts_upload_id 
    ON botzilla.performance_buildertrend_shifts (upload_id);

-- Index for faster lookup by match_status
CREATE INDEX idx_buildertrend_shifts_match_status 
    ON botzilla.performance_buildertrend_shifts (match_status);

-- Index for faster lookup by matched_sync_job_id
CREATE INDEX idx_buildertrend_shifts_matched_job 
    ON botzilla.performance_buildertrend_shifts (matched_sync_job_id);

-- Comments
COMMENT ON TABLE botzilla.performance_buildertrend_shifts IS 
    'Stores shifts parsed from BuilderTrend Time Clock Reports for matching with performance spreadsheet jobs';
    
COMMENT ON COLUMN botzilla.performance_buildertrend_shifts.ot_hours IS 
    'Overtime hours already multiplied by 1.5';
    
COMMENT ON COLUMN botzilla.performance_buildertrend_shifts.ot2_hours IS 
    'Double overtime hours already multiplied by 2';
    
COMMENT ON COLUMN botzilla.performance_buildertrend_shifts.needs_human_review IS 
    'TRUE when job name match has confidence < 95%, requiring manual verification';

