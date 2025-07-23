const jwt = require('jsonwebtoken');
const { User, UserRol } = require('../models');
const { logger } = require('../utils/logger');

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        logger.authEvent('Login Attempt', { email }, {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Buscar usuario
        const user = await User.findOne({
            where: { email },
            include: [{
                model: UserRol,
                as: 'rol'
            }]
        });

        if (!user) {
            logger.authEvent('Login Failed - User Not Found', { email }, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        logger.debug('User found for login', {
            userId: user.id,
            email: user.email,
            role: user.rol?.name,
            hasPassword: !!user.password
        });

        // Validar contraseña
        const isValidPassword = await user.validatePassword(password);
        console.log('[LOGIN] Resultado de validación de contraseña:', isValidPassword);

        if (!isValidPassword) {
            console.log('[LOGIN] Contraseña inválida para usuario:', email);
            return res.status(401).json({ message: 'Contraseña inválida' });
        }

        // Generar token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.rol.name },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        console.log('[LOGIN] Login exitoso para:', email);

        res.json({
            id: user.id,
            email: user.email,
            role: user.rol.name,
            token
        });
    } catch (error) {
        console.error('[LOGIN] Error de login:', error);
        res.status(500).json({ message: 'Error durante el proceso de login' });
    }
};

exports.register = async (req, res) => {
    try {
        const { email, password, phone, telegram_id } = req.body;

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'El email ya está registrado' });
        }

        // Obtener el rol 'user'
        const userRole = await UserRol.findOne({ where: { name: 'user' } });
        if (!userRole) {
            return res.status(500).json({ message: 'Error al asignar rol de usuario' });
        }

        // Crear usuario
        const user = await User.create({
            email,
            password, // Se encripta automáticamente por el hook del modelo
            phone,
            telegram_id,
            rol_id: userRole.id
        });

        // Generar token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            id: user.id,
            email: user.email,
            role: 'user',
            token
        });
    } catch (error) {
        console.error('Error de registro:', error);
        res.status(500).json({ message: 'Error durante el proceso de registro' });
    }
};

exports.logout = async (req, res) => {
    // En el frontend se debe eliminar el token
    res.json({ message: 'Sesión cerrada exitosamente' });
};

exports.verifyToken = async (req, res) => {
    // Si llegamos aquí, significa que el token es válido (gracias al middleware)
    const user = await User.findByPk(req.user.id, {
        include: [{
            model: UserRol,
            as: 'rol'
        }]
    });

    res.json({
        id: user.id,
        email: user.email,
        role: user.rol.name
    });
}; 