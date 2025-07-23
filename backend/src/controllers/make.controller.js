const { User, SalesPerson, CrewMember, Branch, Op } = require('../models');
const { Op: SequelizeOp } = require('sequelize'); // Import Op from sequelize

/**
 * @description Find a user, salesperson, or crew member by their Telegram ID.
 * This is intended for use by Make.com automations.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
const findUserByTelegramId = async (req, res) => {
  const { telegram_id } = req.body;

  if (!telegram_id) {
    return res.status(400).json({ message: 'telegram_id is required' });
  }

  const baseResponse = {
    telegram_id: telegram_id,
    branches: [],
    entity_id: null,
    name: null,
    role: null,
    exists: false,
  };

  try {
    // 1. Search in Users table (Admins, Managers)
    let user = await User.findOne({
      where: { telegram_id },
      include: [{ model: Branch, as: 'branches', through: { attributes: [] } }],
    });

    if (user) {
      baseResponse.exists = true;
      baseResponse.entity_id = user.id;
      baseResponse.name = user.name;
      baseResponse.role = user.roleId === 1 ? 'admin' : 'manager'; // Assuming 1 is Admin
      baseResponse.branches = user.branches.map(b => ({ id: b.id, name: b.name }));
      return res.json(baseResponse);
    }

    // 2. Search in SalesPerson table
    let salesperson = await SalesPerson.findOne({
      where: { telegram_id },
      include: [{ model: Branch, as: 'branches', through: { attributes: [] } }],
    });

    if (salesperson) {
      baseResponse.exists = true;
      baseResponse.entity_id = salesperson.id;
      baseResponse.name = salesperson.name;
      baseResponse.role = 'salesperson';
      baseResponse.branches = salesperson.branches.map(b => ({ id: b.id, name: b.name }));
      return res.json(baseResponse);
    }

    // 3. Search in CrewMember table
    let crewMember = await CrewMember.findOne({
      where: { telegram_id },
      include: [{ model: Branch, as: 'branches', through: { attributes: [] } }],
    });

    if (crewMember) {
      baseResponse.exists = true;
      baseResponse.entity_id = crewMember.id;
      baseResponse.name = crewMember.name;
      baseResponse.role = 'crew_member';
      baseResponse.branches = crewMember.branches.map(b => ({ id: b.id, name: b.name }));
      return res.json(baseResponse);
    }

    // 4. If not found anywhere
    return res.json(baseResponse);

  } catch (error) {
    console.error('Error finding user by Telegram ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Verifies if the provided access key matches the one in the environment.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
const verifyAccessKey = async (req, res) => {
  const { accessKey } = req.body;
  const serverKey = process.env.TELEGRAM_BOT_ACCESS_KEY;

  if (!serverKey) {
    console.error('CRITICAL: TELEGRAM_BOT_ACCESS_KEY is not set in the environment variables.');
    return res.status(500).json({ message: 'Internal Server Error: Access key not configured.' });
  }

  if (!accessKey) {
    return res.status(400).json({ success: false, message: 'Access key is required.' });
  }

  if (accessKey === serverKey) {
    return res.json({ success: true, message: 'Access key verified successfully.' });
  } else {
    return res.status(200).json({ success: false, message: 'Invalid access key.' });
  }
};

/**
 * @description Provides a simple list of all branches (id and name) for Make.com.
 */
const listAllBranches = async (req, res) => {
  try {
    const branches = await Branch.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    if (branches.length === 0) {
      res.type('text/html').send('No branches were found in the system.');
      return;
    }

    // 1. Create the formatted MarkdownV2 message string for Telegram
    const messageLines
     = branches.map((branch, index) => {
      // Note: We need to escape special Markdown characters in branch names if they exist.
      // For now, assuming names are simple.
      return `${index + 1}. ${branch.name}`;
    });
    const message = "Please reply with the number of the branch you want to check:\n\n" + messageLines
    .join('\n');

    res.type('text/plain').send(message);

  } catch (error) {
    console.error('Error fetching branches list for Make.com:', error);
    res.status(500).type('text/plain').send('An error occurred while fetching the branches list.');
  }
};

/**
 * @description Gets all salespersons for a specific branch that do not have a Telegram ID.
 */
const getSalespersonsWithoutTelegram = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the Branch first and then include its SalesPersons, filtering them.
    const branch = await Branch.findByPk(id, {
      include: [{
        model: SalesPerson,
        as: 'salespersons', // Correct alias
        attributes: ['id', 'name'],
        where: {
          telegram_id: {
            [SequelizeOp.is]: null
          }
        },
        through: { attributes: [] }, // Don't include the join table attributes
        required: false // Use LEFT JOIN to get the branch even if it has no such salespersons
      }],
      order: [
        [{ model: SalesPerson, as: 'salespersons' }, 'name', 'ASC'] // Correct alias
      ]
    });

    if (!branch) {
      return res.status(404).json({ message: 'Branch not found.' });
    }

    // Return just the array of salespersons, or an empty array if none were found.
    res.json(branch.salespersons || []);

  } catch (error) {
    console.error(`Error in getSalespersonsWithoutTelegram for branch ${req.params.id}:`, error);
    res.status(500).json({ message: 'Error fetching salespersons without Telegram ID', error: error.message });
  }
};

/**
 * @description Translates a user's numerical choice to a branch ID.
 */
const getBranchIdByChoice = async (req, res) => {
  try {
    const { choice } = req.query;
    if (!choice || isNaN(parseInt(choice))) {
      return res.status(400).json({ message: 'A valid numerical "choice" query parameter is required.' });
    }

    // We must fetch the branches in the exact same order as before to get the correct mapping
    const branches = await Branch.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    const choiceIndex = parseInt(choice) - 1;

    if (choiceIndex < 0 || choiceIndex >= branches.length) {
      return res.status(404).json({ message: 'The selected choice number is invalid or out of range.' });
    }

    const selectedBranch = branches[choiceIndex];

    res.json({
      branchId: selectedBranch.id,
      branchName: selectedBranch.name,
    });

  } catch (error) {
    console.error('Error translating choice to branch ID:', error);
    res.status(500).json({ message: 'An error occurred while translating the choice.', error: error.message });
  }
};

/**
 * @description Provides a simple list of all salespersons for a selected branch for Make.com.
 * The branch is selected by a numerical choice.
 */
const listSalespersonsByBranchChoice = async (req, res) => {
  try {
    const { choice } = req.query;
    if (!choice || isNaN(parseInt(choice))) {
      return res.status(400).type('text/plain').send('A valid numerical "choice" query parameter is required.');
    }

    // We must fetch the branches in the exact same order as listAllBranches to get the correct mapping
    const branches = await Branch.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    const choiceIndex = parseInt(choice) - 1;

    if (choiceIndex < 0 || choiceIndex >= branches.length) {
      return res.status(404).type('text/plain').send('The selected choice number is invalid or out of range.');
    }

    const selectedBranch = branches[choiceIndex];

    const branchWithSalespersons = await Branch.findByPk(selectedBranch.id, {
      include: [{
        model: SalesPerson,
        as: 'salespersons',
        attributes: ['id', 'name'],
        where: {
          telegram_id: {
            [SequelizeOp.is]: null
          }
        },
        through: { attributes: [] },
        required: false // Use LEFT JOIN to get branch even if no salesperson matches
      }],
      order: [
        [{ model: SalesPerson, as: 'salespersons' }, 'name', 'ASC']
      ]
    });

    if (!branchWithSalespersons || !branchWithSalespersons.salespersons || branchWithSalespersons.salespersons.length === 0) {
      const message = `No salespersons without a registered Telegram ID were found for branch "${selectedBranch.name}".`;
      res.type('text/plain').send(message);
      return;
    }

    const messageLines = branchWithSalespersons.salespersons.map((salesperson, index) => {
      return `${index + 1}. ${salesperson.name}`;
    });

    const message = "Please reply with the number of the salesperson:\n\n" + messageLines.join('\n');

    res.type('text/plain').send(message);

  } catch (error) {
    console.error('Error in listSalespersonsByBranchChoice:', error);
    res.status(500).type('text/plain').send('An error occurred while fetching the salespersons list.');
  }
};

/**
 * @description Prepares the assignment of a Telegram ID by verifying choices and returning a confirmation message.
 */
const prepareTelegramIdAssignment = async (req, res) => {
  try {
    const { branch_choice, salesperson_choice } = req.body;

    if (!branch_choice || isNaN(parseInt(branch_choice)) || !salesperson_choice || isNaN(parseInt(salesperson_choice))) {
      return res.status(400).json({ message: 'Parameters "branch_choice" and "salesperson_choice" are required.' });
    }

    // 1. Find the selected branch
    const branches = await Branch.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    const branchChoiceIndex = parseInt(branch_choice) - 1;
    if (branchChoiceIndex < 0 || branchChoiceIndex >= branches.length) {
      return res.status(404).json({ message: 'The selected branch choice is invalid.' });
    }
    const selectedBranch = branches[branchChoiceIndex];

    // 2. Find the selected salesperson from the list of those without a telegram_id for that branch
    const salespersons = await SalesPerson.findAll({
      attributes: ['id', 'name'],
      where: {
        telegram_id: { [SequelizeOp.is]: null }
      },
      include: [{
        model: Branch,
        as: 'branches',
        where: { id: selectedBranch.id },
        attributes: [],
        through: { attributes: [] }
      }],
      order: [['name', 'ASC']],
    });

    const salespersonChoiceIndex = parseInt(salesperson_choice) - 1;
    if (salespersonChoiceIndex < 0 || salespersonChoiceIndex >= salespersons.length) {
      return res.status(404).json({ message: 'The selected salesperson choice is invalid.' });
    }
    const selectedSalesperson = salespersons[salespersonChoiceIndex];

    // 3. Return confirmation message WITHOUT updating
    res.json({
      success: true,
      message: `Hello, ${selectedSalesperson.name} you are about to be registered to ${selectedBranch.name}. Is this correct?`,
      salesperson_name: selectedSalesperson.name,
      branch_name: selectedBranch.name
    });

  } catch (error) {
    console.error('Error in prepareTelegramIdAssignment:', error);
    res.status(500).json({ message: 'An error occurred while preparing the assignment.', error: error.message });
  }
};

/**
 * @description Confirms and assigns a Telegram ID to a salesperson.
 */
const confirmTelegramIdAssignment = async (req, res) => {
  try {
    const { branch_choice, salesperson_choice, telegram_id } = req.body;

    if (!branch_choice || isNaN(parseInt(branch_choice)) || !salesperson_choice || isNaN(parseInt(salesperson_choice)) || !telegram_id) {
      return res.status(400).json({ message: 'Parameters "branch_choice", "salesperson_choice", and "telegram_id" are required.' });
    }

    // This logic is duplicated, but it's a necessary security measure to re-validate everything before writing to the DB.
    // 1. Find the selected branch
    const branches = await Branch.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    const branchChoiceIndex = parseInt(branch_choice) - 1;
    if (branchChoiceIndex < 0 || branchChoiceIndex >= branches.length) {
      return res.status(404).json({ message: 'The selected branch choice is invalid.' });
    }
    const selectedBranch = branches[branchChoiceIndex];

    // 2. Find the selected salesperson
    const salespersons = await SalesPerson.findAll({
      attributes: ['id', 'name'],
      where: {
        // We check for null again to prevent race conditions where two users try to register the same salesperson.
        telegram_id: { [SequelizeOp.is]: null }
      },
      include: [{
        model: Branch,
        as: 'branches',
        where: { id: selectedBranch.id },
        attributes: [],
        through: { attributes: [] }
      }],
      order: [['name', 'ASC']],
    });
    const salespersonChoiceIndex = parseInt(salesperson_choice) - 1;
    if (salespersonChoiceIndex < 0 || salespersonChoiceIndex >= salespersons.length) {
      return res.status(404).json({ message: 'The selected salesperson choice is invalid or the salesperson was already registered.' });
    }
    const selectedSalesperson = salespersons[salespersonChoiceIndex];

    // 3. Update the salesperson
    await selectedSalesperson.update({ telegram_id: String(telegram_id) });

    res.json({
      success: true,
      message: `Confirmed! ${selectedSalesperson.name} has been successfully registered to ${selectedBranch.name}.`
    });

  } catch (error) {
    console.error('Error in confirmTelegramIdAssignment:', error);
    res.status(500).json({ message: 'An error occurred while confirming the assignment.', error: error.message });
  }
};


module.exports = {
  findUserByTelegramId,
  verifyAccessKey,
  listAllBranches,
  getSalespersonsWithoutTelegram,
  getBranchIdByChoice,
  listSalespersonsByBranchChoice,
  prepareTelegramIdAssignment,
  confirmTelegramIdAssignment,
}; 