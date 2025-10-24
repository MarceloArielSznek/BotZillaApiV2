const { Op, literal, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const { Job, Estimate, SalesPerson, Branch, Notification, NotificationType, EstimateStatus, Employee, User } = require('../models');
const { calculateJobPerformance } = require('../services/performance.service');

class DashboardController {
  async getSummary(req, res) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

      // === MÉTRICAS PRINCIPALES ===
      
      // Estimates por estado
      const [estimatesByStatus, totalEstimates] = await Promise.all([
        EstimateStatus.findAll({
          include: [{
            model: Estimate,
            as: 'estimates',
            attributes: [],
            required: false
          }],
          attributes: [
            'id', 'name',
            [fn('COUNT', col('estimates.id')), 'count']
          ],
          group: ['EstimateStatus.id', 'EstimateStatus.name'],
          raw: true
        }),
        Estimate.count()
      ]);

      // Estimates activos (In Progress + Released)
      const activeStatusIds = (
        await EstimateStatus.findAll({ where: { name: { [Op.in]: ['In Progress', 'Released'] } } })
      ).map(s => s.id);

      const activeEstimates = await Estimate.count({
        where: { status_id: { [Op.in]: activeStatusIds } }
      });

      // Revenue metrics (basado en jobs completados, no estimates creados)
      const [monthlyRevenue, lastMonthRevenue, totalRevenue] = await Promise.all([
        sequelize.query(`
          SELECT COALESCE(SUM(e.final_price), 0) as sum
          FROM "botzilla"."estimate" e
          INNER JOIN "botzilla"."job" j ON j.estimate_id = e.id
          WHERE j.closing_date >= :startOfMonth 
            AND j.closing_date <= :endOfMonth
            AND e.final_price IS NOT NULL
        `, {
          replacements: { startOfMonth: startOfMonth.toISOString(), endOfMonth: endOfMonth.toISOString() },
          type: sequelize.QueryTypes.SELECT
        }).then(result => parseFloat(result[0].sum) || 0),
        
        sequelize.query(`
          SELECT COALESCE(SUM(e.final_price), 0) as sum
          FROM "botzilla"."estimate" e
          INNER JOIN "botzilla"."job" j ON j.estimate_id = e.id
          WHERE j.closing_date >= :lastMonth 
            AND j.closing_date <= :endOfLastMonth
            AND e.final_price IS NOT NULL
        `, {
          replacements: { lastMonth: lastMonth.toISOString(), endOfLastMonth: endOfLastMonth.toISOString() },
          type: sequelize.QueryTypes.SELECT
        }).then(result => parseFloat(result[0].sum) || 0),
        
        sequelize.query(`
          SELECT COALESCE(SUM(e.final_price), 0) as sum
          FROM "botzilla"."estimate" e
          INNER JOIN "botzilla"."job" j ON j.estimate_id = e.id
          WHERE e.final_price IS NOT NULL
        `, {
          type: sequelize.QueryTypes.SELECT
        }).then(result => parseFloat(result[0].sum) || 0)
      ]);

      // Jobs metrics
      const [jobsThisMonth, jobsLastMonth, jobsCompletedToday] = await Promise.all([
        Job.count({
          where: { closing_date: { [Op.between]: [startOfMonth, endOfMonth] } }
        }),
        Job.count({
          where: { closing_date: { [Op.between]: [lastMonth, endOfLastMonth] } }
        }),
        Job.count({
          where: { closing_date: { [Op.gte]: today, [Op.lte]: endOfToday } }
        })
      ]);

      // === MÉTRICAS POR SUCURSAL ===
      const branchMetrics = await Branch.findAll({
        attributes: [
          'id', 'name',
          [literal(`(
            SELECT COUNT(*) FROM "botzilla"."estimate" AS e
            WHERE e.branch_id = "Branch".id AND e.status_id IN (${activeStatusIds.join(',') || '0'})
          )`), 'activeEstimates'],
          [literal(`(
            SELECT COUNT(*) FROM "botzilla"."job" AS j
            WHERE j.branch_id = "Branch".id AND j.closing_date >= '${startOfMonth.toISOString()}'
          )`), 'jobsThisMonth'],
          [literal(`(
            SELECT COALESCE(SUM(e.final_price), 0) FROM "botzilla"."estimate" AS e
            JOIN "botzilla"."job" AS j ON j.estimate_id = e.id
            WHERE e.branch_id = "Branch".id AND j.closing_date >= '${startOfMonth.toISOString()}'
          )`), 'revenueThisMonth']
        ],
        order: [['name', 'ASC']]
      });

      // === TEAM PERFORMANCE ===
      
      // Salespersons performance
      const salespersonsPerformance = await SalesPerson.findAll({
        where: { is_active: true },
        attributes: [
          'id', 'name', 'warning_count',
          [literal(`(
            SELECT COUNT(*) FROM "botzilla"."estimate" AS e
            WHERE e.sales_person_id = "SalesPerson".id AND e.status_id IN (${activeStatusIds.join(',') || '0'})
          )`), 'activeLeads'],
          [literal(`(
            SELECT COUNT(*) FROM "botzilla"."estimate" AS e
            WHERE e.sales_person_id = "SalesPerson".id AND e.created_at >= '${startOfMonth.toISOString()}'
          )`), 'estimatesThisMonth'],
          [literal(`(
            SELECT COALESCE(SUM(e.final_price), 0) FROM "botzilla"."estimate" AS e
            JOIN "botzilla"."job" AS j ON j.estimate_id = e.id
            WHERE e.sales_person_id = "SalesPerson".id AND j.closing_date >= '${startOfMonth.toISOString()}'
          )`), 'revenueThisMonth']
        ],
        order: [[literal('"activeLeads"'), 'DESC']],
        limit: 20
      });

      // Salespersons over limit (más de 12 leads activos)
      const salespersonsOverLimit = salespersonsPerformance.filter(sp => 
        parseInt(sp.dataValues.activeLeads) > 12
      );

      // Top performers this month
      const topPerformers = salespersonsPerformance
        .sort((a, b) => parseFloat(b.dataValues.revenueThisMonth) - parseFloat(a.dataValues.revenueThisMonth))
        .slice(0, 5);

      // === NOTIFICATIONS ===
      const [sentToday, sentThisWeek, warningType] = await Promise.all([
        Notification.count({ where: { created_at: { [Op.gte]: today } } }),
        Notification.count({ where: { created_at: { [Op.gte]: startOfWeek } } }),
        NotificationType.findOne({ where: { name: 'warning' } })
      ]);

      const recentWarnings = await Notification.findAll({
        where: { notification_type_id: warningType ? warningType.id : null },
        order: [['created_at', 'DESC']],
        limit: 10,
        include: [{ model: SalesPerson, as: 'salesPersonRecipient', attributes: ['name'] }]
      });

      // === JOBS RECIENTES CON PERFORMANCE ===
      const recentJobs = await Job.findAll({
        where: { closing_date: { [Op.gte]: startOfWeek } },
        include: [
          { model: Branch, as: 'branch', attributes: ['name'] },
          { model: Estimate, as: 'estimate', attributes: ['name'], include: [{ model: SalesPerson, as: 'salesperson', attributes: ['name'] }] },
          { model: Employee, as: 'crewLeader', attributes: ['id', 'first_name', 'last_name'] }
        ],
        order: [['closing_date', 'DESC']],
        limit: 10
      });

      // Calcular performance para jobs recientes
      const jobsWithPerformance = [];
      for (const job of recentJobs) {
        const crewLeaderName = job.crewLeader 
          ? `${job.crewLeader.first_name} ${job.crewLeader.last_name}` 
          : null;
        
        try {
          const perf = await calculateJobPerformance(job.id);
          jobsWithPerformance.push({
            id: job.id,
            name: job.name,
            branch: job.branch?.name || null,
            estimator: job.estimate?.salesperson?.name || null,
            crewLeader: crewLeaderName,
            closing_date: job.closing_date,
            review: job.review,
            actualSavedPercent: perf.actualSavedPercent,
            jobBonusPool: perf.jobBonusPool
          });
        } catch (_) {
          jobsWithPerformance.push({
            id: job.id,
            name: job.name,
            branch: job.branch?.name || null,
            estimator: job.estimate?.salesperson?.name || null,
            crewLeader: crewLeaderName,
            closing_date: job.closing_date,
            review: job.review,
            actualSavedPercent: 0,
            jobBonusPool: 0
          });
        }
      }

      // === SYSTEM STATS ===
      const [totalSalespersons, totalCrewMembers, totalBranches, totalUsers] = await Promise.all([
        SalesPerson.count({ where: { is_active: true } }),
        Employee.count({ where: { role: 'crew_member', status: 'active', is_deleted: false } }),
        Branch.count(),
        User.count()
      ]);

      // === CALCULAR TRENDS ===
      const revenueGrowth = lastMonthRevenue > 0 ? 
        ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;
      
      const jobsGrowth = jobsLastMonth > 0 ? 
        ((jobsThisMonth - jobsLastMonth) / jobsLastMonth * 100) : 0;

      // Promedio de estimates por día esta semana
      const estimatesThisWeek = await Estimate.count({
        where: { created_at: { [Op.gte]: startOfWeek } }
      });
      const daysThisWeek = Math.ceil((today - startOfWeek) / (1000 * 60 * 60 * 24)) + 1;
      const estimatesPerDay = estimatesThisWeek / daysThisWeek;

      res.json({
        // Métricas principales
        businessMetrics: {
          estimates: {
            total: totalEstimates,
            active: activeEstimates,
            byStatus: estimatesByStatus,
            weeklyAverage: Math.round(estimatesPerDay * 10) / 10
          },
          revenue: {
            thisMonth: monthlyRevenue || 0,
            lastMonth: lastMonthRevenue || 0,
            total: totalRevenue || 0,
            growth: Math.round(revenueGrowth * 10) / 10
          },
          jobs: {
            thisMonth: jobsThisMonth,
            lastMonth: jobsLastMonth,
            completedToday: jobsCompletedToday,
            growth: Math.round(jobsGrowth * 10) / 10,
            recent: jobsWithPerformance
          }
        },

        // Performance del equipo
        teamPerformance: {
          salespersons: {
            total: totalSalespersons,
            overLimit: salespersonsOverLimit,
            topPerformers: topPerformers,
            all: salespersonsPerformance
          },
          crew: {
            total: totalCrewMembers
          }
        },

        // Métricas por sucursal
        branchMetrics: branchMetrics,

        // Notificaciones y alertas
        notifications: { 
          sentToday, 
          sentThisWeek, 
          recentWarnings 
        },

        // Estadísticas del sistema
        systemStats: {
          totalUsers,
          totalBranches,
          totalSalespersons,
          totalCrewMembers
        },

        // Para compatibilidad con el frontend actual
        salespersonsOverLimit,
        jobs: {
          closedToday: jobsCompletedToday,
          items: jobsWithPerformance,
          mostProfitableToday: jobsWithPerformance
            .sort((a, b) => (b.jobBonusPool || 0) - (a.jobBonusPool || 0))
            .slice(0, 10)
        },
        employees: { 
          latestSalespersons: topPerformers.slice(0, 5).map(sp => ({ id: sp.id, name: sp.name })),
          latestCrew: [] // Mantenemos vacío por compatibilidad
        }
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ message: 'Error fetching dashboard summary', error: error.message });
    }
  }
}

module.exports = new DashboardController();

