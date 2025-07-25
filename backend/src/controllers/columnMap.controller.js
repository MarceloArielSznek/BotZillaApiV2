const { SheetColumnMap } = require('../models');
const sequelize = require('../config/database');

/**
 * @description Syncs the column mapping from a spreadsheet header.
 * This endpoint receives a sheet name and a header row, processes them,
 * and performs a bulk UPSERT operation into the database.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
exports.syncColumnMap = async (req, res) => {
  const { sheet_name, header_row } = req.body;

  // 1. Validation
  if (!sheet_name || !header_row || !Array.isArray(header_row)) {
    return res.status(400).json({
      success: false,
      message: '`sheet_name` and `header_row` (as an array) are required.'
    });
  }

  try {
    // 2. Process the header row
    const recordsToSync = header_row
      .map((fieldName, index) => {
        if (!fieldName || typeof fieldName !== 'string' || fieldName.trim() === '') {
          return null; // Ignore empty or invalid field names
        }
        const trimmedFieldName = fieldName.trim();
        return {
          sheet_name: sheet_name.trim(),
          field_name: trimmedFieldName,
          column_index: index,
          type: trimmedFieldName.includes(' ') ? 'crew_member' : 'field'
        };
      })
      .filter(Boolean); // Remove null entries

    if (recordsToSync.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No valid columns to sync.',
        created: 0,
        updated: 0
      });
    }

    // 3. Perform bulk UPSERT
    // The `updateOnDuplicate` option tells Sequelize to update the specified fields
    // if a record with the same unique key (sheet_name, field_name) already exists.
    const result = await SheetColumnMap.bulkCreate(recordsToSync, {
      updateOnDuplicate: ['column_index', 'type']
    });

    // Note: The result from bulkCreate with updateOnDuplicate doesn't easily distinguish
    // between created and updated records. We can consider the operation successful.
    console.log(`✅ Column map for sheet "${sheet_name}" synced successfully.`);

    res.status(200).json({
      success: true,
      message: `Successfully synced ${result.length} columns for sheet "${sheet_name}".`,
      syncedRecords: result.length
    });

  } catch (error) {
    console.error(`❌ Error syncing column map for sheet "${sheet_name}":`, error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred during the sync.',
      error: error.message
    });
  }
}; 