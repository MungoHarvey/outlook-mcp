// Guards against auto-trigger ambiguity: skill descriptions must be distinct,
// and the previously-overlapping ones (folders vs email-move, categories vs
// email-organize, calendar-list proactivity) must stay disambiguated.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');

function parseFrontmatter(content) {
  const normalised = content.replace(/\r\n/g, '\n');
  const match = normalised.match(/^---\n([\s\S]*?)\n---/);
  return match ? yaml.load(match[1]) : null;
}

function descriptions() {
  const out = {};
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(p)) continue;
    const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
    if (fm && fm.description) out[entry.name] = fm.description;
  }
  return out;
}

describe('Skill description disambiguation', () => {
  const descs = descriptions();

  it('every skill has a non-trivial description', () => {
    for (const [name, d] of Object.entries(descs)) {
      assert.ok(d.length >= 30, `${name} description too short`);
    }
  });

  it('descriptions are unique (no two skills share a description)', () => {
    const seen = new Map();
    for (const [name, d] of Object.entries(descs)) {
      const key = d.trim().toLowerCase();
      assert.ok(!seen.has(key),
        `Duplicate description in ${name} and ${seen.get(key)}`);
      seen.set(key, name);
    }
  });

  it('folders scope excludes moving/organizing emails (belongs to email-move)', () => {
    const d = descs['outlook-folders'].toLowerCase();
    assert.ok(!d.includes('moving emails') && !d.includes('organizing email'),
      'outlook-folders should not claim email move/organize triggers');
  });

  it('categories is marked read-only (apply belongs to email-organize)', () => {
    assert.match(descs['outlook-categories'].toLowerCase(), /read-only/);
  });

  it('calendar-list is not over-broad ("proactively")', () => {
    assert.ok(!descs['outlook-calendar-list'].toLowerCase().includes('proactively'),
      'outlook-calendar-list should not fire proactively on any date mention');
  });
});
