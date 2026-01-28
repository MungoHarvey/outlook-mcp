const { calendarTools } = require('../calendar');

function findArraysWithoutItems(schema, path = '$') {
  const issues = [];
  if (!schema || typeof schema !== 'object') return issues;
  if (schema.type === 'array' && schema.items === undefined) {
    issues.push(path);
  }
  if (schema.properties) {
    for (const [k, v] of Object.entries(schema.properties)) {
      issues.push(...findArraysWithoutItems(v, `${path}.properties.${k}`));
    }
  }
  if (Array.isArray(schema.oneOf)) {
    schema.oneOf.forEach((s, i) => issues.push(...findArraysWithoutItems(s, `${path}.oneOf[${i}]`)));
  }
  return issues;
}

describe('Tools list schemas are draft-07 friendly', () => {
  test('no array property is missing items in calendar tools', () => {
    for (const tool of calendarTools) {
      const issues = findArraysWithoutItems(tool.inputSchema);
      expect(issues).toEqual([]);
    }
  });
});



