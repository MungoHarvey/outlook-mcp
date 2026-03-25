const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');

const OPERATION_SKILLS = [
  'outlook-email-list', 'outlook-email-read', 'outlook-email-send',
  'outlook-email-reply', 'outlook-email-move', 'outlook-email-delete', 'outlook-email-organize',
  'outlook-calendar-list', 'outlook-calendar-create', 'outlook-calendar-update', 'outlook-calendar-respond',
  'outlook-contacts-list', 'outlook-contacts-manage',
  'outlook-folders', 'outlook-rules', 'outlook-categories'
];

describe('API call structure — graph_call.py patterns', () => {
  it('should have 16 operation skills defined', () => {
    assert.strictEqual(OPERATION_SKILLS.length, 16);
  });

  for (const skill of OPERATION_SKILLS) {
    describe(skill, () => {
      const skillPath = path.join(SKILLS_DIR, skill, 'SKILL.md');

      it('should use graph_call.py for API calls', () => {
        const content = fs.readFileSync(skillPath, 'utf8');
        assert.ok(
          content.includes('scripts/graph_call.py'),
          `${skill}/SKILL.md does not contain graph_call.py API call pattern`
        );
      });

      it('should not use curl with Bearer token', () => {
        const content = fs.readFileSync(skillPath, 'utf8');
        assert.ok(
          !content.includes('curl -H "Authorization: Bearer'),
          `${skill}/SKILL.md still contains old curl+Bearer pattern`
        );
      });
    });
  }
});
