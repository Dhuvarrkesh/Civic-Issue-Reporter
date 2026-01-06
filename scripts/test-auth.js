// Simple script to test auth endpoints. Run with: node scripts/test-auth.js
// Requires the backend server to be running at BACKEND_URL (default http://localhost:3000)

const fetch = require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const rand = () => Math.floor(Math.random() * 1000000);

(async () => {
  try {
    console.log('Testing citizen signup...');
    const email = `test${Date.now()}@example.com`;
    const password = 'Aa@12345';
    const resp = await fetch(`${BACKEND_URL}/api/v1/citizen/signup`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ fullName: 'Test User', email, password, phonenumber: '0123456789' })
    });
    const data = await resp.json();
    console.log('Signup response:', resp.status, data);

    if (!resp.ok) {
      console.error('Citizen signup failed');
      return;
    }

    if (!data.token) {
      console.error('No token returned on signup');
      return;
    }

    console.log('Testing citizen signin...');
    const signinResp = await fetch(`${BACKEND_URL}/api/v1/citizen/signin`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email, password })
    });
    const signinData = await signinResp.json();
    console.log('Signin response:', signinResp.status, signinData);

    // Admin flow
    console.log('Testing admin signup...');
    const adminEmail = `admin${Date.now()}@example.com`;
    const adminPassword = 'Aa@12345';
    const adminCode = 1000 + rand();
    const adminResp = await fetch(`${BACKEND_URL}/api/v1/admin/signup`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ fullName: 'Admin User', email: adminEmail, password: adminPassword, phonenumber: '0123456789', department: 'Test', adminAccessCode: adminCode })
    });
    const adminData = await adminResp.json();
    console.log('Admin signup response:', adminResp.status, adminData);

    if (!adminResp.ok) {
      console.error('Admin signup failed');
      return;
    }

    if (!adminData.token) {
      console.error('No token returned on admin signup');
      return;
    }

    console.log('Testing admin signin...');
    const adminSigninResp = await fetch(`${BACKEND_URL}/api/v1/admin/signin`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email: adminEmail, password: adminPassword, adminAccessCode: adminCode })
    });
    const adminSigninData = await adminSigninResp.json();
    console.log('Admin signin response:', adminSigninResp.status, adminSigninData);

    console.log('Auth tests completed.');
  } catch (err) {
    console.error('Error during tests:', err);
  }
})();
