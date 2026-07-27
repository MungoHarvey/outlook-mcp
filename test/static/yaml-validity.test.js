const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');

function findYamlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findYamlFiles(fullPath));
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('YAML validity', () => {
  const yamlFiles = findYamlFiles(SKILLS_DIR);

  it('should find YAML files to test', () => {
    assert.ok(yamlFiles.length >= 7, `Expected at least 7 YAML files, found ${yamlFiles.length}`);
  });

  for (const filePath of yamlFiles) {
    const relPath = path.relative(SKILLS_DIR, filePath);

    it(`should parse ${relPath} without errors`, () => {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = yaml.load(content);
      assert.ok(parsed !== null && parsed !== undefined, 'Parsed result should not be null');
      assert.strictEqual(typeof parsed, 'object', 'Parsed result should be an object');
    });
  }

  // Verify per-skill reference files exist (reference data lives in each skill's references/ subdir)
  const expectedReferenceFiles = [
    'outlook-base/references/errors.yaml',
    'outlook-base/references/colors.yaml',
    'outlook-base/references/timezones.yaml',
    'outlook-base/references/graph-api-patterns.yaml',
  ];

  for (const file of expectedReferenceFiles) {
    it(`should contain shared reference ${file}`, () => {
      const fullPath = path.join(SKILLS_DIR, file);
      assert.ok(fs.existsSync(fullPath), `Missing expected file: ${file}`);
    });
  }

  const expectedParamsFiles = [
    'outlook-email-send/params.yaml',
    'outlook-calendar-create/params.yaml',
    'outlook-contacts-manage/params.yaml',
  ];

  for (const file of expectedParamsFiles) {
    it(`should contain params file ${file}`, () => {
      const fullPath = path.join(SKILLS_DIR, file);
      assert.ok(fs.existsSync(fullPath), `Missing expected file: ${file}`);
    });
  }
});
