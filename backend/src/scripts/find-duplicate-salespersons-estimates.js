require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../config/database');
const { SalesPerson, Estimate } = require('../models');

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSetSimilarity(a, b) {
  const ta = new Set(normalizeName(a).split(' '));
  const tb = new Set(normalizeName(b).split(' '));
  const intersection = [...ta].filter(t => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

function levenshteinDistance(a, b) {
  const s = normalizeName(a);
  const t = normalizeName(b);
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[n][m];
}

function similarityScore(a, b) {
  const lev = levenshteinDistance(a, b);
  const maxLen = Math.max(normalizeName(a).length, normalizeName(b).length) || 1;
  const levSim = 1 - lev / maxLen; // 0..1
  const tokenSim = tokenSetSimilarity(a, b);
  // Weighted combination
  return (levSim * 0.6) + (tokenSim * 0.4);
}

async function findSimilarSalespersons(threshold = 0.86) {
  const salespersons = await SalesPerson.findAll({
    attributes: ['id', 'name', 'telegram_id'],
    include: [
      {
        model: Estimate,
        as: 'estimates',
        attributes: ['id', 'name', 'created_at', 'status_id']
      }
    ],
    order: [['name', 'ASC']]
  });

  const persons = salespersons.map(sp => ({
    id: sp.id,
    name: sp.name,
    telegram_id: sp.telegram_id,
    estimates: sp.estimates || []
  }));

  const visited = new Set();
  const groups = [];

  for (let i = 0; i < persons.length; i++) {
    if (visited.has(persons[i].id)) continue;
    const group = [persons[i]];
    visited.add(persons[i].id);

    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let j = 0; j < persons.length; j++) {
        if (visited.has(persons[j].id)) continue;
        // Compare against any member of the group
        const match = group.some(g => similarityScore(g.name, persons[j].name) >= threshold);
        if (match) {
          group.push(persons[j]);
          visited.add(persons[j].id);
          expanded = true;
        }
      }
    }

    if (group.length > 1) groups.push(group);
  }

  return groups;
}

async function main() {
  try {
    console.log('Searching for similar salespersons (by name similarity)...');
    const groups = await findSimilarSalespersons();

    if (groups.length === 0) {
      console.log('No similar salesperson groups found over the threshold.');
      return;
    }

    console.log(`Found ${groups.length} potential duplicate group(s).\n`);

    groups.forEach((group, idx) => {
      console.log(`===== Group #${idx + 1} =====`);
      // Choose a suggested keeper: has telegram_id, else max estimates
      const keeper = group
        .slice()
        .sort((a, b) => {
          const aScore = (a.telegram_id ? 1 : 0) * 1000 + (a.estimates?.length || 0);
          const bScore = (b.telegram_id ? 1 : 0) * 1000 + (b.estimates?.length || 0);
          return bScore - aScore;
        })[0];

      group.forEach(p => {
        console.log(`SalesPerson: #${p.id} | ${p.name} | Telegram: ${p.telegram_id || 'Not Set'} | Estimates: ${p.estimates.length}`);
        if (p.estimates.length > 0) {
          p.estimates.forEach(e => {
            console.log(`  - Estimate #${e.id} | ${e.name} | created: ${e.created_at} | status_id: ${e.status_id}`);
          });
        }
      });

      console.log('\nSuggestion: keep ->', `#${keeper.id} (${keeper.name})`);
      console.log('SQL to merge estimates to keeper:');
      group.forEach(p => {
        if (p.id === keeper.id) return;
        console.log(`  UPDATE "${process.env.DB_SCHEMA}"."estimate" SET sales_person_id = ${keeper.id} WHERE sales_person_id = ${p.id};`);
      });
      console.log('\nAfter moving estimates, you can safely delete the non-keeper records:');
      group.forEach(p => {
        if (p.id === keeper.id) return;
        console.log(`  -- DELETE FROM "${process.env.DB_SCHEMA}"."sales_person" WHERE id = ${p.id};`);
      });
      console.log('==============================\n');
    });
  } catch (error) {
    console.error('An error occurred while finding similar salespersons:', error);
  } finally {
    if (db && typeof db.close === 'function') {
      await db.close();
    }
  }
}

main();
