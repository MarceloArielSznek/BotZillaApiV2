const { Op, literal } = require('sequelize');
const { Estimate, SalesPerson, EstimateStatus, Warning, WarningReason, Branch, NotificationTemplate, NotificationType, Notification, User, UserRol } = require('../models');

class NotificationsController {
    async getEstimateNotifications(req, res) {
        try {
            // Aquí irá la lógica para determinar qué notificaciones de estimates se deben enviar y a quién.
            // Por ahora, devolveremos un placeholder.
            res.json({
                message: "Placeholder for estimate notifications.",
                notifications: []
            });
        } catch (error) {
            res.status(500).json({ message: "Error generating estimate notifications.", error: error.message });
        }
    }

    async generateSalesPersonWarningNotifications(req, res) {
        const isDryRun = req.query.dryRun === 'true';
        console.log(`[DRY RUN CHECK] Received dryRun query param: '${req.query.dryRun}'. Resolved isDryRun to: ${isDryRun}`);

        const notifications = [];
        let warningsIssued = 0;
        let congratulationsSent = 0;

        try {
            const templatesData = await NotificationTemplate.findAll({
                include: [{ model: NotificationType, as: 'notificationType' }]
            });
            
            // Create a lookup map for templates by level for warnings, and by name for others
            const templates = templatesData.reduce((acc, t) => {
                const templateData = { text: t.template_text, typeId: t.notificationType.id };
                if (t.level > 0) {
                    acc[t.level] = templateData;
                }
                acc[t.name] = templateData; // Keep name for congratulations_reset
                return acc;
            }, {});

            const activeStatuses = await EstimateStatus.findAll({
                where: { name: ['In Progress', 'Released'] },
                attributes: ['id']
            });
            if (activeStatuses.length === 0) {
                return res.json({ message: "No active statuses found, no warnings processed.", summary: {}, notifications: [] });
            }
            const activeStatusIds = activeStatuses.map(s => s.id);

            const warningReason = await WarningReason.findOne({ where: { name: 'Exceeded Active Lead Limit' } });
            if (!warningReason) {
                throw new Error('Warning reason "Exceeded Active Lead Limit" not found.');
            }

            const salespersons = await SalesPerson.findAll({
                attributes: {
                    include: [
                        [
                            literal(`(
                                SELECT COUNT(*)
                                FROM "botzilla"."estimate" AS "e"
                                WHERE
                                    "e"."sales_person_id" = "SalesPerson"."id" AND
                                    "e"."status_id" IN (${activeStatusIds.join(',')})
                            )`),
                            'activeLeadsCount'
                        ]
                    ]
                },
                include: [{
                    model: Branch,
                    as: 'branches',
                    attributes: ['name'],
                    through: { attributes: [] }
                }]
            });
            
            for (const sp of salespersons) {
                const salesPerson = sp.get({ plain: true });
                const { id, name, warning_count, telegram_id, activeLeadsCount, branches } = salesPerson;
                
                // Si no hay ID de Telegram, saltamos a la siguiente persona
                if (!telegram_id) {
                    continue;
                }

                if (activeLeadsCount >= 12) {
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);

                    // Si es dryRun, nos saltamos la comprobación de advertencia existente para simular una ejecución fresca
                    const existingWarningToday = isDryRun ? null : await Warning.findOne({
                        where: {
                            sales_person_id: id,
                            reason_id: warningReason.id,
                            created_at: { [Op.gte]: todayStart }
                        }
                    });

                    if (!existingWarningToday) {
                        const newWarningCount = warning_count + 1;
                        
                        // Find the template by its level. Use level 3 for any count >= 3.
                        const warningLevel = Math.min(newWarningCount, 3);
                        const templateInfo = templates[warningLevel];
                        
                        if (!templateInfo) {
                            console.warn(`[WARN] Notification template for level "${warningLevel}" not found. Skipping warning notification for ${name}.`);
                            continue; // Skip to the next salesperson
                        }

                        const message_text = this.populateTemplate(templateInfo.text, {
                            salesperson_name: name,
                            active_leads_count: activeLeadsCount,
                            warning_count: newWarningCount
                        });

                        if (!isDryRun) {
                            await Warning.create({ sales_person_id: id, reason_id: warningReason.id });
                        }

                        // Update salesperson and create notification record regardless of dryRun, as requested.
                        await SalesPerson.update({ warning_count: newWarningCount }, { where: { id } });
                        await Notification.create({
                            message: message_text,
                            recipient_type: 'sales_person',
                            recipient_id: id,
                            notification_type_id: templateInfo.typeId
                        });
                        
                        notifications.push({
                            salesperson_name: name,
                            telegram_id: telegram_id, // Always use the real Telegram ID
                            branches: branches.map(b => b.name),
                            active_leads_count: activeLeadsCount,
                            warning_count: newWarningCount,
                            notification_type_id: templateInfo.typeId, // <-- Cambio aquí
                            message_text // <-- El mensaje final
                        });
                        warningsIssued++;
                    }
                } else if (activeLeadsCount < 12 && warning_count > 0) {
                    const templateInfo = templates['congratulations_reset'];
                    if (!templateInfo) {
                        console.warn(`[WARN] Notification template "congratulations_reset" not found. Skipping congratulations notification for ${name}.`);
                        continue; // Skip to the next salesperson
                    }

                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);

                    // Check if a congratulations message was already sent today to prevent spam
                    const existingCongratsToday = isDryRun ? null : await Notification.findOne({
                        where: {
                            recipient_id: id,
                            recipient_type: 'sales_person',
                            notification_type_id: templateInfo.typeId,
                            created_at: { [Op.gte]: todayStart }
                        }
                    });

                    if (!existingCongratsToday) {
                        const message_text = this.populateTemplate(templateInfo.text, {
                            salesperson_name: name,
                            active_leads_count: activeLeadsCount
                        });
    
                        // Update salesperson and create notification record regardless of dryRun, as requested.
                        await SalesPerson.update({ warning_count: 0 }, { where: { id } });
                        await Notification.create({
                            message: message_text,
                            recipient_type: 'sales_person',
                            recipient_id: id,
                            notification_type_id: templateInfo.typeId
                        });
    
                        notifications.push({
                            salesperson_name: name,
                            telegram_id: telegram_id, // Always use the real Telegram ID
                            branches: branches.map(b => b.name),
                            active_leads_count: activeLeadsCount,
                            warning_count: 0,
                            notification_type_id: templateInfo.typeId, 
                            message_text
                        });
                        congratulationsSent++;
                    }
                }
            }
            
            // Devolver directamente el array de notificaciones
            res.json(notifications);

        } catch (error) {
            console.error("====== DETAILED ERROR in generateSalesPersonWarningNotifications ======");
            console.error(error);
            console.error("======================================================================");
            res.status(500).json({ message: "Error generating salesperson warnings.", error: error.message });
        }
    }

    async generateManagerWarningNotifications(req, res) {
        try {
            // Paso 1: Obtener la lista de vendedores con advertencias (similar a la otra función)
            const salespersonsWithWarnings = await this.getSalespersonsWithWarnings();
            
            if (salespersonsWithWarnings.length === 0) {
                return res.json({ message: "No salespersons with warnings found.", notifications: [] });
            }

            // Paso 2: Agrupar vendedores por sucursal
            const branchesWithWarnings = this.groupSalespersonsByBranch(salespersonsWithWarnings);

            // Paso 3: Encontrar managers y construir los mensajes
            const managerNotifications = await this.buildManagerNotifications(branchesWithWarnings);
            
            // Paso 4: Generar el resumen para los administradores
            const adminSummaryNotifications = await this.buildAdminSummaryNotifications();

            // Combinar ambas listas de notificaciones
            const allNotifications = [...managerNotifications, ...adminSummaryNotifications];

            // Devolver directamente el array de notificaciones para que Make.com lo procese fácilmente
            res.json(allNotifications);

        } catch (error) {
            console.error("====== DETAILED ERROR in generateManagerWarningNotifications ======");
            console.error(error);
            res.status(500).json({ message: "Error generating manager warnings.", error: error.message });
        }
    }

    /**
     * Helper para obtener vendedores que superan el límite de leads.
     * Reutiliza la lógica de generateSalesPersonWarningNotifications pero solo para identificar.
     */
    async getSalespersonsWithWarnings() {
        const activeStatuses = await EstimateStatus.findAll({
            where: { name: ['In Progress', 'Released'] },
            attributes: ['id']
        });
        if (activeStatuses.length === 0) return [];
        const activeStatusIds = activeStatuses.map(s => s.id);

        const salespersons = await SalesPerson.findAll({
            attributes: [
                'id', 'name', 'warning_count',
                [
                    literal(`(
                        SELECT COUNT(*)
                        FROM "botzilla"."estimate" AS "e"
                        WHERE "e"."sales_person_id" = "SalesPerson"."id" AND "e"."status_id" IN (${activeStatusIds.join(',')})
                    )`),
                    'activeLeadsCount'
                ]
            ],
            include: [{
                model: Branch,
                as: 'branches',
                attributes: ['id', 'name'],
                through: { attributes: [] }
            }],
            group: ['SalesPerson.id', 'branches.id'],
            having: literal(`(
                SELECT COUNT(*)
                FROM "botzilla"."estimate" AS "e"
                WHERE "e"."sales_person_id" = "SalesPerson"."id" AND "e"."status_id" IN (${activeStatusIds.join(',')})
            ) >= 12`)
        });

        return salespersons.map(sp => sp.get({ plain: true }));
    }

    /**
     * Agrupa una lista de vendedores por sus sucursales.
     */
    groupSalespersonsByBranch(salespersons) {
        const branches = {};
        salespersons.forEach(sp => {
            sp.branches.forEach(branch => {
                if (!branches[branch.id]) {
                    branches[branch.id] = {
                        branchName: branch.name,
                        salespersons: []
                    };
                }
                branches[branch.id].salespersons.push(sp);
            });
        });
        return branches;
    }

    /**
     * Construye la lista final de notificaciones para los managers.
     */
    async buildManagerNotifications(branchesWithWarnings) {
        const notifications = [];
        const managerRole = await UserRol.findOne({ where: { name: 'manager' } });
        if (!managerRole) {
            console.error("Role 'manager' not found.");
            return [];
        }

        const [managerWarningType] = await NotificationType.findOrCreate({
            where: { name: 'Manager Warning' }
        });

        for (const branchId in branchesWithWarnings) {
            const branchInfo = branchesWithWarnings[branchId];
            const managers = await User.findAll({
                where: { rol_id: managerRole.id },
                include: [{
                    model: Branch,
                    as: 'branches',
                    where: { id: branchId },
                    attributes: [],
                    through: { attributes: [] }
                }],
                attributes: ['id', 'telegram_id']
            });

            if (managers.length > 0) {
                const salespersonList = branchInfo.salespersons.map((sp, index) => 
                    `${index + 1}. <b>${sp.name}</b>: ${sp.activeLeadsCount} jobs, ${sp.warning_count} warnings`
                ).join('\n');
                
                const messageParts = [
                    'Good morning!',
                    `Daily Over-Limit Report for <b>${branchInfo.branchName}</b>:`,
                    salespersonList,
                    'Please help these team members manage their active leads.',
                    '– Botzilla 🤖🦖'
                ];

                const messageText = messageParts.join('\n\n');

                for (const manager of managers) {
                    if (manager.telegram_id) {
                        notifications.push({
                            recipient_telegram_id: manager.telegram_id,
                            message_text: messageText,
                            branch_id: branchId,
                            manager_id: manager.id,
                            type: 'manager_warning'
                        });

                        // Save notification to DB to be viewed in the app
                        await Notification.create({
                            message: messageText,
                            recipient_type: 'user',
                            recipient_id: manager.id,
                            notification_type_id: managerWarningType.id,
                        });
                    }
                }
            }
        }
        return notifications;
    }

    /**
     * Construye la notificación de resumen para todos los administradores.
     */
    async buildAdminSummaryNotifications() {
        const salespersonsWithWarnings = await this.getSalespersonsWithWarnings();

        let summaryMessage;

        if (salespersonsWithWarnings.length === 0) {
            summaryMessage = '✅ Daily Summary: All salespersons across all branches are within their active lead limits. Great job, team!';
        } else {
            const branchesWithWarnings = this.groupSalespersonsByBranch(salespersonsWithWarnings);

            const branchSummaryLines = Object.values(branchesWithWarnings).map(branchInfo => {
                const count = branchInfo.salespersons.length;
                const plural = count > 1 ? 'salespersons' : 'salesperson';
                return `- <b>${branchInfo.branchName}</b>: ${count} ${plural} over the active jobs limit.`;
            });

            const messageParts = [
                'Daily Admin Summary:',
                ...branchSummaryLines,
                'Please check the detailed reports sent to the respective branch managers.'
            ];
            summaryMessage = messageParts.join('\n');
        }

        const messageText = `${summaryMessage}\n\n– Botzilla 🤖`;

        const [adminSummaryType] = await NotificationType.findOrCreate({
            where: { name: 'Admin Summary' }
        });

        const admins = await User.findAll({
            include: [{
                model: UserRol,
                as: 'rol',
                where: { name: 'admin' }
            }],
            attributes: ['id', 'telegram_id']
        });

        // Get unique admins by telegram_id to avoid sending duplicate Telegram messages,
        // but we will save a notification record for each admin user.
        const uniqueAdminsByTelegramId = [...new Map(admins.map(admin => [admin.telegram_id, admin])).values()]
            .filter(admin => admin.telegram_id);

        // Save a notification record for each admin user to be viewed in the app
        for (const admin of admins) {
            await Notification.create({
                message: messageText,
                recipient_type: 'user',
                recipient_id: admin.id,
                notification_type_id: adminSummaryType.id
            });
        }
        
        // Prepare the payload for Make.com with unique telegram_ids
        return uniqueAdminsByTelegramId.map(admin => ({
            recipient_telegram_id: admin.telegram_id,
            message_text: messageText,
            type: 'admin_summary'
        }));
    }

    async getAllNotifications(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                recipientId,
                recipientType,
                sort_by = 'created_at',
                sort_order = 'DESC',
                notificationTypeId,
                notificationTypeName,
                dateFrom,
                dateTo,
                recipientName,
                level
            } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (recipientId) whereClause.recipient_id = recipientId;
            if (recipientType) whereClause.recipient_type = recipientType;
            if (notificationTypeId) whereClause.notification_type_id = notificationTypeId;
            if (level) {
                if (level === '1') {
                    whereClause.message = { [Op.like]: '%Warning 1%' };
                } else if (level === '2') {
                    whereClause.message = { [Op.like]: '%Warning 2%' };
                } else if (level === '3+') {
                    whereClause.message = { [Op.like]: '%Final Warning%' };
                }
            }
            if (dateFrom || dateTo) {
                whereClause.created_at = {};
                if (dateFrom) whereClause.created_at[Op.gte] = new Date(dateFrom);
                if (dateTo) {
                    const end = new Date(dateTo);
                    end.setHours(23, 59, 59, 999);
                    whereClause.created_at[Op.lte] = end;
                }
            }
            
            const includes = [
                {
                    model: SalesPerson,
                    as: 'salesPersonRecipient',
                    attributes: ['name'],
                    ...(recipientName ? { where: { name: { [Op.iLike]: `%${recipientName}%` } }, required: true } : {})
                }
            ];
            if (notificationTypeName) {
                includes.push({
                    model: NotificationType,
                    as: 'notificationType',
                    attributes: ['name'],
                    where: { name: { [Op.iLike]: `%${notificationTypeName}%` } },
                    required: true
                });
            }

            const { count, rows } = await Notification.findAndCountAll({
                where: whereClause,
                limit: parseInt(limit),
                offset: offset,
                order: [[sort_by, sort_order.toUpperCase()]],
                include: includes,
                distinct: true
            });

            const data = rows.map(row => {
                const plain = row.get({ plain: true });
                return {
                    ...plain,
                    recipient_name: plain.salesPersonRecipient?.name || null
                };
            });

            res.json({
                total: count,
                pages: Math.ceil(count / limit),
                currentPage: parseInt(page),
                data
            });

        } catch (error) {
            res.status(500).json({ message: 'Error fetching notifications', error: error.message });
        }
    }

    async getDashboardStats(req, res) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());

            // 1. Notification counts (hoy y semana)
            const sentToday = await Notification.count({ where: { created_at: { [Op.gte]: today } } });
            const sentThisWeek = await Notification.count({ where: { created_at: { [Op.gte]: startOfWeek } } });

            // 2. Estados activos tolerantes (nombres de seeds y legacy)
            const activeStatuses = await EstimateStatus.findAll({
                where: { name: { [Op.in]: ["In Progress", "Released", "active", "released"] } },
                attributes: ['id']
            });
            const activeStatusIds = activeStatuses.map(s => s.id);

            const salespersonsOverLimit = activeStatusIds.length === 0 ? [] : await SalesPerson.findAll({
                attributes: [
                    'id', 'name',
                    [literal(`(
                        SELECT COUNT(*) FROM "botzilla"."estimate" AS "e"
                        WHERE "e"."sales_person_id" = "SalesPerson"."id" AND "e"."status_id" IN (${activeStatusIds.join(',')})
                    )`), 'activeLeadsCount']
                ],
                having: literal(`(
                    SELECT COUNT(*) FROM "botzilla"."estimate" AS "e"
                    WHERE "e"."sales_person_id" = "SalesPerson"."id" AND "e"."status_id" IN (${activeStatusIds.join(',')})
                ) >= 12`),
                group: ['SalesPerson.id'],
                order: [[literal('"activeLeadsCount"'), 'DESC']]
            });

            // 3. Listas recientes (semana): warnings y felicitaciones
            const warningType = await NotificationType.findOne({ where: { name: 'warning' } });
            const congratsType = await NotificationType.findOne({ where: { name: 'congratulations' } });

            const recentWarnings = await Notification.findAll({
                where: {
                    notification_type_id: warningType ? warningType.id : null,
                    created_at: { [Op.gte]: startOfWeek }
                },
                order: [['created_at', 'DESC']],
                limit: 10,
                include: [{ model: SalesPerson, as: 'salesPersonRecipient', attributes: ['name'] }]
            });

            const recentCongratulations = await Notification.findAll({
                where: {
                    notification_type_id: congratsType ? congratsType.id : null,
                    created_at: { [Op.gte]: startOfWeek }
                },
                order: [['created_at', 'DESC']],
                limit: 10,
                include: [{ model: SalesPerson, as: 'salesPersonRecipient', attributes: ['name'] }]
            });

            // 4. Desgloses por tipo: global, hoy, semana
            const buildTypeCounts = async (dateFilter) => {
                return await Notification.findAll({
                    attributes: [
                        [literal('"notificationType"."name"'), 'name'],
                        [literal('COUNT("Notification"."id")'), 'count']
                    ],
                    include: [{ model: NotificationType, as: 'notificationType', attributes: [] }],
                    where: dateFilter || undefined,
                    group: [literal('"notificationType"."name"')],
                    raw: true
                });
            };
            const typeCounts = await buildTypeCounts();
            const typeCountsToday = await buildTypeCounts({ created_at: { [Op.gte]: today } });
            const typeCountsThisWeek = await buildTypeCounts({ created_at: { [Op.gte]: startOfWeek } });

            // 5. Quiénes tienen warnings actualmente (warning_count > 0) y sus activos
            const currentWarnings = await SalesPerson.findAll({
                attributes: [
                    'id', 'name', 'warning_count',
                    [literal(`(
                        SELECT COUNT(*) FROM "botzilla"."estimate" AS "e"
                        WHERE "e"."sales_person_id" = "SalesPerson"."id"${activeStatusIds.length ? ` AND "e"."status_id" IN (${activeStatusIds.join(',')})` : ''}
                    )`), 'activeLeadsCount']
                ],
                where: { warning_count: { [Op.gt]: 0 } },
                order: [['warning_count', 'DESC']]
            });

            res.json({
                sentToday,
                sentThisWeek,
                salespersonsOverLimit,
                recentWarnings,
                recentCongratulations,
                typeCounts,
                typeCountsToday,
                typeCountsThisWeek,
                currentWarnings
            });

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
        }
    }

    populateTemplate(template, data) {
        let message = template;
        for (const key in data) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            message = message.replace(regex, data[key]);
        }
        // Replace literal '\\n' with actual newline characters for proper formatting.
        return message.replace(/\\n/g, '\n');
    }
}

module.exports = new NotificationsController(); 