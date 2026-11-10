const { execFileSync } = require('node:child_process');
const { copyFileSync, lstatSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const destination = process.argv[2];
const offline = process.argv[3] === '--offline';
if (!destination || (process.argv[3] && !offline) || process.argv.length > 4) {
  throw Error('Usage: node scripts/build-test-site.cjs NEW_DIRECTORY [--offline]');
}

const url = process.env.TEST_SUPABASE_URL || '';
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY || '';
const productionRef = 'mdbxghrqpvqqruzrlqsi';
if (offline) {
  if (url || key) throw Error('Unset both test settings for an offline build.');
} else if (
  !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url) ||
  url.includes(productionRef) ||
  !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
) {
  throw Error('A separate Supabase project URL and its publishable key are required.');
}

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(file => /^(?:assets|field-sports|fonts|shared|volleyball)\//.test(file) ||
    /^[^/]+\.(?:html|js|css)$/.test(file));
const live = readFileSync(join(root, 'live.js'), 'utf8');
const config = /  const url = '[^']+';\n  const key = '[^']+';/;
if (!config.test(live) || !files.includes('live.js') || !files.includes('index.html')) {
  throw Error('App entry points or the Supabase config changed. Review the test build.');
}

const testLive = live.replace(config, () =>
  `  const url = ${JSON.stringify(url)};\n  const key = ${JSON.stringify(key)};`)
  .replaceAll('window.supabase?.createClient', '(url && key) && window.supabase?.createClient');
const label = offline ? 'TEST · cloud disabled' : 'TEST · synthetic data only';
const banner = `<div style="position:fixed;bottom:0;right:0;z-index:2147483647;pointer-events:none;background:#fce08a;color:#211900;padding:.3rem .5rem;font:700 13px system-ui">${label}</div>`;

const tint = '<style id="test-background-tint">body { min-height: 100vh; background-image: linear-gradient(rgb(26 174 76 / 20%), rgb(26 174 76 / 20%)) !important; }</style>';

const textAssets = new Map();
for (const file of files) {
  const source = join(root, file);
  if (!lstatSync(source).isFile()) throw Error(`Expected a regular file: ${file}`);
  if (!/\.(?:html|js|css|cjs|svg|json)$/.test(file)) continue;
  let content = file === 'live.js' ? testLive : readFileSync(source, 'utf8');
  if (file.endsWith('.html')) {
    if (!/<\/head>/i.test(content)) throw Error(`Missing head close tag: ${file}`);
    content = content.replace(/<\/head>/i, `${tint}\n</head>`);
    if (!/<\/body>/i.test(content)) throw Error(`Missing body close tag: ${file}`);
    content = content.replace(/<\/body>/i, `${banner}\n</body>`);
  }
  if (content.includes(productionRef)) throw Error(`Production project reference in ${file}`);
  textAssets.set(file, content);
}

const output = resolve(destination);
mkdirSync(output);
for (const file of files) {
  const target = join(output, file);
  mkdirSync(dirname(target), { recursive: true });
  if (textAssets.has(file)) writeFileSync(target, textAssets.get(file));
  else copyFileSync(join(root, file), target);
}
writeFileSync(join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
