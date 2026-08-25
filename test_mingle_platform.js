/**
 * Comprehensive Automated Verification Test for MINGLE Social Platform
 */

const { io } = require('socket.io-client');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';

function checkHealth() {
  return new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runMingleTests() {
  console.log('🧪 Starting MINGLE Social Discovery & Permanent Identity Test Suite...');

  // 1. Health check
  const health = await checkHealth();
  console.log('✅ [Test 1 Passed] Health Endpoint:', health);

  // 2. Connect client 1 (Sanjeevi) and client 2 (Alex)
  const client1 = io(SERVER_URL);
  const client2 = io(SERVER_URL);

  let userSanjeevi = null;
  let userAlex = null;

  const testSuffix = Math.floor(Math.random() * 10000);
  const username1 = `sanjeevi_${testSuffix}`;
  const username2 = `alex_${testSuffix}`;

  // Test 2: Check username availability
  await new Promise((resolve, reject) => {
    client1.emit('user:check_username', username1, (res) => {
      if (res.available) {
        console.log(`✅ [Test 2 Passed] Username availability check: @${username1} is available.`);
        resolve();
      } else {
        reject(new Error(`Username should be available: ${res.error}`));
      }
    });
  });

  // Test 3: Register permanent identities
  await new Promise((resolve, reject) => {
    client1.emit('user:register', {
      username: username1,
      displayName: 'Sanjeevi',
      bio: 'Creator of MINGLE'
    }, (res) => {
      if (res.success) {
        userSanjeevi = res.user;
        console.log(`✅ [Test 3A Passed] Registered @${userSanjeevi.username} (ID: ${userSanjeevi.id})`);
        
        // Register Alex
        client2.emit('user:register', {
          username: username2,
          displayName: 'Alex',
          bio: 'Building cool software'
        }, (res2) => {
          if (res2.success) {
            userAlex = res2.user;
            console.log(`✅ [Test 3B Passed] Registered @${userAlex.username} (ID: ${userAlex.id})`);
            resolve();
          } else {
            reject(new Error(res2.error));
          }
        });
      } else {
        reject(new Error(res.error));
      }
    });
  });

  // Test 4: Duplicate username rejection
  await new Promise((resolve, reject) => {
    const client3 = io(SERVER_URL);
    client3.emit('user:register', {
      username: username1,
      displayName: 'Imposter'
    }, (res) => {
      client3.disconnect();
      if (!res.success && res.error.includes('already taken')) {
        console.log(`✅ [Test 4 Passed] Duplicate username @${username1} properly rejected.`);
        resolve();
      } else {
        reject(new Error('Duplicate username was not rejected!'));
      }
    });
  });

  // Test 5: Search discovery
  await new Promise((resolve, reject) => {
    client1.emit('user:search', 'alex', (res) => {
      if (res.success && res.results.some(u => u.username === username2)) {
        console.log(`✅ [Test 5 Passed] Search discovery found @${username2} successfully.`);
        resolve();
      } else {
        reject(new Error('Search failed to find Alex'));
      }
    });
  });

  // Test 6: Mingle Action
  await new Promise((resolve, reject) => {
    client2.on('user:mingled_by', (data) => {
      console.log(`✅ [Test 6A Passed] Alex received live Mingle notification from @${data.mingler.username}!`);
    });

    client1.emit('user:mingle', userAlex.id, (res) => {
      if (res.success && res.mingled) {
        console.log(`✅ [Test 6B Passed] Sanjeevi successfully mingled with Alex!`);
        resolve();
      } else {
        reject(new Error(res.error || 'Mingle action failed'));
      }
    });
  });

  // Test 7: Direct Messaging between Mingled Users
  await new Promise((resolve, reject) => {
    client2.on('dm:message', (msg) => {
      if (msg.senderId === userSanjeevi.id && msg.content === 'Hey Alex! Glad we mingled.') {
        console.log(`✅ [Test 7 Passed] Real-time message delivered: "${msg.content}"`);
        resolve();
      }
    });

    client1.emit('dm:message', {
      recipientId: userAlex.id,
      content: 'Hey Alex! Glad we mingled.'
    });
  });

  // Test 8: Surprise Mingle Matchmaking
  await new Promise((resolve, reject) => {
    let matched1 = false;
    let matched2 = false;

    client1.on('surprise:matched', (data) => {
      console.log(`✅ [Test 8A Passed] Sanjeevi matched with: @${data.partner.username}`);
      matched1 = true;
      if (matched1 && matched2) resolve();
    });

    client2.on('surprise:matched', (data) => {
      console.log(`✅ [Test 8B Passed] Alex matched with: @${data.partner.username}`);
      matched2 = true;
      if (matched1 && matched2) resolve();
    });

    client1.emit('surprise:find');
    setTimeout(() => client2.emit('surprise:find'), 150);
  });

  // Test 9: Unmingle Action
  await new Promise((resolve, reject) => {
    client1.emit('user:unmingle', userAlex.id, (res) => {
      if (res.success && res.unmingled) {
        console.log(`✅ [Test 9 Passed] Sanjeevi successfully unmingled with Alex.`);
        resolve();
      } else {
        reject(new Error(res.error || 'Unmingle failed'));
      }
    });
  });

  client1.disconnect();
  client2.disconnect();

  console.log('\n🎉 ALL 9 MINGLE PLATFORM TESTS PASSED! Permanent identity, discovery, social graph, chat, and surprise mingle are fully operational.');
  process.exit(0);
}

runMingleTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
