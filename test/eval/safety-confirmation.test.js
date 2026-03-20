const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.join(__dirname, '..', '..', '.claude', 'skills');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('Safety confirmation eval', () => {
  const fixtures = yaml.load(
    fs.readFileSync(path.join(FIXTURES_DIR, 'safety-cases.yaml'), 'utf8')
  );

  describe('Destructive skills must have SAFETY markers', () => {
    for (const skillName of fixtures.destructive_skills) {
      it(`${skillName} should contain SAFETY confirmation`, () => {
        const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
        assert.ok(fs.existsSync(skillPath), `Missing ${skillName}/SKILL.md`);

        const content = fs.readFileSync(skillPath, 'utf8');
        // Check for SAFETY marker (case-sensitive, uppercase)
        assert.ok(content.includes('SAFETY'),
          `${skillName}/SKILL.md should contain "SAFETY" confirmation marker for destructive operations`);
      });
    }
  });

  describe('Read-only skills should not have SAFETY markers', () => {
    for (const skillName of fixtures.safe_skills) {
      it(`${skillName} should not require SAFETY confirmation`, () => {
        const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
        assert.ok(fs.existsSync(skillPath), `Missing ${skillName}/SKILL.md`);

        const content = fs.readFileSync(skillPath, 'utf8');
        // Check that SAFETY marker is absent (meaning no destructive confirmation needed)
        // Note: We check for "SAFETY:" or "**SAFETY" patterns that indicate confirmation requirements
        const hasSafetyConfirmation = /\bSAFETY[:\s].*confirm/i.test(content);
        assert.ok(!hasSafetyConfirmation,
          `${skillName}/SKILL.md should not have SAFETY confirmation markers (it's a read-only skill)`);
      });
    }
  });
});
