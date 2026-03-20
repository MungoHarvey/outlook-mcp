const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', '..', '.claude', 'skills');
const SECURITY_TEST_FILE = __filename; // exclude self from scans

function getSkillMdFiles() {
  // Return all SKILL.md file paths under SKILLS_DIR
  // Exclude outlook-references (no SKILL.md)
  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('outlook-') && d.name !== 'outlook-references')
    .map(d => d.name);

  return skillDirs
    .map(dir => path.join(SKILLS_DIR, dir, 'SKILL.md'))
    .filter(p => fs.existsSync(p));
}

describe('Security — token leak prevention', () => {
  const skillFiles = getSkillMdFiles();

  it('should have skill files to scan', () => {
    assert.ok(skillFiles.length >= 16, `Expected at least 16 SKILL.md files, found ${skillFiles.length}`);
  });

  const FORBIDDEN_PATTERNS = [
    { name: 'get_token function call', pattern: /get_token\s*\(/ },
    { name: 'token_helper module import', pattern: /token_helper/ },
    { name: 'legacy token file path', pattern: /outlook-mcp-tokens\.json/ },
    { name: 'shell TOKEN variable', pattern: /\$TOKEN/ },
    { name: 'raw access_token reference', pattern: /access_token/ },
  ];

  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    it(`should not contain "${name}" in any SKILL.md`, () => {
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
