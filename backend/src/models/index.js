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
const InspectionReport = require('./InspectionReport');
const PerformanceSyncJob = require('./PerformanceSyncJob');
const BuilderTrendShift = require('./BuilderTrendShift');
const DailyShift = require('./DailyShift');
const OverrunReport = require('./OverrunReport');
const OperationCommandPost = require('./OperationCommandPost');
const PaymentMethod = require('./PaymentMethod');
const BranchConfiguration = require('./BranchConfiguration');
const MultiplierRange = require('./MultiplierRange');
const BranchConfigurationMultiplierRange = require('./BranchConfigurationMultiplierRange');
const WaTaxRate = require('./WaTaxRate');
const FollowUpStatus = require('./FollowUpStatus');
const FollowUpLabel = require('./FollowUpLabel');
const Chat = require('./Chat');
const ChatMessage = require('./ChatMessage');
const FollowUpTicket = require('./FollowUpTicket');
const SmsBatch = require('./SmsBatch');
const SmsBatchEstimate = require('./SmsBatchEstimate');
const SmsWebhookConfig = require('./SmsWebhookConfig');

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

Estimate.belongsTo(PaymentMethod, {
    foreignKey: 'payment_method_id',
    as: 'paymentMethod'
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

PaymentMethod.hasMany(Estimate, {
    foreignKey: 'payment_method_id',
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

// crew_leader_id ahora apunta a Employee (no CrewMember)
Job.belongsTo(Employee, { foreignKey: 'crew_leader_id', as: 'crewLeader' });
Employee.hasMany(Job, { foreignKey: 'crew_leader_id', as: 'ledJobs' });

Job.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Branch.hasMany(Job, { foreignKey: 'branch_id', as: 'jobs' });

Job.belongsTo(JobStatus, { foreignKey: 'status_id', as: 'status' });
JobStatus.hasMany(Job, { foreignKey: 'status_id', as: 'jobs' });

// Asociación con OverrunReport
Job.belongsTo(OverrunReport, { foreignKey: 'overrun_report_id', as: 'overrunReport' });
OverrunReport.hasMany(Job, { foreignKey: 'overrun_report_id', as: 'jobs' });

// Asociación con OperationCommandPost
Job.belongsTo(OperationCommandPost, { foreignKey: 'operation_post_id', as: 'operationPost' });
OperationCommandPost.hasMany(Job, { foreignKey: 'operation_post_id', as: 'jobs' });

// Asociaciones para Shift
Shift.belongsTo(Job, { foreignKey: 'job_id', as: 'job', onDelete: 'CASCADE' });
Job.hasMany(Shift, { foreignKey: 'job_id', as: 'shifts' });

// crew_member_id ahora apunta a Employee (para PK)
Shift.belongsTo(Employee, { foreignKey: 'crew_member_id', as: 'crewMember' });
Employee.hasMany(Shift, { foreignKey: 'crew_member_id', as: 'shifts' });

// employee_id es una referencia adicional para Performance shifts
Shift.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Employee.hasMany(Shift, { foreignKey: 'employee_id', as: 'employeeShifts' });

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

// === PERFORMANCE SYNC JOBS ASSOCIATIONS ===
PerformanceSyncJob.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
PerformanceSyncJob.belongsTo(Job, { foreignKey: 'matched_job_id', as: 'matchedJob' });
Branch.hasMany(PerformanceSyncJob, { foreignKey: 'branch_id', as: 'performanceSyncJobs' });
Job.hasMany(PerformanceSyncJob, { foreignKey: 'matched_job_id', as: 'performanceSyncJobs' });

// === BUILDERTREND SHIFTS ASSOCIATIONS ===
BuilderTrendShift.belongsTo(PerformanceSyncJob, { foreignKey: 'matched_sync_job_id', as: 'matchedSyncJob' });
PerformanceSyncJob.hasMany(BuilderTrendShift, { foreignKey: 'matched_sync_job_id', as: 'builderTrendShifts' });

// === DAILY SHIFT ASSOCIATIONS (NEW PERFORMANCE SYSTEM) ===
DailyShift.belongsTo(Job, { foreignKey: 'job_id', as: 'job', onDelete: 'CASCADE' });
Job.hasMany(DailyShift, { foreignKey: 'job_id', as: 'dailyShifts' });

DailyShift.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Employee.hasMany(DailyShift, { foreignKey: 'employee_id', as: 'dailyShifts' });

// === BRANCH CONFIGURATION ASSOCIATIONS ===
// Branch → BranchConfiguration (1 a 1)
Branch.belongsTo(BranchConfiguration, {
    foreignKey: 'branch_configuration_id',
    as: 'configuration'
});

BranchConfiguration.hasMany(Branch, {
    foreignKey: 'branch_configuration_id',
    as: 'branches'
});

// BranchConfiguration ←→ MultiplierRange (muchos a muchos)
BranchConfiguration.belongsToMany(MultiplierRange, {
    through: BranchConfigurationMultiplierRange,
    foreignKey: 'branch_configuration_id',
    otherKey: 'multiplier_range_id',
    as: 'multiplierRanges'
});

MultiplierRange.belongsToMany(BranchConfiguration, {
    through: BranchConfigurationMultiplierRange,
    foreignKey: 'multiplier_range_id',
    otherKey: 'branch_configuration_id',
    as: 'configurations'
});

// === FOLLOW-UP SYSTEM ASSOCIATIONS ===

// Chat → ChatMessage (1 a muchos)
Chat.hasMany(ChatMessage, {
    foreignKey: 'chat_id',
    as: 'messages'
});
ChatMessage.belongsTo(Chat, {
    foreignKey: 'chat_id',
    as: 'chat'
});

// FollowUpTicket → Estimate (muchos a 1)
FollowUpTicket.belongsTo(Estimate, {
    foreignKey: 'estimate_id',
    as: 'estimate'
});
Estimate.hasOne(FollowUpTicket, {
    foreignKey: 'estimate_id',
    as: 'followUpTicket'
});

// FollowUpTicket → FollowUpStatus (muchos a 1)
FollowUpTicket.belongsTo(FollowUpStatus, {
    foreignKey: 'status_id',
    as: 'status'
});
FollowUpStatus.hasMany(FollowUpTicket, {
    foreignKey: 'status_id',
    as: 'tickets'
});

// FollowUpTicket → FollowUpLabel (muchos a 1)
FollowUpTicket.belongsTo(FollowUpLabel, {
    foreignKey: 'label_id',
    as: 'label'
});
FollowUpLabel.hasMany(FollowUpTicket, {
    foreignKey: 'label_id',
    as: 'tickets'
});

// FollowUpTicket → Chat (1 a 1)
FollowUpTicket.belongsTo(Chat, {
    foreignKey: 'chat_id',
    as: 'chat'
});
Chat.hasOne(FollowUpTicket, {
    foreignKey: 'chat_id',
    as: 'ticket'
});

// FollowUpTicket → User (assigned_to) (muchos a 1)
FollowUpTicket.belongsTo(User, {
    foreignKey: 'assigned_to',
    as: 'assignedUser'
});
User.hasMany(FollowUpTicket, {
    foreignKey: 'assigned_to',
    as: 'assignedTickets'
});

// === SMS BATCH SYSTEM ASSOCIATIONS ===

// SmsBatch → User (created_by) (muchos a 1)
SmsBatch.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'creator'
});
User.hasMany(SmsBatch, {
    foreignKey: 'created_by',
    as: 'createdBatches'
});

// SmsBatch ↔ Estimate (many-to-many through SmsBatchEstimate)
SmsBatch.belongsToMany(Estimate, {
    through: SmsBatchEstimate,
    foreignKey: 'batch_id',
    otherKey: 'estimate_id',
    as: 'estimates'
});
Estimate.belongsToMany(SmsBatch, {
    through: SmsBatchEstimate,
    foreignKey: 'estimate_id',
    otherKey: 'batch_id',
    as: 'smsBatches'
});

// SmsBatchEstimate → SmsBatch (muchos a 1)
SmsBatchEstimate.belongsTo(SmsBatch, {
    foreignKey: 'batch_id',
    as: 'batch'
});
SmsBatch.hasMany(SmsBatchEstimate, {
    foreignKey: 'batch_id',
    as: 'batchEstimates'
});

// SmsBatchEstimate → Estimate (muchos a 1)
SmsBatchEstimate.belongsTo(Estimate, {
    foreignKey: 'estimate_id',
    as: 'estimate'
});
Estimate.hasMany(SmsBatchEstimate, {
    foreignKey: 'estimate_id',
    as: 'batchEstimates'
});


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
    TelegramGroupCategory,
    InspectionReport,
    PerformanceSyncJob,
    BuilderTrendShift,
    OverrunReport,
    OperationCommandPost,
    PaymentMethod,
    BranchConfiguration,
    MultiplierRange,
    BranchConfigurationMultiplierRange,
    WaTaxRate,
    FollowUpStatus,
    FollowUpLabel,
    Chat,
    ChatMessage,
    FollowUpTicket,
    DailyShift,
    SmsBatch,
    SmsBatchEstimate,
    SmsWebhookConfig
}; 