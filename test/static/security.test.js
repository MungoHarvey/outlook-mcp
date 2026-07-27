const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');
const SECURITY_TEST_FILE = __filename; // exclude self from scans

function getScannableFiles() {
  // Scan every prompt-visible skill file — SKILL.md, reference.md, params.yaml,
  // and the reference YAMLs under references/ — not just the SKILL.md entrypoints.
  // Exclude outlook-references (no SKILL.md)
  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('outlook-') && d.name !== 'outlook-references')
    .map(d => d.name);

  const files = [];
  for (const dirName of skillDirs) {
    const dirPath = path.join(SKILLS_DIR, dirName);
    for (const name of ['SKILL.md', 'reference.md', 'params.yaml']) {
      const filePath = path.join(dirPath, name);
      if (fs.existsSync(filePath)) files.push(filePath);
    }
    const refsDir = path.join(dirPath, 'references');
    if (fs.existsSync(refsDir)) {
      for (const entry of fs.readdirSync(refsDir)) {
        if (/\.(ya?ml|md)$/.test(entry)) files.push(path.join(refsDir, entry));
      }
    }
  }
  return files;
}

describe('Security — token leak prevention', () => {
  const skillFiles = getScannableFiles();
  const skillMdCount = skillFiles.filter(p => path.basename(p) === 'SKILL.md').length;
  const referenceMdCount = skillFiles.filter(p => path.basename(p) === 'reference.md').length;

  it('should have skill files to scan', () => {
    assert.ok(skillMdCount >= 16, `Expected at least 16 SKILL.md files, found ${skillMdCount}`);
    assert.ok(referenceMdCount >= 16, `Expected at least 16 reference.md files, found ${referenceMdCount}`);
  });

  const FORBIDDEN_PATTERNS = [
    { name: 'get_token function call', pattern: /get_token\s*\(/ },
    { name: 'token_helper module import', pattern: /token_helper/ },
    { name: 'legacy token file path', pattern: /outlook-mcp-tokens\.json/ },
    { name: 'shell TOKEN variable', pattern: /\$TOKEN/ },
    { name: 'raw access_token reference', pattern: /access_token/ },
    { name: 'raw Authorization header', pattern: /Authorization:\s*Bearer/i },
  ];

  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    it(`should not contain "${name}" in any skill file`, () => {
      const violations = [];
      for (const filePath of skillFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (pattern.test(content)) {
          violations.push(filePath.replace(SKILLS_DIR, ''));
        }
      }
      assert.deepStrictEqual(violations, [],
        `Forbidden pattern "${name}" found in: ${violations.join(', ')}`);
    });
  }
});
