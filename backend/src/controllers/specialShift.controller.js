const { SpecialShift } = require('../models');

const getAllSpecialShifts = async (req, res) => {
    try {
        const specialShifts = await SpecialShift.findAll({
            order: [['name', 'ASC']]
        });
        res.status(200).json(specialShifts);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching special shifts',
            error: error.message 
        });
    }
};

module.exports = {
    getAllSpecialShifts
}; 