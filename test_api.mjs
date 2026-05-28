import { createAuthToken } from './backend/src/features/auth/token.js';
import { UserRole } from '@climence/shared';

const token = createAuthToken({
  id: 'u-analyst',
  name: 'Analyst',
  email: 'analyst@test.com',
  role: UserRole.ANALYST
});

console.log('Token:', token.token);

async function testPut() {
  try {
    const res = await fetch('http://localhost:3000/api/alerts/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.token}`,
      },
      body: JSON.stringify({ pm25Threshold: 35 }),
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    console.error(err);
  }
}

testPut();
