const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboarding.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validateGroupAssignment, validateGroupBlocking, validateKickFromAllGroups } = require('../middleware/validation.middleware');

/**
 * @route POST /api/onboarding/assign-groups
 * @desc Assign an employee to multiple Telegram groups
 * @access Private (requires authentication)
 */
router.post(
    '/assign-groups',
    verifyToken,
    validateGroupAssignment,
    onboardingController.assignGroups
);

/**
 * @route POST /api/onboarding/block-group
 * @desc Block an employee from a specific Telegram group
 * @access Private (requires authentication)
 */
router.post(
    '/block-group',
    verifyToken,
    validateGroupBlocking,
    onboardingController.blockFromGroup
);

router.post(
    '/kick-from-all-groups',
    verifyToken,
    validateKickFromAllGroups,
    onboardingController.kickFromAllGroups
);

module.exports = router;
