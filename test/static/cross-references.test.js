const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');

function findMarkdownFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractMarkdownLinks(content) {
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const href = match[2];
    // Skip external URLs and anchors
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
      continue;
    }
    links.push({ text: match[1], href });
  }
  return links;
}

describe('Cross-references', () => {
  const mdFiles = findMarkdownFiles(SKILLS_DIR);

  it('should find markdown files to check', () => {
    assert.ok(mdFiles.length >= 30, `Expected at least 30 markdown files, found ${mdFiles.length}`);
  });

  it('no skill folder duplicates an outlook-base reference file', () => {
    const baseRefsDir = path.join(SKILLS_DIR, 'outlook-base', 'references');
    const baseRefs = new Set(fs.readdirSync(baseRefsDir));
    assert.ok(baseRefs.size > 0,
      'outlook-base/references is empty — anti-dup check would pass vacuously');
    const dups = [];
    for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'outlook-base') continue;
      const refDir = path.join(SKILLS_DIR, entry.name, 'references');
      if (!fs.existsSync(refDir)) continue;
      for (const f of fs.readdirSync(refDir)) {
        if (baseRefs.has(f)) dups.push(`${entry.name}/references/${f}`);
      }
    }
    assert.deepStrictEqual(dups, [],
      `Reference files duplicated from outlook-base (link to ../outlook-base/references/ instead): ${dups.join(', ')}`);
  });

  for (const filePath of mdFiles) {
    const relPath = path.relative(SKILLS_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const links = extractMarkdownLinks(content);

    if (links.length === 0) continue;

    describe(relPath, () => {
      for (const link of links) {
        it(`link to "${link.href}" should resolve`, () => {
          const resolved = path.resolve(path.dirname(filePath), link.href);
          assert.ok(fs.existsSync(resolved),
            `Broken link in ${relPath}: [${link.text}](${link.href}) → ${resolved}`);
        });
      }
    });
  }
});
