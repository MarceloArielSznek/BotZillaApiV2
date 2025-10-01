const { InspectionReport } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Helper function to determine if a report is a lead
const isLead = (report) => {
  return report.full_roof_inspection_interest === true || 
         report.full_hvac_furnace_inspection_interest === true;
};

// Helper function to determine if a report is an opportunity
const isOpportunity = (report) => {
  return report.roof_condition === 'needs_replacement' || 
         report.system_condition === 'needs_replacement';
};

// Helper function to determine the status (Lead, Opportunity, Both, or Report)
const getStatus = (report) => {
  const isLeadReport = isLead(report);
  const isOppReport = isOpportunity(report);
  
  if (isLeadReport && isOppReport) {
    return 'Lead & Opportunity';
  } else if (isOppReport) {
    return 'Opportunity';
  } else if (isLeadReport) {
    return 'Lead';
  }
  return 'Report';
};

// Helper function to determine the service type (Roofing, HVAC, Both)
const getServiceType = (report) => {
  const hasRoofing = report.full_roof_inspection_interest === true || 
                     report.roof_condition === 'needs_replacement';
  const hasHVAC = report.full_hvac_furnace_inspection_interest === true || 
                  report.system_condition === 'needs_replacement';
  
  if (hasRoofing && hasHVAC) {
    return 'Both';
  } else if (hasRoofing) {
    return 'Roofing';
  } else if (hasHVAC) {
    return 'HVAC';
  }
  return '-';
};

exports.getAllInspectionReports = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'created_at', 
      order = 'DESC',
      startDate,
      endDate,
      branch_name,
      salesperson_name,
      search,
      type,
      service_type,
      ...filters 
    } = req.query;

    const offset = (page - 1) * limit;

    // Build filter query
    const where = {};
    
    // Date range filter
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.created_at[Op.lte] = new Date(endDate);
      }
    }

    // Branch filter
    if (branch_name) {
      where.branch_name = { [Op.like]: `%${branch_name}%` };
    }

    // Salesperson filter
    if (salesperson_name) {
      where.salesperson_name = { [Op.like]: `%${salesperson_name}%` };
    }

    // General search filter
    if (search) {
      where[Op.or] = [
        { estimate_name: { [Op.like]: `%${search}%` } },
        { client_name: { [Op.like]: `%${search}%` } },
        { client_email: { [Op.like]: `%${search}%` } },
        { client_phone: { [Op.like]: `%${search}%` } },
        { client_address: { [Op.like]: `%${search}%` } },
      ];
    }

    // Other filters
    for (const key in filters) {
      if (filters.hasOwnProperty(key)) {
        where[key] = { [Op.like]: `%${filters[key]}%` };
      }
    }

    // If filtering by type or service_type, we need to fetch all records first, then filter and paginate
    let enrichedData;
    let totalCount;
    
    if (type || service_type) {
      // Fetch all matching records (without pagination)
      const allRows = await InspectionReport.findAll({
        where,
        order: [[sort, order]],
      });

      // Enrich all data
      let allEnrichedData = allRows.map(report => {
        const reportData = report.toJSON();
        return {
          ...reportData,
          is_lead: isLead(reportData),
          is_opportunity: isOpportunity(reportData),
          status: getStatus(reportData),
          service_type: getServiceType(reportData)
        };
      });

      // Filter by type (status)
      if (type) {
        allEnrichedData = allEnrichedData.filter(report => report.status === type);
      }

      // Filter by service_type
      if (service_type) {
        allEnrichedData = allEnrichedData.filter(report => report.service_type === service_type);
      }

      totalCount = allEnrichedData.length;

      // Apply pagination manually
      const startIndex = parseInt(offset, 10);
      const endIndex = startIndex + parseInt(limit, 10);
      enrichedData = allEnrichedData.slice(startIndex, endIndex);
    } else {
      // Normal flow without type filter
      const { count, rows } = await InspectionReport.findAndCountAll({
        where,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        order: [[sort, order]],
      });

      totalCount = count;
      enrichedData = rows.map(report => {
        const reportData = report.toJSON();
        return {
          ...reportData,
          is_lead: isLead(reportData),
          is_opportunity: isOpportunity(reportData),
          status: getStatus(reportData),
          service_type: getServiceType(reportData)
        };
      });
    }

    res.status(200).json({
      success: true,
      data: enrichedData,
      total: totalCount,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching inspection reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inspection reports',
      error: error.message,
    });
  }
};

exports.getInspectionReportsStats = async (req, res) => {
  try {
    const { startDate, endDate, branch_name } = req.query;

    // Build filter query
    const where = {};
    
    // Date range filter
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.created_at[Op.lte] = new Date(endDate);
      }
    }

    // Branch filter
    if (branch_name) {
      where.branch_name = { [Op.like]: `%${branch_name}%` };
    }

    // Get all reports matching filters
    const reports = await InspectionReport.findAll({ where });

    // Calculate overall statistics
    const totalReports = reports.length;
    const roofingLeads = reports.filter(r => r.full_roof_inspection_interest === true).length;
    const hvacLeads = reports.filter(r => r.full_hvac_furnace_inspection_interest === true).length;
    // Total leads = sum of all leads (if a report has both, it counts as 2 leads)
    const totalLeads = roofingLeads + hvacLeads;
    const roofNotificationsSent = reports.filter(r => r.roof_notification_sent === true).length;
    const hvacNotificationsSent = reports.filter(r => r.hvac_notification_sent === true).length;
    
    // Calculate opportunities by type
    const roofOpportunities = reports.filter(r => r.roof_condition === 'needs_replacement').length;
    const hvacOpportunities = reports.filter(r => r.system_condition === 'needs_replacement').length;
    const totalOpportunities = roofOpportunities + hvacOpportunities;

    // Calculate stats by branch
    const branchStats = {};
    reports.forEach(report => {
      const branch = report.branch_name || 'Unknown';
      if (!branchStats[branch]) {
        branchStats[branch] = {
          total: 0,
          leads: 0,
          roofingLeads: 0,
          hvacLeads: 0,
          opportunities: 0,
        };
      }
      branchStats[branch].total++;
      
      // Count leads: each interest counts separately
      if (report.full_roof_inspection_interest === true) {
        branchStats[branch].leads++;
        branchStats[branch].roofingLeads++;
      }
      if (report.full_hvac_furnace_inspection_interest === true) {
        branchStats[branch].leads++;
        branchStats[branch].hvacLeads++;
      }
      
      if (isOpportunity(report)) {
        branchStats[branch].opportunities++;
      }
    });

    // Calculate conversion rates
    const branchStatsWithConversion = Object.keys(branchStats).map(branch => ({
      branch,
      total: branchStats[branch].total,
      leads: branchStats[branch].leads,
      roofingLeads: branchStats[branch].roofingLeads,
      hvacLeads: branchStats[branch].hvacLeads,
      opportunities: branchStats[branch].opportunities,
      conversionRate: branchStats[branch].total > 0 
        ? ((branchStats[branch].leads / branchStats[branch].total) * 100).toFixed(2)
        : 0
    }));

    res.status(200).json({
      success: true,
      data: {
        overall: {
          totalReports,
          totalLeads,
          roofingLeads,
          hvacLeads,
          roofNotificationsSent,
          hvacNotificationsSent,
          totalOpportunities,
          roofOpportunities,
          hvacOpportunities,
          overallConversionRate: totalReports > 0 
            ? ((totalLeads / totalReports) * 100).toFixed(2)
            : 0
        },
        byBranch: branchStatsWithConversion
      }
    });
  } catch (error) {
    console.error('Error fetching inspection reports stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inspection reports statistics',
      error: error.message,
    });
  }
};
