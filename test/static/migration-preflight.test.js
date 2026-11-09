// Static checks on the copy steps in the repo's Markdown.
//
// 1. README "Moving existing credentials", step 2: each shell block is ONE compound
//    statement that copies only when NEITHER destination file exists. Pasted line
//    by line, a block must not copy after a failed check, and must not close the
//    user's shell (no exit or throw).
// 2. Every setup copy of .env.example is guarded: `cp -n` on POSIX, and a Test-Path
//    on the same line in PowerShell. Nothing overwrites an existing .env.
//
// The scan works on paths relative to the repo root, so a checkout under a folder
// named like an excluded one (for example .claude) is still scanned. It asserts a
// minimum file count and a minimum number of copy lines, so it cannot pass by
// scanning nothing.

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const README_PATH = join(REPO_ROOT, 'README.md');

// Markdown files the scan covers today (53). A drop means files went missing from the scan.
const MIN_MD_FILES_SCANNED = 53;

const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.claude', '.scratch', '.advanced-plans', 'archive']);
const EXCLUDED_FILES = new Set(['DESIGN-SPEC.md', 'CHANGELOG.md']);

// Tests every segment of the path it is given. Callers pass a repo-relative path;
// an absolute path would also match any ancestor folder named like an excluded one.
function isExcluded(p) {
  return p.split(/[\\/]/).some(s => EXCLUDED_DIRS.has(s) || EXCLUDED_FILES.has(s) || s.startsWith('REPAIR-'));
}

function listMarkdown(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      if (isExcluded(rel)) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) found.push(rel);
    }
  };
  walk(root);
  return found;
}

// The text of each fenced block in a section, in order.
function fencedBlocks(section, lang) {
  const blocks = [];
  // The working tree has CRLF line endings, so allow \r before each \n.
  const re = new RegExp('```' + lang + '\\r?\\n([\\s\\S]*?)```', 'g');
  for (const m of section.matchAll(re)) blocks.push(m[1]);
  return blocks;
}

// Lines that run: blank lines and comments dropped.
function statements(block) {
  return block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

function migrationSection() {
  const readme = readFileSync(README_PATH, 'utf8');
  const idx = readme.indexOf('## Moving existing credentials');
  assert.ok(idx >= 0, 'README should have "Moving existing credentials" section');
  const next = readme.indexOf('\n## ', idx + 10);
  return readme.slice(idx, next >= 0 ? next : readme.length);
}

test('README migration step 2, PowerShell: one compound if, copy only in the else branch', () => {
  const psBlocks = fencedBlocks(migrationSection(), 'powershell');
  assert.ok(psBlocks.length >= 2, 'Expected PowerShell blocks for steps 1 and 2');
  const stmts = statements(psBlocks[1]);

  // One statement, so a line-by-line paste cannot run the copy after a failed check.
  assert.strictEqual(stmts.length, 1,
    `PowerShell copy step must be one compound statement. Got ${stmts.length}:\n${stmts.join('\n')}`);
  const s = stmts[0];
  assert.ok(s.startsWith('if ('), `Statement must start with if (. Got: ${s}`);
  assert.ok(
    s.includes(String.raw`Test-Path "$dest\.env"`) && s.includes(String.raw`Test-Path "$dest\tokens.json"`),
    `Condition must test BOTH destination files. Got: ${s}`
  );
  assert.ok(s.includes('-or'), `Condition must join the two tests with -or (abort if EITHER exists). Got: ${s}`);

  const elseIdx = s.indexOf('} else {');
  assert.ok(elseIdx > 0, `Expected } else { after the check. Got: ${s}`);
  const copyIdx = s.indexOf('Copy-Item');
  assert.ok(copyIdx > elseIdx, `Copy-Item must sit inside the else branch. Got: ${s}`);

  assert.ok(!/\b(throw|exit)\b/.test(psBlocks[1]), 'The PowerShell copy step must not use throw or exit');
});

test('README migration step 2, POSIX: one compound if, copy only in the else branch', () => {
  const bashBlocks = fencedBlocks(migrationSection(), 'bash');
  assert.ok(bashBlocks.length >= 2, 'Expected bash blocks for steps 1 and 2');
  const stmts = statements(bashBlocks[1]);

  // A single top-level if; its fi is the last line, so the block is one compound command.
  assert.strictEqual(stmts.filter(l => l.startsWith('if ')).length, 1,
    `POSIX copy step must have exactly one top-level if. Got:\n${stmts.join('\n')}`);
  assert.strictEqual(stmts[stmts.length - 1], 'fi', `The if must close with fi as the last line. Got:\n${stmts.join('\n')}`);

  const head = stmts[0];
  assert.ok(
    head.startsWith('if [ -e ') && head.includes('.outlook-skills/.env ]') && head.includes('.outlook-skills/tokens.json ]'),
    `Condition must test BOTH destination files. Got: ${head}`
  );
  assert.ok(head.includes(' || '), `Condition must join the two tests with || (abort if EITHER exists). Got: ${head}`);

  const elseIdx = stmts.indexOf('else');
  assert.ok(elseIdx > 0, `Expected an else line. Got:\n${stmts.join('\n')}`);
  const cpIdx = stmts.findIndex(l => /\bcp -n\b/.test(l));
  assert.ok(cpIdx > elseIdx, `cp -n must sit inside the else branch. Got:\n${stmts.join('\n')}`);

  assert.ok(!/\b(exit|throw)\b/.test(bashBlocks[1]), 'The POSIX copy step must not use exit or throw');
});

test('every setup copy of .env.example is guarded (cp -n; Test-Path on the same line)', () => {
  const files = listMarkdown(REPO_ROOT);
  assert.ok(files.length >= MIN_MD_FILES_SCANNED,
    `Scanned ${files.length} markdown files; expected at least ${MIN_MD_FILES_SCANNED}`);

  const unguarded = [];
  let psCopies = 0;
  let posixCopies = 0;
  for (const rel of files) {
    const lines = readFileSync(join(REPO_ROOT, rel), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const where = `${rel}:${i + 1}: ${line.trim()}`;
      if (/Copy-Item\b.*\.env\.example/.test(line)) {
        psCopies++;
        if (!line.includes('Test-Path')) unguarded.push(where);
      }
      if (/\bcp\s.*\.env\.example/.test(line)) {
        posixCopies++;
        if (!/\bcp -n\s/.test(line)) unguarded.push(where);
      }
    });
  }

  // The scan must actually reach copy lines; zero would mean the patterns are wrong.
  assert.ok(psCopies > 0, 'Expected to find PowerShell .env.example copy lines');
  assert.ok(posixCopies > 0, 'Expected to find POSIX .env.example copy lines');
  assert.deepStrictEqual(unguarded, [], `Unguarded .env.example copy lines:\n${unguarded.join('\n')}`);
});
