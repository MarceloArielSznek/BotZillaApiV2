const express = require('express');
const router = express.Router();
const { SheetColumnMap } = require('../models');
const { verifyToken } = require('../middleware/auth.middleware');

// GET /api/column-map - Obtener todos los column maps
router.get('/', verifyToken, async (req, res) => {
    try {
        const columnMaps = await SheetColumnMap.findAll({
            order: [['sheet_name', 'ASC'], ['column_index', 'ASC']]
        });

        // Agrupar por sheet_name
        const groupedMaps = columnMaps.reduce((acc, map) => {
            if (!acc[map.sheet_name]) {
                acc[map.sheet_name] = [];
            }
            acc[map.sheet_name].push({
                id: map.id,
                field_name: map.field_name,
                column_index: map.column_index,
                type: map.type,
                header_name: map.header_name
            });
            return acc;
        }, {});

        res.json({
            success: true,
            data: groupedMaps
        });
    } catch (error) {
        console.error('Error fetching column maps:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching column maps',
            error: error.message
        });
    }
});

// GET /api/column-map/:sheetName - Obtener column map para una sheet específica
router.get('/:sheetName', verifyToken, async (req, res) => {
    try {
        const { sheetName } = req.params;
        
        const columnMaps = await SheetColumnMap.findAll({
            where: { sheet_name: sheetName },
            order: [['column_index', 'ASC']]
        });

        res.json({
            success: true,
            sheet_name: sheetName,
            columns: columnMaps.map(map => ({
                id: map.id,
                field_name: map.field_name,
                column_index: map.column_index,
                type: map.type,
                header_name: map.header_name
            }))
        });
    } catch (error) {
        console.error(`Error fetching column map for sheet ${req.params.sheetName}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error fetching column map',
            error: error.message
        });
    }
});

// PUT /api/column-map/:id - Actualizar un mapping específico
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { field_name, type, header_name } = req.body;

        const columnMap = await SheetColumnMap.findByPk(id);
        if (!columnMap) {
            return res.status(404).json({
                success: false,
                message: 'Column mapping not found'
            });
        }

        // Campos permitidos para actualizar
        const updateData = {};
        if (field_name !== undefined) updateData.field_name = field_name;
        if (type !== undefined) updateData.type = type;
        if (header_name !== undefined) updateData.header_name = header_name;

        await columnMap.update(updateData);

        res.json({
            success: true,
            message: 'Column mapping updated successfully',
            data: {
                id: columnMap.id,
                field_name: columnMap.field_name,
                column_index: columnMap.column_index,
                type: columnMap.type,
                header_name: columnMap.header_name,
                sheet_name: columnMap.sheet_name
            }
        });
    } catch (error) {
        console.error(`Error updating column mapping ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error updating column mapping',
            error: error.message
        });
    }
});

// DELETE /api/column-map/:sheetName - Eliminar todos los mappings de una sheet
router.delete('/:sheetName', verifyToken, async (req, res) => {
    try {
        const { sheetName } = req.params;
        
        const deletedCount = await SheetColumnMap.destroy({
            where: { sheet_name: sheetName }
        });

        res.json({
            success: true,
            message: `Deleted ${deletedCount} column mappings for sheet "${sheetName}"`,
            deletedCount
        });
    } catch (error) {
        console.error(`Error deleting column mappings for sheet ${req.params.sheetName}:`, error);
        res.status(500).json({
            success: false,
            message: 'Error deleting column mappings',
            error: error.message
        });
    }
});

module.exports = router;
