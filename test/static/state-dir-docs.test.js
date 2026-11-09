const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

// The four docs that must state the state-directory lookup order.
const LOOKUP_DOCS = [
  'CLAUDE.md',
  'README.md',
  'skills/outlook-auth/SKILL.md',
  'skills/outlook-setup/SKILL.md',
];

// Phrasings of the pre-2.1.0 rule, where the plugin folder won whenever it held a `.env`.
const OLD_ORDER_CLAIMS = [
  /already holds (`\.env`|state)/i,
  /holds `\.env`\s*\/\s*`tokens\.json`/i,
];

describe('state-directory docs', () => {
  for (const rel of LOOKUP_DOCS) {
    describe(rel, () => {
      const text = read(rel);

      it('mentions --where', () => {
        assert.match(text, /--where/);
      });

      it('says the plugin folder counts only with tokens.json', () => {
        assert.match(text, /only if it holds `tokens\.json`/);
      });

      it('states the steps in order: override, conditional home, plugin tokens.json', () => {
        const at = (re) => {
          const m = re.exec(text);
          assert.ok(m, `missing step matching ${re}`);
          return m.index;
        };
        const override = at(/if set and non-empty/);
        const home = at(/holds a `\.env` or `tokens\.json`/);
        const plugin = at(/only if it holds `tokens\.json`/);
        assert.ok(override < home, 'override must come before the home step');
        assert.ok(home < plugin, 'home step must come before the plugin step');
      });

      it('does not claim the plugin folder wins when it holds a .env', () => {
        for (const claim of OLD_ORDER_CLAIMS) {
          assert.doesNotMatch(text, claim);
        }
      });
    });
  }
});

describe('first-party version fields', () => {
  const EXPECTED = '2.1.0';
  const json = (rel) => JSON.parse(read(rel));

  const fields = [
    ['.claude-plugin/plugin.json version', () => json('.claude-plugin/plugin.json').version],
    ['.claude-plugin/marketplace.json metadata.version', () => json('.claude-plugin/marketplace.json').metadata.version],
    ['.claude-plugin/marketplace.json plugins[].version', () => json('.claude-plugin/marketplace.json').plugins.map((p) => p.version).join(',')],
    ['package.json version', () => json('package.json').version],
    ['package-lock.json version', () => json('package-lock.json').version],
    ['package-lock.json packages[""].version', () => json('package-lock.json').packages[''].version],
    ['mcp-server/package.json version', () => json('mcp-server/package.json').version],
    ['mcp-server/package-lock.json version', () => json('mcp-server/package-lock.json').version],
    ['mcp-server/package-lock.json packages[""].version', () => json('mcp-server/package-lock.json').packages[''].version],
    ['mcp-server/src/index.js server version', () => {
      const m = read('mcp-server/src/index.js').match(/version:\s*"([^"]+)"/);
      assert.ok(m, 'no version string found in mcp-server/src/index.js');
      return m[1];
    }],
  ];

  for (const [label, get] of fields) {
    it(`${label} is ${EXPECTED}`, () => {
      assert.strictEqual(get(), EXPECTED);
    });
  }

  it('CHANGELOG.md has a 2.1.0 entry at the top', () => {
    assert.match(read('CHANGELOG.md'), /^## \[2\.1\.0\]/m);
  });
});
