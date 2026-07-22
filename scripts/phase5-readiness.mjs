import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const projectRoot = process.cwd();
const distDir = join(projectRoot, 'dist');
const indexPath = join(distDir, 'index.html');

const failures = [];
let detectedAssetMode = 'unknown';

if (!existsSync(indexPath)) {
  failures.push('dist/index.html was not generated.');
} else {
  const indexHtml = readFileSync(indexPath, 'utf8');

  const hasProjectAbsoluteAssets = indexHtml.includes('/IIPM-Examination-Portal/assets/');
  const hasDotRelativeAssets = indexHtml.includes('./assets/');
  const hasRelativeAssets = /(?:src|href)=["']assets\//i.test(indexHtml);
  const hasBrokenRootAssets = /(?:src|href)=["']\/assets\//i.test(indexHtml);

  if (hasProjectAbsoluteAssets) detectedAssetMode = 'project-absolute';
  else if (hasDotRelativeAssets || hasRelativeAssets) detectedAssetMode = 'relative';

  if (!hasProjectAbsoluteAssets && !hasDotRelativeAssets && !hasRelativeAssets) {
    failures.push(
      'The production HTML does not contain a GitHub Pages-safe asset reference.',
    );
  }

  if (hasBrokenRootAssets) {
    failures.push(
      'The production HTML contains root-level /assets/ links, which would break under the GitHub project Pages path.',
    );
  }
}

const textExtensions = new Set(['.html', '.js', '.css', '.json', '.map', '.txt']);
const forbiddenPatterns = [
  { label: 'Paystack secret key', pattern: /sk_(?:test|live)_[A-Za-z0-9]+/g },
  { label: 'Supabase service-role environment name', pattern: /SUPABASE_SERVICE_ROLE_KEY/g },
  { label: 'Supabase service-role token marker', pattern: /service_role/g },
  { label: 'Supabase personal access token', pattern: /sbp_[A-Za-z0-9_-]+/g },
];

const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
      continue;
    }

    if (!textExtensions.has(extname(path))) continue;
    const content = readFileSync(path, 'utf8');

    for (const check of forbiddenPatterns) {
      check.pattern.lastIndex = 0;
      if (check.pattern.test(content)) {
        failures.push(`${check.label} found in ${relative(projectRoot, path)}.`);
      }
    }
  }
};

if (existsSync(distDir)) walk(distDir);

if (failures.length > 0) {
  console.error('\nPhase 5 readiness checks failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Phase 5 readiness checks passed.');
console.log('- Production index exists.');
console.log(`- GitHub Pages-safe asset mode detected: ${detectedAssetMode}.`);
console.log('- No Paystack secret keys are present in the compiled frontend.');
console.log('- No Supabase service-role credentials are present in the compiled frontend.');
