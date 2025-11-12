'use strict';
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class InspectionReport extends Model {}

InspectionReport.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    attic_tech_report_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
    },
    attic_tech_estimate_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    estimate_name: DataTypes.STRING,
    salesperson_name: DataTypes.STRING,
    salesperson_email: DataTypes.STRING,
    client_name: DataTypes.STRING,
    client_phone: DataTypes.STRING(50),
    client_email: DataTypes.STRING,
    client_address: DataTypes.TEXT,
    branch_name: DataTypes.STRING,
    estimate_link: DataTypes.TEXT,
    roof_material: DataTypes.STRING(100),
    decking_type: DataTypes.STRING(100),
    roof_age: DataTypes.STRING(50),
    walkable_roof: DataTypes.STRING(50),
    roof_condition: DataTypes.STRING(100),
    full_roof_inspection_interest: DataTypes.BOOLEAN,
    customer_comfort: DataTypes.STRING(100),
    hvac_age: DataTypes.STRING(50),
    system_condition: DataTypes.STRING(100),
    air_ducts_condition: DataTypes.STRING(100),
    full_hvac_furnace_inspection_interest: DataTypes.BOOLEAN,
    roof_notification_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    hvac_notification_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    exported_to_spreadsheet: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el reporte ya fue exportado al spreadsheet. Se marca como true después de enviarlo a Make.com'
    },
    attic_tech_created_at: DataTypes.DATE,
}, {
    sequelize,
    modelName: 'InspectionReport',
    tableName: 'inspection_report',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = InspectionReport;
