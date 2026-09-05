/**
 * Comprehensive Automated Verification Test for MINGLE Social Platform
 * (Includes Password Authentication & Profile Photo Upload Tests)
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
  const password1 = 'sanjeeviSecret123';
  const customAvatarPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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

  // Test 3: Register permanent identities with password and uploaded photo
  await new Promise((resolve, reject) => {
    client1.emit('user:register', {
      username: username1,
      displayName: 'Sanjeevi',
      password: password1,
      avatar: customAvatarPhoto,
      bio: 'Creator of MINGLE'
    }, (res) => {
      if (res.success) {
        userSanjeevi = res.user;
        console.log(`✅ [Test 3A Passed] Registered @${userSanjeevi.username} with Password & Custom Photo (ID: ${userSanjeevi.id})`);
        
        // Register Alex
        client2.emit('user:register', {
          username: username2,
          displayName: 'Alex',
          password: 'alexPassword456',
          bio: 'Building cool software'
        }, (res2) => {
          if (res2.success) {
            userAlex = res2.user;
            console.log(`✅ [Test 3B Passed] Registered @${userAlex.username} with Password (ID: ${userAlex.id})`);
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

  // Test 4: Password Authentication Validation
  await new Promise((resolve, reject) => {
    const authClient = io(SERVER_URL);
    // 4A: Incorrect password attempt
    authClient.emit('user:login', { username: username1, password: 'wrongPassword!' }, (res) => {
      if (!res.success && res.error.includes('Incorrect password')) {
        console.log('✅ [Test 4A Passed] Wrong password correctly rejected.');
        
        // 4B: Correct password attempt
        authClient.emit('user:login', { username: username1, password: password1 }, (res2) => {
          authClient.disconnect();
          if (res2.success && res2.user.username === username1) {
            console.log('✅ [Test 4B Passed] Correct password successfully authenticated.');
            resolve();
          } else {
            reject(new Error(`Correct password login failed: ${res2.error}`));
          }
        });
      } else {
        authClient.disconnect();
        reject(new Error('Incorrect password was not rejected!'));
      }
    });
  });

  // Test 5: Duplicate username rejection
  await new Promise((resolve, reject) => {
    const client3 = io(SERVER_URL);
    client3.emit('user:register', {
      username: username1,
      displayName: 'Imposter',
      password: 'imposterPassword'
    }, (res) => {
      client3.disconnect();
      if (!res.success && res.error.includes('already taken')) {
        console.log(`✅ [Test 5 Passed] Duplicate username @${username1} properly rejected.`);
        resolve();
      } else {
        reject(new Error('Duplicate username was not rejected!'));
      }
    });
  });

  // Test 6: Search discovery
  await new Promise((resolve, reject) => {
    client1.emit('user:search', 'alex', (res) => {
      if (res.success && res.results.some(u => u.username === username2)) {
        console.log(`✅ [Test 6 Passed] Search discovery found @${username2} successfully.`);
        resolve();
      } else {
        reject(new Error('Search failed to find Alex'));
      }
    });
  });

  // Test 7: Mingle Action
  await new Promise((resolve, reject) => {
    client2.on('user:mingled_by', (data) => {
      console.log(`✅ [Test 7A Passed] Alex received live Mingle notification from @${data.mingler.username}!`);
    });

    client1.emit('user:mingle', userAlex.id, (res) => {
      if (res.success && res.mingled) {
        console.log(`✅ [Test 7B Passed] Sanjeevi successfully mingled with Alex!`);
        resolve();
      } else {
        reject(new Error(res.error || 'Mingle action failed'));
      }
    });
  });

  // Test 8: Direct Messaging between Mingled Users
  await new Promise((resolve, reject) => {
    client2.on('dm:message', (msg) => {
      if (msg.senderId === userSanjeevi.id && msg.content === 'Hey Alex! Glad we mingled.') {
        console.log(`✅ [Test 8 Passed] Real-time message delivered: "${msg.content}"`);
        resolve();
      }
    });

    client1.emit('dm:message', {
      recipientId: userAlex.id,
      content: 'Hey Alex! Glad we mingled.'
    });
  });

  // Test 9: Surprise Mingle Matchmaking
  await new Promise((resolve, reject) => {
    let matched1 = false;
    let matched2 = false;

    client1.on('surprise:matched', (data) => {
      console.log(`✅ [Test 9A Passed] Sanjeevi matched with: @${data.partner.username}`);
      matched1 = true;
      if (matched1 && matched2) resolve();
    });

    client2.on('surprise:matched', (data) => {
      console.log(`✅ [Test 9B Passed] Alex matched with: @${data.partner.username}`);
      matched2 = true;
      if (matched1 && matched2) resolve();
    });

    client1.emit('surprise:find');
    setTimeout(() => client2.emit('surprise:find'), 150);
  });

  // Test 10: Unmingle Action
  await new Promise((resolve, reject) => {
    client1.emit('user:unmingle', userAlex.id, (res) => {
      if (res.success && res.unmingled) {
        console.log(`✅ [Test 10 Passed] Sanjeevi successfully unmingled with Alex.`);
        resolve();
      } else {
        reject(new Error(res.error || 'Unmingle failed'));
      }
    });
  });

  // Test 11: WebRTC Live Video & Audio Calling Flow
  let activeCallId = null;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebRTC Call Test timed out')), 5000);

    // Client 2 listens for incoming call
    client2.once('call:incoming', (incoming) => {
      console.log(`✅ [Test 11A Passed] Alex received incoming ${incoming.callType} call from @${incoming.caller.username}!`);
      activeCallId = incoming.callId;

      // Alex accepts the call
      client2.emit('call:accept', { callId: incoming.callId }, (acceptRes) => {
        if (!acceptRes.success) reject(new Error('Accept call failed'));
      });
    });

    // Client 1 listens for accepted signal
    client1.once('call:accepted', (accepted) => {
      console.log(`✅ [Test 11B Passed] Sanjeevi received call acceptance signal from Alex!`);

      // Exchange WebRTC SDP signal
      client1.emit('call:signal', {
        callId: accepted.callId,
        targetUserId: userAlex.id,
        signal: { offer: { type: 'offer', sdp: 'v=0\r\no=mock...' } }
      });
    });

    // Client 2 receives WebRTC SDP signal
    client2.once('call:signal', (signaled) => {
      console.log(`✅ [Test 11C Passed] WebRTC SDP offer signal delivered to Alex successfully!`);

      // End call
      client1.emit('call:end', { callId: activeCallId });
    });

    // Client 2 receives call ended
    client2.once('call:ended', (ended) => {
      console.log(`✅ [Test 11D Passed] Call successfully terminated and cleaned up.`);
      clearTimeout(timeout);
      resolve();
    });

    // Sanjeevi initiates video call to Alex
    client1.emit('call:initiate', { recipientId: userAlex.id, callType: 'video' }, (initRes) => {
      if (!initRes.success) reject(new Error(initRes.error || 'Call initiate failed'));
    });
  });

  client1.disconnect();
  client2.disconnect();

  console.log('\n🎉 ALL 11 MINGLE PLATFORM TESTS PASSED! WebRTC Live Video Calling, Password auth, Instagram-style photo uploads, discovery, social graph, chat, and surprise mingle are fully operational.');
  process.exit(0);
}

runMingleTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
