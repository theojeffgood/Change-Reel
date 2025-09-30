#!/usr/bin/env node

/**
 * Test OAuth Credentials
 * 
 * This script verifies that your OAuth credentials are valid by:
 * 1. Loading them from .env
 * 2. Generating a test OAuth URL
 * 3. Making a test request to GitHub
 */

require('dotenv').config();

const clientId = process.env.OAUTH_CLIENT_ID;
const clientSecret = process.env.OAUTH_CLIENT_SECRET;
const nextAuthUrl = process.env.NEXTAUTH_URL;

console.log('\n🔍 OAuth Credentials Test\n');
console.log('═'.repeat(60));

// Check credentials are loaded
console.log('\n1️⃣  Environment Variables:');
console.log(`   OAUTH_CLIENT_ID: ${clientId ? `${clientId.slice(0, 10)}... (${clientId.length} chars)` : '❌ MISSING'}`);
console.log(`   OAUTH_CLIENT_SECRET: ${clientSecret ? '✅ present' : '❌ MISSING'}`);
console.log(`   NEXTAUTH_URL: ${nextAuthUrl || '❌ MISSING'}`);

if (!clientId || !clientSecret) {
  console.error('\n❌ Missing OAuth credentials! Check your .env file.\n');
  process.exit(1);
}

// Generate test OAuth URL
const callbackUrl = `${nextAuthUrl}/api/auth/callback/github`;
const state = 'test-state-' + Date.now();
const scope = 'read:user user:email read:org';

const oauthUrl = new URL('https://github.com/login/oauth/authorize');
oauthUrl.searchParams.set('client_id', clientId);
oauthUrl.searchParams.set('redirect_uri', callbackUrl);
oauthUrl.searchParams.set('scope', scope);
oauthUrl.searchParams.set('state', state);

console.log('\n2️⃣  Generated OAuth URL:');
console.log(`   ${oauthUrl.toString()}\n`);

// Test the Client ID by making a request to GitHub
console.log('3️⃣  Testing Client ID with GitHub...\n');

const https = require('https');

const testUrl = new URL('https://api.github.com/applications/' + clientId + '/token');
const testBody = JSON.stringify({ access_token: 'test' });

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testBody.length,
    'Accept': 'application/json',
    'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
    'User-Agent': 'change-reel-oauth-test'
  }
};

const req = https.request(testUrl, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 404) {
      console.log('   ✅ Client ID is valid (GitHub recognizes it)');
      console.log('   ✅ Client Secret appears correct');
      console.log('\n4️⃣  Next Steps:');
      console.log('   • Credentials are valid ✅');
      console.log('   • OAuth URL format is correct ✅');
      console.log('   • Issue must be in NextAuth configuration or cookies\n');
      console.log('   Try this OAuth URL in your browser:');
      console.log(`   ${oauthUrl.toString()}\n`);
      console.log('   If it redirects to GitHub login, credentials work!\n');
    } else if (res.statusCode === 401) {
      console.error('   ❌ Authentication failed - Client ID or Secret is wrong!');
      console.error(`   Response: ${data}\n`);
      process.exit(1);
    } else {
      console.log(`   Response (${res.statusCode}): ${data}`);
      console.log('   Note: Any response other than 401 means credentials are likely valid\n');
    }
  });
});

req.on('error', (error) => {
  console.error('   ❌ Request failed:', error.message);
  process.exit(1);
});

req.write(testBody);
req.end();
