const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.join(__dirname, '..', '..', '.claude', 'skills');

function parseFrontmatter(content) {
  // Normalise line endings so the regex works on both LF and CRLF files
  const normalised = content.replace(/\r\n/g, '\n');
  const match = normalised.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return yaml.load(match[1]);
}

function getSkillDirs() {
  return fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('outlook-'))
    .map(d => d.name);
}

describe('Skill structure', () => {
  const skillDirs = getSkillDirs();

  it('should have at least 18 skill directories', () => {
    assert.ok(skillDirs.length >= 18, `Expected at least 18 skill dirs, found ${skillDirs.length}`);
  });

  // outlook-references is a data-only dir, no SKILL.md expected
  const skillDirsWithSkillMd = skillDirs.filter(d => d !== 'outlook-references');

  for (const dir of skillDirsWithSkillMd) {
    describe(dir, () => {
      const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');

      it('should have SKILL.md', () => {
        assert.ok(fs.existsSync(skillPath), `Missing SKILL.md in ${dir}`);
      });

      it('should have valid YAML frontmatter with name and description', () => {
        const content = fs.readFileSync(skillPath, 'utf8');
        const fm = parseFrontmatter(content);
        assert.ok(fm, `No frontmatter found in ${dir}/SKILL.md`);
        assert.ok(typeof fm.name === 'string' && fm.name.length > 0,
          `Missing or empty 'name' in ${dir}/SKILL.md frontmatter`);
        assert.ok(typeof fm.description === 'string' && fm.description.length > 0,
          `Missing or empty 'description' in ${dir}/SKILL.md frontmatter`);
      });

      it('should have reference.md', () => {
        const refPath = path.join(SKILLS_DIR, dir, 'reference.md');
        assert.ok(fs.existsSync(refPath), `Missing reference.md in ${dir}`);
      });
    });
  }

  // Verify user_invocable is set correctly
  const nonInvocableSkills = ['outlook-base', 'outlook-categories'];
  const invocableSkills = skillDirsWithSkillMd.filter(d => !nonInvocableSkills.includes(d));

  for (const dir of invocableSkills) {
    it(`${dir} should be user_invocable`, () => {
      const content = fs.readFileSync(path.join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
      const fm = parseFrontmatter(content);
      assert.strictEqual(fm.user_invocable, true,
        `${dir} should have user_invocable: true`);
    });
  }

  // Verify per-skill reference YAML files exist in outlook-base/references/
  describe('outlook-base references', () => {
    const expectedFiles = ['errors.yaml', 'colors.yaml', 'timezones.yaml', 'graph-api-patterns.yaml'];

    for (const file of expectedFiles) {
      it(`should contain ${file}`, () => {
        const filePath = path.join(SKILLS_DIR, 'outlook-base', 'references', file);
        assert.ok(fs.existsSync(filePath), `Missing ${file} in outlook-base/references`);
      });
    }
  });

  // Verify only expected skills have params.yaml
  describe('params.yaml presence', () => {
    const expectedWithParams = ['outlook-email-send', 'outlook-email-draft', 'outlook-calendar-create', 'outlook-contacts-manage', 'outlook-calendar-update'];

    for (const dir of skillDirsWithSkillMd) {
      const paramsPath = path.join(SKILLS_DIR, dir, 'params.yaml');
      if (expectedWithParams.includes(dir)) {
        it(`${dir} should have params.yaml`, () => {
          assert.ok(fs.existsSync(paramsPath), `Missing params.yaml in ${dir}`);
        });
      } else {
        it(`${dir} should not have params.yaml`, () => {
          assert.ok(!fs.existsSync(paramsPath), `Unexpected params.yaml in ${dir}`);
        });
      }
    }
  });
});
