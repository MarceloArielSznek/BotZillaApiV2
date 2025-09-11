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
      const message = `It seems you've selected a branch that has no pending registrations.\n\nIf you believe this is an error, or if this is your correct branch, please contact an administrator for assistance.`;
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

/**
 * @description Find a salesperson's telegram_id by their name using fuzzy matching.
 * This handles variations like "Marcelo Ariel Sznek" vs "Marcelo Sznek" or typos like "Marclo" vs "Marcelo".
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
const findTelegramIdByName = async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ 
      success: false,
      message: 'name is required and must be a non-empty string' 
    });
  }

  const searchName = name.trim();

  try {
    // 1. Búsqueda exacta primero
    let salesperson = await SalesPerson.findOne({
      where: { name: searchName },
      attributes: ['id', 'name', 'telegram_id'],
      include: [{ 
        model: Branch, 
        as: 'branches', 
        attributes: ['id', 'name'],
        through: { attributes: [] } 
      }]
    });

    if (salesperson) {
      const nameParts = splitName(salesperson.name);
      return res.json({
        success: true,
        exact_match: true,
        salesperson_id: salesperson.id,
        name: salesperson.name,
        first_name: nameParts.first_name,
        last_name: nameParts.last_name,
        telegram_id: salesperson.telegram_id,
        has_telegram: !!salesperson.telegram_id,
        branches: salesperson.branches.map(b => ({ id: b.id, name: b.name }))
      });
    }

    // 2. Búsqueda fuzzy usando ILIKE con múltiples patrones
    const searchPatterns = [];
    const words = searchName.split(/\s+/).filter(word => word.length > 2); // Solo palabras de 3+ caracteres

    // Crear patrones de búsqueda
    words.forEach(word => {
      searchPatterns.push(`%${word}%`); // Cada palabra individual
    });
    
    // Patrón con todas las palabras
    searchPatterns.push(`%${words.join('%')}%`);

    // Buscar usando OR con todos los patrones
    const whereConditions = searchPatterns.map(pattern => ({
      name: { [SequelizeOp.iLike]: pattern }
    }));

    const salespersons = await SalesPerson.findAll({
      where: {
        [SequelizeOp.or]: whereConditions
      },
      attributes: ['id', 'name', 'telegram_id'],
      include: [{ 
        model: Branch, 
        as: 'branches', 
        attributes: ['id', 'name'],
        through: { attributes: [] } 
      }],
      limit: 10 // Limitar resultados para evitar sobrecarga
    });

    if (salespersons.length === 0) {
      return res.json({
        success: false,
        message: 'No salesperson found with similar name',
        searched_name: searchName,
        suggestions: []
      });
    }

    // 3. Si hay múltiples resultados, calcular similitud básica
    const results = salespersons.map(sp => {
      const similarity = calculateNameSimilarity(searchName, sp.name);
      const nameParts = splitName(sp.name);
      return {
        salesperson_id: sp.id,
        name: sp.name,
        first_name: nameParts.first_name,
        last_name: nameParts.last_name,
        telegram_id: sp.telegram_id,
        has_telegram: !!sp.telegram_id,
        similarity_score: similarity,
        branches: sp.branches.map(b => ({ id: b.id, name: b.name }))
      };
    });

    // Ordenar por similitud (mayor a menor)
    results.sort((a, b) => b.similarity_score - a.similarity_score);

    // Si el primer resultado tiene alta similitud (>0.7), devolverlo como match
    if (results[0].similarity_score > 0.7) {
      return res.json({
        success: true,
        exact_match: false,
        fuzzy_match: true,
        searched_name: searchName,
        ...results[0],
        other_matches: results.slice(1, 3) // Incluir hasta 2 matches alternativos
      });
    }

    // Si no hay un match claro, devolver las opciones
    return res.json({
      success: false,
      message: 'Multiple similar names found, please be more specific',
      searched_name: searchName,
      suggestions: results.slice(0, 5) // Top 5 sugerencias
    });

  } catch (error) {
    console.error('Error finding telegram_id by name:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};

/**
 * Separa un nombre completo en first_name y last_name
 * @param {string} fullName - Nombre completo
 * @returns {object} { first_name, last_name }
 */
function splitName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { first_name: '', last_name: '' };
  }

  const nameParts = fullName.trim().split(/\s+/);
  
  if (nameParts.length === 0) {
    return { first_name: '', last_name: '' };
  } else if (nameParts.length === 1) {
    return { first_name: nameParts[0], last_name: '' };
  } else {
    // Primer nombre = first_name, resto = last_name
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    return { first_name: firstName, last_name: lastName };
  }
}

/**
 * Calcula una puntuación de similitud básica entre dos nombres
 * @param {string} search - Nombre buscado
 * @param {string} target - Nombre en la base de datos
 * @returns {number} Puntuación entre 0 y 1
 */
function calculateNameSimilarity(search, target) {
  const searchLower = search.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();
  
  // Si son iguales, puntuación perfecta
  if (searchLower === targetLower) return 1.0;
  
  // Dividir en palabras
  const searchWords = searchLower.split(/\s+/);
  const targetWords = targetLower.split(/\s+/);
  
  let matchingWords = 0;
  let totalWords = Math.max(searchWords.length, targetWords.length);
  
  // Contar palabras que coinciden
  searchWords.forEach(searchWord => {
    const found = targetWords.some(targetWord => {
      // Coincidencia exacta
      if (searchWord === targetWord) return true;
      
      // Coincidencia si una palabra contiene a la otra (para casos como "Marcelo" vs "Marclo")
      if (searchWord.length >= 3 && targetWord.length >= 3) {
        return searchWord.includes(targetWord) || targetWord.includes(searchWord);
      }
      
      return false;
    });
    
    if (found) matchingWords++;
  });
  
  // Bonus si el target contiene todas las palabras del search
  const allWordsFound = searchWords.every(searchWord => 
    targetWords.some(targetWord => 
      targetWord.includes(searchWord) || searchWord.includes(targetWord)
    )
  );
  
  let score = matchingWords / totalWords;
  if (allWordsFound && searchWords.length <= targetWords.length) {
    score += 0.2; // Bonus por contener todas las palabras
  }
  
  return Math.min(score, 1.0);
}


module.exports = {
  findUserByTelegramId,
  verifyAccessKey,
  listAllBranches,
  getSalespersonsWithoutTelegram,
  getBranchIdByChoice,
  listSalespersonsByBranchChoice,
  prepareTelegramIdAssignment,
  confirmTelegramIdAssignment,
  findTelegramIdByName,
}; 