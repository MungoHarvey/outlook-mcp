// Guards user-facing docs against drifting on the two facts that break setup
// most often: the OAuth redirect URI and the requested scope list. Presence
// checks (not list-equality) so doc formatting can vary.
//
// Scoped to the authoritative setup docs. Phase 5 (docs-truth) extends this to
// README.md / outlook-skills/README.md / outlook-auth reference once rewritten.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const REDIRECT_URI = 'http://localhost:8400/auth/callback';
const WRONG_REDIRECT = 'localhost:8400/callback'; // the historical wrong value

const AUTHORITATIVE_DOCS = [
  'setup/AZURE_SETUP.md',
  'setup/azure-setup-guide.html',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('Doc consistency', () => {
  const scopes = JSON.parse(read('outlook-skills/scopes.json')).scopes
    .filter(s => !['openid', 'profile', 'email', 'offline_access'].includes(s));

  for (const doc of AUTHORITATIVE_DOCS) {
    describe(doc, () => {
      const content = read(doc);

      it('contains the correct redirect URI', () => {
        assert.ok(content.includes(REDIRECT_URI),
          `${doc} is missing the redirect URI ${REDIRECT_URI}`);
      });

      it('does not contain the wrong redirect URI', () => {
        // The wrong value is "/callback" without "/auth" — allow the correct
        // one (which contains "/auth/callback") but reject the bare form.
        const withoutCorrect = content.split(REDIRECT_URI).join('');
        assert.ok(!withoutCorrect.includes(WRONG_REDIRECT),
          `${doc} contains the wrong redirect URI ${WRONG_REDIRECT}`);
      });

      for (const scope of scopes) {
        it(`lists the ${scope} scope`, () => {
          assert.ok(content.includes(scope), `${doc} is missing scope ${scope}`);
        });
      }
    });
  }
});
