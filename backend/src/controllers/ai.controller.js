'use strict';

const OpenAI = require('openai');
const { Job, Branch, Employee, Estimate } = require('../models');
const OperationCommandPost = require('../models/OperationCommandPost');
const { calculateJobPerformance } = require('../services/performance.service');
const { logger } = require('../utils/logger');

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%';
  const pct = Math.round(Number(value) * 10000) / 100; // 2 dec
  return `${pct}%`;
}

function formatMoney(value) {
  if (!value || Number.isNaN(Number(value))) return '$0.00';
  return `$${Number(value).toFixed(2)}`;
}

function buildPrompt({ jobName, branchName, crewLeaderName, crewLeaderAnimal, metrics, notes, includeBanger = true, branchEmoji = '🍊', animalBanner = '🔥' }) {
  const { totalWorkedHours, actualSavedPercent } = metrics;

  const animalTag = crewLeaderAnimal ? ` ${crewLeaderAnimal}` : '';

  const systemMsg = 'You are a copywriter generating hype Telegram posts in English for an internal operations group. Style: bold banners with emojis; concise; do not add any extra commentary outside the post.';

  const example1User = 'EXAMPLE: Orange County, Crew Leader: Tyler Rodas (BEAR), Actual Saved: 61.56%';
  const example1Assistant = [
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '💸💸💸💰 61.56% EXCELLENCE DELIVERED 💰💸💸💸',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🍊🍊🍊 ORANGE COUNTY DOMINATES 🍊🍊🍊',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🔥🔥🔥 Smith Residence - CA 🔥🔥🔥',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '⚔️⚔️⚔️ BEAR ATTACK MODE ⚔️⚔️⚔️',
    '💨💨💨 SMART MOVES • BIG SAVINGS 💨💨💨',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🔥🔥🔥🔥 TYLER RODAS 🔥🔥🔥🔥',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴'
  ].join('\n');

  const example2User = 'EXAMPLE: Orange County, Crew Leader: Terry Hong (TURTLE), Actual Saved: 60.58%';
  const example2Assistant = [
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '💸💸💸💰 60.58% UNSTOPPABLE FORCE 💰💸💸💸',
    '🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊',
    '🍊🍊🍊 ORANGE COUNTY STRIKES 🍊🍊🍊',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🔥🔥🔥 Johnson Estate - OC 🔥🔥🔥',
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '⚔️⚔️⚔️ SHELL POWER UNLEASHED ⚔️⚔️⚔️',
    '💨💨💨 PRECISION • PROFIT • POWER 💨💨💨',
    '🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊',
    '🔥🔥🔥🔥 TERRY HONG 🔥🔥🔥🔥',
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴'
  ].join('\n');

  const allowedEmojis = `${branchEmoji} ${animalBanner} 💸 🔥 📱 ⚔️`;
  const firstName = getFirstName(crewLeaderName || '');

  const userMsg = `Create an "Operation Command" hype post for job "${jobName}".

Context:
- Job Name: ${jobName}
- Branch: ${branchName}
- Crew Leader: ${crewLeaderName}${animalTag}
- Actual Saved Percent: ${(Number(actualSavedPercent) * 100).toFixed(2)}%
- Crew Leader First Name (USE EXACTLY THIS STRING for the last line): ${firstName.toUpperCase()}

${notes ? `
🚨🚨🚨 CRITICAL SPECIAL STORY 🚨🚨🚨
"${notes}"

THIS STORY MUST APPEAR IN LINE 8. DO NOT USE GENERIC PHRASES.
Transform this story into a short, powerful, WIDE, CENTERED phrase with emojis on BOTH sides.
Example: "flat tire but saved 22%" → "⚡️⚡️⚡️ FLAT TIRE? NO PROBLEM! ⚡️⚡️⚡️"
Make it WIDE and CENTERED!
` : ''}

STRICT Formatting - WIDE FORMAT (match this structure):
1) Long emoji banner line (16-20 emojis wide)
2) Line with money emojis, percent, and text: "💸💸💸💰 XX.XX% {SHORT PHRASE} 💰💸💸💸" (centered, wide)
3) Long emoji banner line
4) Line with BRANCH NAME centered with emojis, make it WIDE: "${branchEmoji}${branchEmoji}${branchEmoji} {BRANCH NAME} ${branchEmoji}${branchEmoji}${branchEmoji}"
5) Long emoji banner line
6) Line with JOB NAME centered with emojis, make it WIDE: "🔥🔥🔥 {JOB NAME} 🔥🔥🔥"
7) Long emoji banner line
8) ${notes 
  ? `Transform the special story into a SHORT CENTERED PHRASE with emojis on both sides to make it WIDE` 
  : 'An aggressive animal-themed tagline, CENTERED with emojis on both sides to make it WIDE'}
9) Motivational/punch line, CENTERED with emojis on both sides: "💨💨💨 {3-5 WORDS} 💨💨💨"
10) Long emoji banner line
11) Line with Crew Leader name, CENTERED and WIDE: "🔥🔥🔥🔥 {CREW LEADER NAME} 🔥🔥🔥🔥"
12) Long emoji banner line
13) Long emoji banner line (final)

CRITICAL FORMATTING RULES:
- Total lines: 12-14 (MUCH SHORTER than before)
- Each line MUST be WIDE (60-80 characters)
- Text MUST be CENTERED with emojis on BOTH sides for balance
- Banner lines must use 16-20 emojis (not 12)
- NO narrow lines - make everything WIDE and CENTERED
- Example of WIDE centered line: "💨💨💨 SHARP • SWIFT • UNYIELDING 💨💨💨"
- Example of NARROW line (DON'T DO THIS): "🔥 text 🔥"
- NEVER include numeric data (no hours, dollars). ONLY the percent line.
- Use ONLY these emojis: ${allowedEmojis}. No others.
- Output ONLY the final post. No markdown.
- MUST include the job name "${jobName}".
${notes ? `
🚨 Line 8 MUST celebrate the special story with a WIDE, CENTERED phrase!
Turn the challenge into a victory with SHORT, POWERFUL, WIDE phrases!
` : ''}`;

  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: example1User },
    { role: 'assistant', content: example1Assistant },
    { role: 'user', content: example2User },
    { role: 'assistant', content: example2Assistant },
    { role: 'user', content: userMsg }
  ];

  return { messages };
}

async function callOpenAI({ messages }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.8,
    max_tokens: 400
  });
  return completion.choices?.[0]?.message?.content?.trim() || null;
}

function fallbackTemplate({ jobName, branchName, crewLeaderName, crewLeaderAnimal, metrics }) {
  const { totalWorkedHours, actualSavedPercent } = metrics;
  const pctNum = Math.max(0, Number(actualSavedPercent) || 0);
  const pctStr = `+${(pctNum * 100).toFixed(2)}%`;

  const branchUpper = (branchName || 'BRANCH').toUpperCase();
  const branchEmoji = pickBranchEmoji(branchUpper);
  const animalUpper = (crewLeaderAnimal || '').toUpperCase();
  const animalBanner = pickAnimalBannerEmoji(animalUpper);
  const dayBanger = pctNum > 0 ? pickBanger(totalWorkedHours) : 'BANGER';
  const tagline = pickTagline(animalUpper) || 'ON THE MOVE';
  const firstName = getFirstName(crewLeaderName || '');

  return [
    repeatEmoji(animalBanner, 14),
    `💸💸💸 🚨 ${pctStr} 🚨 💸💸💸`,
    repeatEmoji(branchEmoji, 13),
    `${branchEmoji}${branchEmoji}${branchEmoji}  ${branchUpper}  ${branchEmoji}${branchEmoji}${branchEmoji}`,
    repeatEmoji(animalBanner, 13),
    `🔥💥💥   ${dayBanger}   💥💥🔥`,
    repeatEmoji(animalBanner, 13),
    `⚔️  ${tagline}  ⚔️`,
    repeatEmoji(animalBanner, 13),
    `📲📲  ${crewLeaderName}  📲📲`,
    repeatEmoji(animalBanner, 13),
    animalUpper ? `⚡️ THE ${animalUpper} – ${firstName} ⚡️` : `⚡️ ${firstName} ⚡️`,
    repeatEmoji(animalBanner, 13)
  ].join('\n');
}

function pickBranchEmoji(branchUpper) {
  if (branchUpper.includes('ORANGE')) return '🍊';
  if (branchUpper.includes('SAN DIEGO') || branchUpper.includes('SD')) return '🌊';
  if (branchUpper.includes('SAN BERNARDINO')) return '🌵';
  if (branchUpper.includes('EVERETT')) return '🌲';
  if (branchUpper.includes('KENT')) return '🌲';
  if (branchUpper.includes('LOS ANGELES') || branchUpper.includes('LA')) return '🌴';
  return '🏙️';
}

function pickAnimalBannerEmoji(animalUpper) {
  if (animalUpper.includes('SHARK')) return '🦈';
  if (animalUpper.includes('TURTLE')) return '🐢';
  if (animalUpper.includes('BEAR')) return '🐻';
  if (animalUpper.includes('GORILLA')) return '🦍';
  if (animalUpper.includes('EAGLE')) return '🦅';
  if (animalUpper.includes('WOLF')) return '🐺';
  return '⚡️';
}

function pickTagline(animalUpper) {
  if (animalUpper.includes('SHARK')) return 'YOU NEVER SEE HIM COMING';
  if (animalUpper.includes('TURTLE')) return 'SHELL YEA';
  if (animalUpper.includes('BEAR')) return 'BEAR ATTACK';
  if (animalUpper.includes('GORILLA')) return 'SILENT POWER, MASSIVE IMPACT';
  if (animalUpper.includes('WOLF')) return 'UNLEASH THE WOLF';
  if (animalUpper.includes('EAGLE')) return 'SOARING TO VICTORY';
  return 'MOVES IN SILENCE, HITS HARD';
}

function pickBanger(totalWorkedHours) {
  const h = Number(totalWorkedHours) || 0;
  if (h <= 10) return '1 DAY BANGER';
  if (h <= 20) return '2 DAY BANGER';
  return 'BANGER';
}

function repeatEmoji(e, n) { return new Array(n).fill(e).join(''); }
function getFirstName(full) { return (full || '').split(/\s+/)[0] || ''; }

function parseIncludeBanger(notes) {
  if (!notes) return true;
  const txt = String(notes).toLowerCase();
  if (/(do not mention|without|skip).*banger/.test(txt)) return false;
  if (/no\s*banger/.test(txt)) return false;
  if (/sin\s*banger/.test(txt)) return false;
  return true;
}

exports.generateOperationPost = async (req, res) => {
  try {
    const { jobId, notes, crewLeaderName: customCrewLeaderName, animal: customAnimal } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId es requerido' });
    }

    const job = await Job.findByPk(jobId, {
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name'] },
        { model: Employee, as: 'crewLeader', attributes: ['id', 'first_name', 'last_name'] },
        { model: Estimate, as: 'estimate', attributes: ['name'] }
      ]
    });

    if (!job) return res.status(404).json({ success: false, message: 'Job no encontrado' });

    const metrics = await calculateJobPerformance(job.id);
    const MIN_SAVED_PERCENT = parseFloat(process.env.OP_POST_MIN_SAVED || '0.15');

    if ((Number(metrics.actualSavedPercent) || 0) < MIN_SAVED_PERCENT) {
      return res.json({ success: true, data: { eligible: false, metrics, minSavedPercent: MIN_SAVED_PERCENT } });
    }
    
    // Use custom values from modal (required fields)
    const crewLeaderName = customCrewLeaderName || 'N/A';
    const crewLeaderAnimal = customAnimal || '';
    
    const prompt = buildPrompt({
      jobName: job.name || job.estimate?.name || `Job ${job.id}`,
      branchName: job.branch?.name || 'N/A',
      crewLeaderName: crewLeaderName,
      crewLeaderAnimal: crewLeaderAnimal,
      metrics,
      notes,
      includeBanger: parseIncludeBanger(notes),
      branchEmoji: pickBranchEmoji((job.branch?.name || '').toUpperCase()),
      animalBanner: pickAnimalBannerEmoji((crewLeaderAnimal || '').toUpperCase())
    });

    let content = null;
    try {
      content = await callOpenAI(prompt);
    } catch (apiErr) {
      logger.warn('Error al llamar OpenAI, usando fallback', { error: apiErr.message });
    }

    if (!content) {
      content = fallbackTemplate({
        jobName: job.name || job.estimate?.name || `Job ${job.id}`,
        branchName: job.branch?.name || 'N/A',
        crewLeaderName: job.crewLeader?.name || 'N/A',
        crewLeaderAnimal: job.crewLeader?.animal || '',
        metrics
      });
    }

    // Guardar el post en la base de datos
    const operationPost = await OperationCommandPost.create({ post: content });
    
    // Actualizar el job con el operation_post_id
    await job.update({ operation_post_id: operationPost.id });

    logger.info('Operation command post created and linked to job', {
      jobId: job.id,
      postId: operationPost.id,
      actualSavedPercent: metrics.actualSavedPercent
    });

    return res.json({ success: true, data: { eligible: true, post: content, metrics, postId: operationPost.id } });
  } catch (error) {
    logger.error('Error generateOperationPost', error);
    return res.status(500).json({ success: false, message: 'Error generando post' });
  }
};
