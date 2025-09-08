const config = require('./config');

const now = new Date();
console.log('=== Testing New Configuration System ===\n');

console.log('Current date/time:', now);
console.log('User timezone:', config.dateFormatter.getUserTimezone());
console.log('User locale:', config.dateFormatter.getUserLocale());

console.log('\n--- Testing DateTime Formats ---');
console.log('DateTime (user preference):', config.dateFormatter.formatDate(now, 'datetime'));
console.log('DateTime short:', config.dateFormatter.formatDate(now, 'datetime', 'short'));
console.log('DateTime medium:', config.dateFormatter.formatDate(now, 'datetime', 'medium'));
console.log('DateTime long:', config.dateFormatter.formatDate(now, 'datetime', 'long'));

console.log('\n--- Testing Date Formats ---');
console.log('Date (user preference):', config.dateFormatter.formatDate(now, 'date'));
console.log('Date short:', config.dateFormatter.formatDate(now, 'date', 'short'));
console.log('Date medium:', config.dateFormatter.formatDate(now, 'date', 'medium'));
console.log('Date long:', config.dateFormatter.formatDate(now, 'date', 'long'));

console.log('\n--- Testing Time Formats ---');
console.log('Time (user preference):', config.dateFormatter.formatDate(now, 'time'));
console.log('Time short:', config.dateFormatter.formatDate(now, 'time', 'short'));
console.log('Time long:', config.dateFormatter.formatDate(now, 'time', 'long'));

console.log('\n--- Testing Date Range ---');
const tomorrow = new Date(now);
tomorrow.setDate(now.getDate() + 1);
console.log('Date range:', config.dateFormatter.formatDateRange(now, tomorrow));

console.log('\n=== Test Complete ===');
