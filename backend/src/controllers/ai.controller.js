'use strict';

const OpenAI = require('openai');
const { Job, Branch, CrewMember, Estimate } = require('../models');
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
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '💸💸💸💸 !! 61.56% !!💸💸💸💸',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '🍊🍊🍊ORANGE COUNTY🍊🍊🍊',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '💵💵🧨🧨2 Day Banger🧨🧨💵💵',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '🔥🔥 BEAR ATTACK 🔥🔥🔥🔥',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '📱📱📱   TYLER RODAS   📱📱📱',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻',
    '🔥🔥THE BEAR…. TYLER!!!!!!!!!!! 🔥🔥',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻'
  ].join('\n');

  const example2User = 'EXAMPLE: Orange County, Crew Leader: Terry Hong (TURTLE), Actual Saved: 60.58%';
  const example2Assistant = [
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '💸💸💸 !! 60.58% !! 💸💸💸💸',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '🍊🍊🍊 ORANGE COUNTY 🍊🍊🍊',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '🔥💥💥   1 Day Banger   💥💥🔥',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '⚔️  SHELL YEA  ⚔️',
    '🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊',
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '📲📲  TERRY HONG  📲📲',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴',
    '🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢🐢',
    '⚡️⚡️ THE SEA TURTLE – TERRY ⚡️⚡️',
    '🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴🌴'
  ].join('\n');

  const allowedEmojis = `${branchEmoji} ${animalBanner} 💸 🔥 📱 ⚔️`;
  const firstName = getFirstName(crewLeaderName || '');

  const userMsg = `Create an "Operation Command" hype post for job "${jobName}".

Context:
- Branch: ${branchName}
- Crew Leader: ${crewLeaderName}${animalTag}
- Actual Saved Percent: ${(Number(actualSavedPercent) * 100).toFixed(2)}%
 - Crew Leader First Name (USE EXACTLY THIS STRING for the last line): ${firstName.toUpperCase()}

STRICT Formatting (match this structure, lines only):
1) Emoji banner line
2) Emoji banner line
3) Line with money emojis and ONLY the Actual Saved formatted as "💸💸💸💸 !! XX.XX% !!💸💸💸💸"
4) Emoji banner line
5) Emoji banner line
6) Line with BRANCH NAME in ALL CAPS surrounded by the branch emoji (${branchEmoji})
7) Emoji banner line
8) Emoji banner line
9) ${includeBanger ? 'A short hype line of 1–3 words (you MAY use "1 Day Banger" / "2 Day Banger" / "Banger" OR a fresh synonym like "Heat Run", "Full Send", "Beast Mode"). Vary this line each time.' : 'Skip the Banger line entirely and use another emoji banner line.'}
10) Emoji banner line
11) Emoji banner line
12) A short aggressive tagline in ALL CAPS. Create a NEW phrase each time. Do NOT use any of these: "YOU NEVER SEE HIM COMING", "SHELL YEA", "BEAR ATTACK", "ON THE MOVE", "SILENT POWER, MASSIVE IMPACT". Prefer animal-themed wording that fits the crew leader animal.
13) Emoji banner line
14) Emoji banner line
15) Line with the Crew Leader name centered like: "📱📱📱   {NAME}   📱📱📱"
16) Emoji banner line
17) Final line MUST end with: "${firstName.toUpperCase()}!!!!!!!!!!!" preceded by the animal alias in caps, e.g., "🔥🔥THE ${crewLeaderAnimal?.toUpperCase?.() || 'HAMMER'}…. ${firstName.toUpperCase()}!!!!!!!!!!! 🔥🔥". Do not change the first name.
18) Emoji banner line

Hard rules:
- NEVER include any other numeric data (no hours, no dollars, no worked/saved hours). ONLY the percent line.
- Keep between 14 and 20 lines total.
- Use ONLY these emojis: ${allowedEmojis}. Do not use any other emojis.
- Do NOT copy phrases from the examples; they are style references only. Always produce original wording for lines 9 and 12.
- Output ONLY the final post. No markdown.
 - The name on the last line must use the provided first name and no other (no substitutions like Noel/Jesus/Tyler).

Special request (optional; integrate if it fits): ${notes ? notes : 'none'}`;

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
  return '⚡️';
}

function pickTagline(animalUpper) {
  if (animalUpper.includes('SHARK')) return 'YOU NEVER SEE HIM COMING';
  if (animalUpper.includes('TURTLE')) return 'SHELL YEA';
  if (animalUpper.includes('BEAR')) return 'BEAR ATTACK';
  if (animalUpper.includes('GORILLA')) return 'SILENT POWER, MASSIVE IMPACT';
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
    const { jobId, notes } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId es requerido' });
    }

    const job = await Job.findByPk(jobId, {
      include: [
        { model: Branch, as: 'branch', attributes: ['id', 'name'] },
        { model: CrewMember, as: 'crewLeader', attributes: ['id', 'name', 'animal'] },
        { model: Estimate, as: 'estimate', attributes: ['name'] }
      ]
    });

    if (!job) return res.status(404).json({ success: false, message: 'Job no encontrado' });

    const metrics = await calculateJobPerformance(job.id);
    const MIN_SAVED_PERCENT = parseFloat(process.env.OP_POST_MIN_SAVED || '0.15');

    if ((Number(metrics.actualSavedPercent) || 0) < MIN_SAVED_PERCENT) {
      return res.json({ success: true, data: { eligible: false, metrics, minSavedPercent: MIN_SAVED_PERCENT } });
    }
    const prompt = buildPrompt({
      jobName: job.name || job.estimate?.name || `Job ${job.id}`,
      branchName: job.branch?.name || 'N/A',
      crewLeaderName: job.crewLeader?.name || 'N/A',
      crewLeaderAnimal: job.crewLeader?.animal || '',
      metrics,
      notes,
      includeBanger: parseIncludeBanger(notes),
      branchEmoji: pickBranchEmoji((job.branch?.name || '').toUpperCase()),
      animalBanner: pickAnimalBannerEmoji((job.crewLeader?.animal || '').toUpperCase())
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

    return res.json({ success: true, data: { eligible: true, post: content, metrics } });
  } catch (error) {
    logger.error('Error generateOperationPost', error);
    return res.status(500).json({ success: false, message: 'Error generando post' });
  }
};

