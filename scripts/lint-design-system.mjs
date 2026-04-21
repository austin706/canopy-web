#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// lint-design-system.mjs — Canopy-Web design-system linter
// ═══════════════════════════════════════════════════════════════
// Zero-dep pattern checker for the 4 rules from the audit's
// "systemic win #10":
//
//   1. Hardcoded hex colors in source (use `Colors.*` tokens)
//   2. Hardcoded numeric `fontSize: NN` or `fontSize: "NNpx"` literals
//      (use responsive tokens via theme — or at minimum a named constant)
//   3. Interactive `<button>` elements without `aria-label` and without
//      text children (icon-only buttons must declare an accessible name)
//
// Baseline approach (legacy codebase pragmatism):
//   The codebase pre-dates this linter, so a baseline-per-file count lives
//   in `scripts/lint-design-system.baseline.json`. The linter FAILS only
//   when a file's issue count EXCEEDS its baseline (i.e. new violations
//   were added). New files with any violations always fail. Refresh the
//   baseline with `npm run lint:design -- --write-baseline` after an
//   intentional cleanup pass.
//
// Ignored paths: constants/theme.ts (token source), tests, e2e,
// node_modules, dist, public, coverage, playwright-report, _dead-code.
//
// Flags:
//   --write-baseline  rewrite baseline file with current counts
//   --verbose         print every violation (default: print summary only)
// ───────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE_PATH = join(ROOT, 'scripts', 'lint-design-system.baseline.json');
const SRC_ROOTS = ['src'];
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'public',
  'coverage',
  '.vite',
  'playwright-report',
  'test-results',
  'e2e',
  '_dead-code',
]);
const SKIP_FILES_EXACT = new Set([
  'src/constants/theme.ts',
]);
const SKIP_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];

const args = new Set(process.argv.slice(2));
const WRITE_BASELINE = args.has('--write-baseline');
const VERBOSE = args.has('--verbose');

/** Collect all .ts/.tsx files under a root. */
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const abs = join(dir, entry);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(abs, out);
    } else {
      const ext = extname(abs);
      if (ext !== '.ts' && ext !== '.tsx') continue;
      if (SKIP_SUFFIXES.some((s) => abs.endsWith(s))) continue;
      out.push(abs);
    }
  }
  return out;
}

// ── Rules ──────────────────────────────────────────────────────

const HEX_RE = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g;
const HEX_ALLOW = new Set(['#000', '#FFF', '#000000', '#FFFFFF']);
const FONT_SIZE_RE = /\bfontSize\s*:\s*(\d+(?:\.\d+)?)\b/g;
const BUTTON_BLOCK_RE = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;

function checkFile(relPath, src) {
  const issues = [];
  const lines = src.split('\n');
  let m;

  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(src))) {
    const hex = m[0];
    if (HEX_ALLOW.has(hex.toUpperCase())) continue;
    const line = src.slice(0, m.index).split('\n').length;
    const lineText = lines[line - 1] ?? '';
    if (lineText.includes('allow-lint')) continue;
    issues.push({ rule: 'no-hardcoded-hex', line, message: `Hardcoded hex ${hex} — use Colors.* token` });
  }

  FONT_SIZE_RE.lastIndex = 0;
  while ((m = FONT_SIZE_RE.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    const lineText = lines[line - 1] ?? '';
    if (lineText.includes('allow-lint')) continue;
    issues.push({ rule: 'no-inline-fontsize-literal', line, message: `fontSize: ${m[1]} — prefer named constant` });
  }

  BUTTON_BLOCK_RE.lastIndex = 0;
  while ((m = BUTTON_BLOCK_RE.exec(src))) {
    const attrs = m[1] ?? '';
    const inner = (m[2] ?? '').trim();
    if (/aria-label\s*=/.test(attrs) || /aria-labelledby\s*=/.test(attrs)) continue;
    const textOnly = inner.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
    if (textOnly.length > 0) continue;
    const line = src.slice(0, m.index).split('\n').length;
    issues.push({ rule: 'no-icon-button-without-aria-label', line, message: 'icon-only <button> needs aria-label' });
  }

  return issues.map((i) => ({ ...i, file: relPath }));
}

// ── Main ───────────────────────────────────────────────────────

const files = [];
for (const r of SRC_ROOTS) {
  files.push(...walk(join(ROOT, r)));
}

const perFileCounts = {};
const perFileIssues = {};
let totalIssues = 0;
const byRule = new Map();

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  if (SKIP_FILES_EXACT.has(rel)) continue;
  const src = readFileSync(abs, 'utf8');
  const issues = checkFile(rel, src);
  if (issues.length > 0) {
    perFileCounts[rel] = issues.length;
    perFileIssues[rel] = issues;
    totalIssues += issues.length;
    for (const issue of issues) {
      byRule.set(issue.rule, (byRule.get(issue.rule) ?? 0) + 1);
    }
  }
}

if (WRITE_BASELINE) {
  const sorted = Object.fromEntries(Object.entries(perFileCounts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`✓ baseline written: ${Object.keys(sorted).length} files, ${totalIssues} issues total`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : {};

// Compare: fail only on files that have MORE issues than baseline, or new files.
const regressions = [];
for (const [file, count] of Object.entries(perFileCounts)) {
  const baselineCount = baseline[file] ?? 0;
  if (count > baselineCount) {
    regressions.push({ file, count, baselineCount, delta: count - baselineCount });
  }
}

if (VERBOSE || regressions.length > 0) {
  for (const { file } of regressions) {
    for (const issue of perFileIssues[file]) {
      console.log(`${issue.file}:${issue.line}  [${issue.rule}] ${issue.message}`);
    }
  }
}

console.log('');
console.log(`Total: ${totalIssues} issues across ${Object.keys(perFileCounts).length} files`);
for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(4)}  ${rule}`);
}

if (regressions.length > 0) {
  console.log('');
  console.log(`✖ ${regressions.length} file(s) regressed past baseline:`);
  for (const { file, count, baselineCount, delta } of regressions) {
    console.log(`  +${delta}  ${file}  (${baselineCount} → ${count})`);
  }
  console.log('');
  console.log('Fix: import from @/constants/theme, add aria-label, or mark intentional');
  console.log('lines with "// allow-lint" (e.g. email HTML templates).');
  console.log('If this is an intentional cleanup pass, refresh with:');
  console.log('  npm run lint:design -- --write-baseline');
  process.exit(1);
}

console.log('');
console.log('✓ no regressions past baseline');
