const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.join(__dirname, '..', '..', '.claude', 'skills');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return yaml.load(match[1]);
}

describe('Skill selection eval', () => {
  const fixtures = yaml.load(
    fs.readFileSync(path.join(FIXTURES_DIR, 'skill-selection.yaml'), 'utf8')
  );

  for (const testCase of fixtures.cases) {
    it(`"${testCase.prompt}" → ${testCase.expected_skill}`, () => {
      const skillPath = path.join(SKILLS_DIR, testCase.expected_skill, 'SKILL.md');
      assert.ok(fs.existsSync(skillPath),
        `Skill directory ${testCase.expected_skill} not found`);

      const content = fs.readFileSync(skillPath, 'utf8');
      const fm = parseFrontmatter(content);
      assert.ok(fm, `No frontmatter in ${testCase.expected_skill}/SKILL.md`);

      const description = fm.description.toLowerCase();
      const found = testCase.trigger_words.some(word =>
        description.includes(word.toLowerCase())
      );
      assert.ok(found,
        `Description of ${testCase.expected_skill} should contain at least one of: ${testCase.trigger_words.join(', ')}\nActual description: ${fm.description}`);
    });
  }
});
