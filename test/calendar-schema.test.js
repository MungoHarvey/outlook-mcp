const { calendarTools } = require('../calendar');

const Ajv = require('ajv');
const addFormats = require('ajv-formats');

function getToolByName(name) {
  return calendarTools.find(t => t.name === name);
}

describe('Calendar tool schemas', () => {
  let ajv;
  beforeAll(() => {
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
  });

  test('create-event schema compiles and validates attendees items', () => {
    const tool = getToolByName('create-event');
    expect(tool).toBeTruthy();
    const validate = ajv.compile(tool.inputSchema);

    // Valid minimal payload
    const valid = validate({
      subject: 'Test',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      attendees: ['a@example.com', 'b@example.com']
    });
    expect(valid).toBe(true);

    // Invalid attendees (missing items type)
    const invalid = validate({
      subject: 'Test',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      attendees: [123]
    });
    expect(invalid).toBe(false);
  });

  test('update-event schema compiles and validates attendees items', () => {
    const tool = getToolByName('update-event');
    expect(tool).toBeTruthy();
    const validate = ajv.compile(tool.inputSchema);

    const valid = validate({ eventId: 'id', attendees: ['c@example.com'] });
    expect(valid).toBe(true);

    const invalid = validate({ eventId: 'id', attendees: [{}] });
    expect(invalid).toBe(false);
  });
});



