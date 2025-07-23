const jwt = require('jsonwebtoken');
const { User, UserRol } = require('../models');

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findByPk(decoded.id, {
            include: [{
                model: UserRol,
                as: 'rol'
            }]
        });

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user.rol.name !== 'admin') {
        return res.status(403).json({ message: 'Require Admin Role!' });
    }
    next();
};

module.exports = {
    verifyToken,
    isAdmin
}; 