const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.join(__dirname, '..', '..', '.claude', 'skills');

const SKILLS_WITH_PARAMS = [
  'outlook-email-send',
  'outlook-calendar-create',
  'outlook-contacts-manage',
];

describe('Parameter consistency', () => {
  for (const skillName of SKILLS_WITH_PARAMS) {
    describe(skillName, () => {
      const skillDir = path.join(SKILLS_DIR, skillName);
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const paramsPath = path.join(skillDir, 'params.yaml');

      it('should have both SKILL.md and params.yaml', () => {
        assert.ok(fs.existsSync(skillMdPath), `Missing SKILL.md`);
        assert.ok(fs.existsSync(paramsPath), `Missing params.yaml`);
      });

      it('params.yaml should parse and contain keys', () => {
        const content = fs.readFileSync(paramsPath, 'utf8');
        const parsed = yaml.load(content);
        assert.ok(parsed !== null && typeof parsed === 'object', 'params.yaml should be a non-null object');
        const keys = Object.keys(parsed);
        assert.ok(keys.length > 0, 'params.yaml should have at least one key');
      });

      it('SKILL.md should reference params.yaml', () => {
        const skillContent = fs.readFileSync(skillMdPath, 'utf8');
        assert.ok(skillContent.includes('params.yaml'),
          `${skillName}/SKILL.md should reference params.yaml`);
      });
    });
  }

  // Specific parameter key checks
  describe('outlook-email-send params', () => {
    it('should have importance values', () => {
      const parsed = yaml.load(
        fs.readFileSync(path.join(SKILLS_DIR, 'outlook-email-send', 'params.yaml'), 'utf8')
      );
      assert.ok(parsed.importance, 'Should have importance key');
    });
  });

  describe('outlook-calendar-create params', () => {
    it('should have calendar-specific keys', () => {
      const parsed = yaml.load(
        fs.readFileSync(path.join(SKILLS_DIR, 'outlook-calendar-create', 'params.yaml'), 'utf8')
      );
      // Calendar create should have showAs or recurrence or sensitivity
      const keys = Object.keys(parsed);
      const expectedAny = ['showAs', 'recurrence', 'sensitivity', 'importance'];
      const found = expectedAny.filter(k => keys.includes(k));
      assert.ok(found.length > 0,
        `Expected at least one of [${expectedAny.join(', ')}] in calendar-create params, found keys: ${keys.join(', ')}`);
    });
  });
});
