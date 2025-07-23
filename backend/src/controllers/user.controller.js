const { User, UserRol, Branch } = require('../models');
const bcrypt = require('bcryptjs');

// Create user (admin only)
exports.createUser = async (req, res) => {
    try {
        const { email, password, phone, telegram_id, rol_id, branch_ids } = req.body;
        console.log(`[USER CREATE] Attempt to create user with email: ${email} by admin ID: ${req.user.id}`);

        // Check if email already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            console.log(`[USER CREATE] Failed - Email ${email} already exists`);
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Verify if rol exists
        const rol = await UserRol.findByPk(rol_id);
        if (!rol) {
            console.log(`[USER CREATE] Failed - Role ID ${rol_id} does not exist`);
            return res.status(400).json({ message: 'Invalid role ID' });
        }

        // Create user
        const user = await User.create({
            email,
            password, // Password will be hashed by model hook
            phone: phone || null,
            telegram_id: telegram_id || null,
            rol_id
        });

        // Handle branch associations
        if (branch_ids && branch_ids.length > 0) {
            await user.setBranches(branch_ids);
        }

        console.log(`[USER CREATE] Success - Created user ID: ${user.id}, Email: ${email}, Role: ${rol_id}`);

        // Get user with role and branches
        const createdUser = await User.findByPk(user.id, {
            include: [
                { model: UserRol, as: 'rol' },
                { model: Branch, as: 'branches', through: { attributes: [] } }
            ],
            attributes: { exclude: ['password'] }
        });

        res.status(201).json({
            message: 'User created successfully',
            user: createdUser
        });
    } catch (error) {
        console.error('[USER CREATE] Error:', error);
        // Mejorar el mensaje de error para el cliente
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: error.errors.map(e => ({
                    field: e.path,
                    message: e.message
                }))
            });
        }
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Email already in use' });
        }
        res.status(500).json({ message: 'Error creating user' });
    }
};

// Get all user roles (admin only)
exports.getUserRoles = async (req, res) => {
    try {
        console.log(`[ROLES LIST] Admin ID: ${req.user.id} requesting all roles`);
        const roles = await UserRol.findAll({ order: [['name', 'ASC']] });
        console.log(`[ROLES LIST] Success - Retrieved ${roles.length} roles`);
        res.json(roles);
    } catch (error) {
        console.error('[ROLES LIST] Error:', error);
        res.status(500).json({ message: 'Error getting user roles list' });
    }
};

// Get all users (admin only)
exports.getUsers = async (req, res) => {
    try {
        console.log(`[USER LIST] Admin ID: ${req.user.id} requesting all users`);
        const users = await User.findAll({
            include: [
                {
                    model: UserRol,
                    as: 'rol'
                },
                {
                    model: Branch,
                    as: 'branches',
                    through: { attributes: [] } // No incluir la tabla de unión en el resultado
                }
            ],
            attributes: { exclude: ['password'] }
        });
        console.log(`[USER LIST] Success - Retrieved ${users.length} users`);
        res.json(users);
    } catch (error) {
        console.error('[USER LIST] Error:', error);
        res.status(500).json({ message: 'Error getting users list' });
    }
};

// Get user by ID
exports.getUserById = async (req, res) => {
    try {
        console.log(`[USER GET] Request for user ID: ${req.params.id} by user ID: ${req.user.id}`);
        const user = await User.findByPk(req.params.id, {
            include: [{
                model: UserRol,
                as: 'rol'
            }],
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            console.log(`[USER GET] Failed - User ID: ${req.params.id} not found`);
            return res.status(404).json({ message: 'User not found' });
        }

        // Only allow viewing details if it's the same user or an admin
        if (req.user.rol.name !== 'admin' && req.user.id !== user.id) {
            console.log(`[USER GET] Unauthorized - User ID: ${req.user.id} attempted to view user ID: ${req.params.id}`);
            return res.status(403).json({ message: 'Not authorized' });
        }

        console.log(`[USER GET] Success - Retrieved user ID: ${user.id}`);
        res.json(user);
    } catch (error) {
        console.error('[USER GET] Error:', error);
        res.status(500).json({ message: 'Error getting user' });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        console.log(`[USER UPDATE] Attempt to update user ID: ${req.params.id} by user ID: ${req.user.id}`);
        const user = await User.findByPk(req.params.id);
        
        if (!user) {
            console.log(`[USER UPDATE] Failed - User ID: ${req.params.id} not found`);
            return res.status(404).json({ message: 'User not found' });
        }

        // Only allow updating if it's the same user or an admin
        if (req.user.rol.name !== 'admin' && req.user.id !== user.id) {
            console.log(`[USER UPDATE] Unauthorized - User ID: ${req.user.id} attempted to update user ID: ${req.params.id}`);
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { email, phone, telegram_id, password, rol_id, branch_ids } = req.body;
        console.log(`[USER UPDATE] Update data for user ID: ${user.id}:`, { 
            email: email || '[unchanged]', 
            phone: phone || '[unchanged]', 
            telegram_id: telegram_id || '[unchanged]',
            rol_id: rol_id || '[unchanged]',
            branch_ids: branch_ids ? `[${branch_ids.join(',')}]` : '[unchanged]',
            password: password ? '[changed]' : '[unchanged]'
        });
        
        // Only admin can change roles
        if (rol_id && req.user.rol.name !== 'admin') {
            console.log(`[USER UPDATE] Unauthorized role change attempt - User ID: ${req.user.id}`);
            return res.status(403).json({ message: 'Only admin can change roles' });
        }

        // Verify if email already exists
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                console.log(`[USER UPDATE] Failed - Email ${email} already in use`);
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        // Update user data
        const updateData = {
            email: email || user.email,
            phone: phone || user.phone,
            telegram_id: telegram_id || user.telegram_id,
            rol_id: rol_id || user.rol_id
        };

        // If password is provided, hash it
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        await user.update(updateData);

        // Handle branch associations
        if (branch_ids) { // It can be an empty array to remove all branches
            await user.setBranches(branch_ids);
        }

        console.log(`[USER UPDATE] Success - Updated user ID: ${user.id}`);

        // Get updated user with role and branches
        const updatedUser = await User.findByPk(user.id, {
            include: [
                { model: UserRol, as: 'rol' },
                { model: Branch, as: 'branches', through: { attributes: [] } }
            ],
            attributes: { exclude: ['password'] }
        });

        res.json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('[USER UPDATE] Error:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        console.log(`[PASSWORD CHANGE] Attempt for user ID: ${req.params.id} by user ID: ${req.user.id}`);
        const user = await User.findByPk(req.params.id);
        
        if (!user) {
            console.log(`[PASSWORD CHANGE] Failed - User ID: ${req.params.id} not found`);
            return res.status(404).json({ message: 'User not found' });
        }

        // Only allow changing password if it's the same user
        if (req.user.id !== user.id) {
            console.log(`[PASSWORD CHANGE] Unauthorized - User ID: ${req.user.id} attempted to change password for user ID: ${req.params.id}`);
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { currentPassword, newPassword } = req.body;

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            console.log(`[PASSWORD CHANGE] Failed - Invalid current password for user ID: ${user.id}`);
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await user.update({ password: hashedPassword });
        console.log(`[PASSWORD CHANGE] Success - Password changed for user ID: ${user.id}`);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('[PASSWORD CHANGE] Error:', error);
        res.status(500).json({ message: 'Error changing password' });
    }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
    try {
        console.log(`[USER DELETE] Attempt to delete user ID: ${req.params.id} by admin ID: ${req.user.id}`);
        const user = await User.findByPk(req.params.id);
        
        if (!user) {
            console.log(`[USER DELETE] Failed - User ID: ${req.params.id} not found`);
            return res.status(404).json({ message: 'User not found' });
        }

        // Only admin can delete users
        if (req.user.rol.name !== 'admin') {
            console.log(`[USER DELETE] Unauthorized - User ID: ${req.user.id} attempted to delete user ID: ${req.params.id}`);
            return res.status(403).json({ message: 'Not authorized' });
        }

        await user.destroy();
        console.log(`[USER DELETE] Success - Deleted user ID: ${req.params.id}, Email: ${user.email}`);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('[USER DELETE] Error:', error);
        res.status(500).json({ message: 'Error deleting user' });
    }
}; 