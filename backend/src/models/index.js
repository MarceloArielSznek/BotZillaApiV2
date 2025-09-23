'use strict';

const User = require('./User');
const UserRol = require('./UserRol');
const SalesPerson = require('./SalesPerson');
const Branch = require('./Branch');
const EstimateStatus = require('./EstimateStatus');
const Estimate = require('./Estimate');
const SalesPersonBranch = require('./SalesPersonBranch');
const CrewMember = require('./CrewMember');
const CrewMemberBranch = require('./CrewMemberBranch');
const Warning = require('./Warning');
const WarningReason = require('./WarningReason');
const NotificationTemplate = require('./NotificationTemplate');
const NotificationType = require('./NotificationType');
const Notification = require('./Notification');
const UserBranch = require('./UserBranch');
const SheetColumnMap = require('./SheetColumnMap');
const Job = require('./Job');
const Shift = require('./Shift');
const SpecialShift = require('./SpecialShift');
const JobSpecialShift = require('./JobSpecialShift');
const JobStatus = require('./JobStatus');
const AutomationErrorLog = require('./AutomationErrorLog');
const Employee = require('./Employee');
const TelegramGroup = require('./TelegramGroup');
const GroupMembershipStatus = require('./GroupMembershipStatus');
const EmployeeTelegramGroup = require('./EmployeeTelegramGroup');
const TelegramGroupCategory = require('./TelegramGroupCategory'); // Importar nuevo modelo

// Definir las asociaciones de User
User.belongsTo(UserRol, {
    foreignKey: 'rol_id',
    as: 'rol'
});

UserRol.hasMany(User, {
    foreignKey: 'rol_id',
    as: 'users'
});

// Nueva relación muchos a muchos entre User y Branch
User.belongsToMany(Branch, {
    through: UserBranch,
    foreignKey: 'user_id',
    otherKey: 'branch_id',
    as: 'branches'
});

Branch.belongsToMany(User, {
    through: UserBranch,
    foreignKey: 'branch_id',
    otherKey: 'user_id',
    as: 'users'
});

// Definir las asociaciones de Estimate
Estimate.belongsTo(SalesPerson, {
    foreignKey: 'sales_person_id',
    as: 'salesperson'
});

Estimate.belongsTo(Branch, {
    foreignKey: 'branch_id',
    as: 'branch'
});

Estimate.belongsTo(EstimateStatus, {
    foreignKey: 'status_id',
    as: 'status'
});

// Asociaciones inversas
SalesPerson.hasMany(Estimate, {
    foreignKey: 'sales_person_id',
    as: 'estimates'
});

Branch.hasMany(Estimate, {
    foreignKey: 'branch_id',
    as: 'estimates'
});

EstimateStatus.hasMany(Estimate, {
    foreignKey: 'status_id',
    as: 'estimates'
});

// Relación muchos a muchos entre SalesPerson y Branch
SalesPerson.belongsToMany(Branch, {
    through: SalesPersonBranch,
    foreignKey: 'sales_person_id',
    otherKey: 'branch_id',
    as: 'branches'
});

Branch.belongsToMany(SalesPerson, {
    through: SalesPersonBranch,
    foreignKey: 'branch_id',
    otherKey: 'sales_person_id',
    as: 'salespersons'
});

// Asociaciones directas para SalesPersonBranch, para permitir includes directos
SalesPersonBranch.belongsTo(SalesPerson, {
    foreignKey: 'sales_person_id',
    as: 'salesPerson'
});
SalesPersonBranch.belongsTo(Branch, {
    foreignKey: 'branch_id',
    as: 'branch'
});
SalesPerson.hasMany(SalesPersonBranch, {
    foreignKey: 'sales_person_id',
    as: 'SalesPersonBranches' // Este alias debe coincidir con el usado en el controlador
});
Branch.hasMany(SalesPersonBranch, {
    foreignKey: 'branch_id',
    as: 'SalesPersonBranches'
});


// Relación muchos a muchos entre CrewMember y Branch
CrewMember.belongsToMany(Branch, {
    through: CrewMemberBranch,
    foreignKey: 'crew_member_id',
    otherKey: 'branch_id',
    as: 'branches'
});

Branch.belongsToMany(CrewMember, {
    through: CrewMemberBranch,
    foreignKey: 'branch_id',
    otherKey: 'crew_member_id',
    as: 'crewMembers'
});

// Asociaciones directas para CrewMemberBranch
CrewMemberBranch.belongsTo(CrewMember, {
    foreignKey: 'crew_member_id',
    as: 'crewMember'
});

CrewMemberBranch.belongsTo(Branch, {
    foreignKey: 'branch_id',
    as: 'branch'
});

CrewMember.hasMany(CrewMemberBranch, {
    foreignKey: 'crew_member_id',
    as: 'CrewMemberBranches'
});

Branch.hasMany(CrewMemberBranch, {
    foreignKey: 'branch_id',
    as: 'CrewMemberBranches'
});

// Asociaciones para Warnings
Warning.belongsTo(SalesPerson, {
    foreignKey: 'sales_person_id',
    as: 'salesPerson'
});
SalesPerson.hasMany(Warning, {
    foreignKey: 'sales_person_id',
    as: 'warnings'
});

Warning.belongsTo(WarningReason, {
    foreignKey: 'reason_id',
    as: 'reason'
});
WarningReason.hasMany(Warning, {
    foreignKey: 'reason_id',
    as: 'warnings'
});

// Asociaciones para NotificationTemplates y NotificationTypes
NotificationTemplate.belongsTo(NotificationType, {
    foreignKey: 'notification_type_id',
    as: 'notificationType'
});
NotificationType.hasMany(NotificationTemplate, {
    foreignKey: 'notification_type_id',
    as: 'templates'
});

// Asociaciones para Notification (historial)
Notification.belongsTo(SalesPerson, {
    foreignKey: 'recipient_id',
    constraints: false, // Desactivamos las constraints porque recipient_id puede referirse a otras tablas
    as: 'salesPersonRecipient'
});
Notification.belongsTo(NotificationType, { // <-- Añadir esta asociación
    foreignKey: 'notification_type_id',
    as: 'notificationType'
});
// No definimos un hasMany inverso para no sobrecargar el modelo de SalesPerson

// Asociaciones para Job
Job.belongsTo(Estimate, { foreignKey: 'estimate_id', as: 'estimate' });
Estimate.hasOne(Job, { foreignKey: 'estimate_id', as: 'job' });

Job.belongsTo(CrewMember, { foreignKey: 'crew_leader_id', as: 'crewLeader' });
CrewMember.hasMany(Job, { foreignKey: 'crew_leader_id', as: 'ledJobs' });

Job.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Branch.hasMany(Job, { foreignKey: 'branch_id', as: 'jobs' });

Job.belongsTo(JobStatus, { foreignKey: 'status_id', as: 'status' });
JobStatus.hasMany(Job, { foreignKey: 'status_id', as: 'jobs' });

// Asociaciones para Shift
Shift.belongsTo(Job, { foreignKey: 'job_id', as: 'job', onDelete: 'CASCADE' });
Job.hasMany(Shift, { foreignKey: 'job_id', as: 'shifts' });

Shift.belongsTo(CrewMember, { foreignKey: 'crew_member_id', as: 'crewMember' });
CrewMember.hasMany(Shift, { foreignKey: 'crew_member_id', as: 'shifts' });

// Asociaciones para JobSpecialShift (Tabla de unión)
Job.belongsToMany(SpecialShift, {
    through: JobSpecialShift,
    foreignKey: 'job_id',
    otherKey: 'special_shift_id',
    as: 'specialShifts',
    onDelete: 'CASCADE'
});
SpecialShift.belongsToMany(Job, {
    through: JobSpecialShift,
    foreignKey: 'special_shift_id',
    otherKey: 'job_id',
    as: 'jobs'
});

// Asociaciones directas en el modelo de unión para includes
JobSpecialShift.belongsTo(Job, { foreignKey: 'job_id', as: 'job', onDelete: 'CASCADE' });
Job.hasMany(JobSpecialShift, { foreignKey: 'job_id', as: 'jobSpecialShifts' });
JobSpecialShift.belongsTo(SpecialShift, { foreignKey: 'special_shift_id', as: 'specialShift' });
SpecialShift.hasMany(JobSpecialShift, { foreignKey: 'special_shift_id', as: 'jobSpecialShifts' });

// Asociaciones para Employee
Employee.belongsTo(User, {
    foreignKey: 'approved_by',
    as: 'approver',
    constraints: false // Opcional, ya que puede ser null
});

User.hasMany(Employee, {
    foreignKey: 'approved_by',
    as: 'approvedEmployees'
});

// === NUEVAS ASOCIACIONES PARA ONBOARDING ===

// TelegramGroup <-> Branch (Uno a Muchos)
Branch.hasMany(TelegramGroup, {
    foreignKey: 'branch_id',
    as: 'telegramGroups'
});
TelegramGroup.belongsTo(Branch, {
    foreignKey: 'branch_id',
    as: 'branch'
});

// Asociaciones para Categorías de Grupos de Telegram
TelegramGroupCategory.hasMany(TelegramGroup, {
    foreignKey: 'category_id',
    as: 'groups'
});
TelegramGroup.belongsTo(TelegramGroupCategory, {
    foreignKey: 'category_id',
    as: 'category'
});

// Employee <-> TelegramGroup (Muchos a Muchos a través de EmployeeTelegramGroup)
Employee.belongsToMany(TelegramGroup, {
    through: EmployeeTelegramGroup,
    foreignKey: 'employee_id',
    otherKey: 'telegram_group_id',
    as: 'telegramGroups'
});
TelegramGroup.belongsToMany(Employee, {
    through: EmployeeTelegramGroup,
    foreignKey: 'telegram_group_id',
    otherKey: 'employee_id',
    as: 'employees'
});

// Asociaciones directas en la tabla intermedia
EmployeeTelegramGroup.belongsTo(Employee, { foreignKey: 'employee_id' });
EmployeeTelegramGroup.belongsTo(TelegramGroup, { foreignKey: 'telegram_group_id' });
EmployeeTelegramGroup.belongsTo(GroupMembershipStatus, { foreignKey: 'status_id', as: 'status' });

GroupMembershipStatus.hasMany(EmployeeTelegramGroup, { foreignKey: 'status_id' });
Employee.hasMany(EmployeeTelegramGroup, { foreignKey: 'employee_id' });
TelegramGroup.hasMany(EmployeeTelegramGroup, { foreignKey: 'telegram_group_id' });

// === NEW ASSOCIATIONS FOR ONBOARDING ===
Branch.hasMany(Employee, { foreignKey: 'branch_id', as: 'employees' });
Employee.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });


module.exports = {
    User,
    UserRol,
    SalesPerson,
    Branch,
    EstimateStatus,
    Estimate,
    SalesPersonBranch,
    CrewMember,
    CrewMemberBranch,
    Warning,
    WarningReason,
    NotificationTemplate,
    NotificationType,
    Notification,
    UserBranch,
    SheetColumnMap,
    Job,
    Shift,
    SpecialShift,
    JobSpecialShift,
    JobStatus,
    AutomationErrorLog,
    Employee,
    TelegramGroup,
    GroupMembershipStatus,
    EmployeeTelegramGroup,
    TelegramGroupCategory // Exportar nuevo modelo
}; 