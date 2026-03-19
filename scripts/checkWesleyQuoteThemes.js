import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const quotesPath = path.resolve(repoRoot, 'public', 'wesley', 'quotes.json');
const strictMode = process.argv.includes('--strict');

const allowedThemes = new Set([
  'Discipleship',
  'Faith',
  'Grace',
  'Holiness',
  'Love',
  'Mission',
  'Prayer',
  'Stewardship',
  'Zeal',
]);

const highConfidenceThemeRules = [
  {
    theme: 'Stewardship',
    pattern: /\bearn all you can\b|\bsave all you can\b|\bgive all you can\b|\buse of money\b/iu,
  },
  {
    theme: 'Mission',
    pattern: /\blook upon all the world as my parish\b|\bthe world is my parish\b/iu,
  },
  {
    theme: 'Zeal',
    pattern: /\bone hundred preachers\b|\bfear nothing but sin\b/iu,
  },
  {
    theme: 'Prayer',
    pattern: /\bprayer\b|\bpray\b|\bintercession\b|\bwatch and pray\b/iu,
  },
  {
    theme: 'Grace',
    pattern: /\bgrace\b|\bjustif(?:y|ied|ication)\b|\bsalvation\b|\bredemption\b|\bforgiv(?:e|en|eness)\b|\bcondemnation\b|\bmercy\b/iu,
  },
  {
    theme: 'Holiness',
    pattern: /\bholiness\b|\bsanctif(?:y|ied|ication)\b|\bperfection\b|\bobedience\b/iu,
  },
  {
    theme: 'Love',
    pattern: /\blove\b|\bgive me (?:thine|your) hand\b|\bcharity\b|\bneighbo(?:u)?r\b|\bbrother\b/iu,
  },
  {
    theme: 'Discipleship',
    pattern: /\bdo all the good you can\b|\bserve god and do good\b/iu,
  },
];

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/^\uFEFF/u, '')
    .replace(/\s+/gu, ' ')
    .trim();

const getThemeSuggestion = (quote) => {
  const haystack = normalizeText(quote);
  const match = highConfidenceThemeRules.find((rule) => rule.pattern.test(haystack));
  return match?.theme ?? null;
};

const toRelativePath = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join('/');

const main = async () => {
  const raw = await readFile(quotesPath, 'utf8');
  const quotes = JSON.parse(raw.replace(/^\uFEFF/u, ''));

  if (!Array.isArray(quotes)) {
    throw new Error('Wesley quotes JSON must be an array.');
  }

  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (let index = 0; index < quotes.length; index += 1) {
    const row = quotes[index] ?? {};
    const rowId = `Row ${index + 1}`;

    const quote = normalizeText(row.quote);
    const source = normalizeText(row.source);
    const theme = normalizeText(row.theme);

    if (!quote) {
      errors.push(`${rowId}: missing quote text.`);
    }

    if (!source) {
      errors.push(`${rowId}: missing source.`);
    }

    if (!theme) {
      errors.push(`${rowId}: missing theme.`);
    } else if (!allowedThemes.has(theme)) {
      errors.push(`${rowId}: invalid theme "${theme}".`);
    }

    if (quote && source) {
      const key = `${quote.toLowerCase()}|${source.toLowerCase()}`;
      if (seen.has(key)) {
        errors.push(`${rowId}: duplicate quote+source pair.`);
      }
      seen.add(key);
    }

    const suggestedTheme = getThemeSuggestion(quote);
    if (theme && suggestedTheme && theme !== suggestedTheme) {
      warnings.push(`${rowId}: ${source} uses "${theme}" but suggested "${suggestedTheme}".`);
    }
  }

  console.log(`[Wesley Quote Checker] Checked ${quotes.length} quotes in ${toRelativePath(quotesPath)}.`);

  if (errors.length) {
    console.error(`\n${errors.length} error(s) found:`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  if (warnings.length) {
    console.warn(`\n${warnings.length} theme consistency warning(s):`);
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }

    if (strictMode) {
      console.error('\nStrict mode enabled: treating warnings as failures.');
      process.exitCode = 1;
      return;
    }
  }

  console.log('\nNo blocking issues found.');
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
