#!/usr/bin/env node

// Debug script to check environment variable loading
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('=== Environment Variable Debug ===');
console.log('Current working directory:', process.cwd());
console.log('Script directory (__dirname):', __dirname);
console.log('');

console.log('Environment Variables:');
console.log('OUTLOOK_CLIENT_ID:', process.env.OUTLOOK_CLIENT_ID ? '✅ Set' : '❌ Not set');
console.log('OUTLOOK_CLIENT_SECRET:', process.env.OUTLOOK_CLIENT_SECRET ? '✅ Set' : '❌ Not set');
console.log('OUTLOOK_TENANT_ID:', process.env.OUTLOOK_TENANT_ID ? '✅ Set' : '❌ Not set');
console.log('USE_TEST_MODE:', process.env.USE_TEST_MODE || 'false');
console.log('');

if (process.env.OUTLOOK_CLIENT_ID) {
    console.log('✅ Client ID loaded successfully');
    console.log('   Length:', process.env.OUTLOOK_CLIENT_ID.length);
} else {
    console.log('❌ Client ID not loaded');
}

if (process.env.OUTLOOK_CLIENT_SECRET) {
    console.log('✅ Client Secret loaded successfully');
    console.log('   Length:', process.env.OUTLOOK_CLIENT_SECRET.length);
} else {
    console.log('❌ Client Secret not loaded');
}