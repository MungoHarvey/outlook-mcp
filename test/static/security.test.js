const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');

// Walk every skill file (SKILL.md, reference.md, params.yaml, references/*.yaml)
// — advanced patterns live in reference/yaml files, so scanning only SKILL.md
// missed the raw curl/Bearer examples the security model forbids.
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(md|ya?ml)$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe('Security — token leak prevention', () => {
  const skillFiles = walk(SKILLS_DIR);

  it('should have skill files to scan', () => {
    assert.ok(skillFiles.length >= 40,
      `Expected many skill files (md/yaml), found ${skillFiles.length}`);
  });

  const FORBIDDEN_PATTERNS = [
    { name: 'get_token function call', pattern: /get_token\s*\(/ },
    { name: 'token_helper module import', pattern: /token_helper/ },
    { name: 'legacy token file path', pattern: /outlook-mcp-tokens\.json/ },
    { name: 'shell TOKEN variable', pattern: /\$TOKEN/ },
    { name: 'raw access_token reference', pattern: /access_token/ },
    { name: 'curl command', pattern: /\bcurl\b/ },
    { name: 'Authorization Bearer header', pattern: /Bearer/ },
    { name: 'direct graph.microsoft.com URL', pattern: /graph\.microsoft\.com/ },
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
