const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BuilderTrendShift = sequelize.define('BuilderTrendShift', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    sync_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    upload_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    
    // Raw data from BuilderTrend Excel
    excel_row_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    job_name_raw: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    crew_member_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    tags: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    regular_time_raw: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    ot_raw: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    ot2_raw: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    pto_raw: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    total_work_time_raw: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    
    // Calculated values (converted to decimal hours)
    regular_hours: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
    },
    ot_hours: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0, // Already multiplied by 1.5
    },
    ot2_hours: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0, // Already multiplied by 2
    },
    pto_hours: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
    },
    total_hours: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
    },
    
    // Tag analysis
    is_qc: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    
    // Matching with performance_sync_jobs
    matched_sync_job_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    match_confidence: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.0,
    },
    match_status: {
        type: DataTypes.STRING(50),
        defaultValue: 'pending',
    },
    needs_human_review: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    similarity_score: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
    },
    
    // Metadata
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'performance_buildertrend_shifts',
    schema: 'botzilla',
    timestamps: false,
});

module.exports = BuilderTrendShift;

