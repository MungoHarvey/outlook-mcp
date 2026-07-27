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
