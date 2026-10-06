// Every destructive or outward-facing graph_call.py command in the skill docs
// must be preceded (within the same section) by a SAFETY marker. The older
// safety-confirmation test only checks that "SAFETY" appears somewhere in a
// SKILL.md; this one checks each command, across SKILL.md, reference.md and
// templates.md. outlook-base is exempt: it documents generic command syntax.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');
const EXEMPT = new Set(['outlook-base']);
const INVOCATION = /graph_call\.py\s+(GET|POST|PATCH|DELETE|PUT)\s+["']([^"']+)["']/;

// Returns a reason string if (method, endpoint) needs confirmation, else null.
function destructive(method, endpoint) {
  const p = endpoint.split('?')[0].toLowerCase();
  if (method === 'DELETE') return 'delete';
  if (method === 'POST' && /\/(sendmail|send|reply|replyall|forward|permanentdelete|cancel|decline)$/.test(p)) {
    return 'sends mail or is irreversible';
  }
  if (method === 'POST' && p.endsWith('/messagerules')) return 'creates an inbox rule';
  if (method === 'PATCH' && /\/contacts\/[^/]+$/.test(p)) return 'overwrites contact fields';
  return null;
}

function* commands() {
  for (const skill of fs.readdirSync(SKILLS_DIR)) {
    if (EXEMPT.has(skill)) continue;
    const dir = path.join(SKILLS_DIR, skill);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = INVOCATION.exec(lines[i]);
        if (!m) continue;
        const reason = destructive(m[1], m[2]);
        if (reason) yield { where: `${skill}/${file}:${i + 1}`, lines, i, call: `${m[1]} ${m[2]}`, reason };
      }
    }
  }
}

// Look back from the command to the nearest Markdown heading for a SAFETY
// marker. Lines inside ``` fences are code (a "# comment" there is not a
// heading), so track fence state from the top of the file.
function hasSafetyInSection(lines, i) {
  const inFence = [];
  let open = false;
  for (let k = 0; k < lines.length; k++) {
    if (/^\s*```/.test(lines[k])) { inFence[k] = true; open = !open; continue; }
    inFence[k] = open;
  }
  for (let j = i - 1; j >= 0; j--) {
    if (lines[j].includes('SAFETY')) return true;
    if (!inFence[j] && /^#{1,6}\s/.test(lines[j])) return false;
  }
  return false;
}

describe('Per-command safety markers', () => {
  const found = [...commands()];

  it('finds destructive commands (parser sanity check)', () => {
    assert.ok(found.length >= 10, `only ${found.length} destructive commands found — parser may be broken`);
  });

  for (const c of found) {
    it(`${c.where} ${c.call}`, () => {
      assert.ok(hasSafetyInSection(c.lines, c.i),
        `${c.where}: "${c.call}" ${c.reason} but its section has no SAFETY marker`);
    });
  }
});
