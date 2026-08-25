/**
 * Automated Verification Test Suite for NEXA
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
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🧪 Starting NEXA End-to-End Test Suite...');

  // 1. Check health endpoint
  const health = await checkHealth();
  console.log('✅ [Test 1 Passed] Health Endpoint:', health);
  if (health.service !== 'MingleMonkey' || health.status !== 'ok') {
    throw new Error('Health check failed');
  }

  // 2. Connect two clients
  const clientA = io(SERVER_URL);
  const clientB = io(SERVER_URL);

  let userA = null;
  let userB = null;

  await new Promise((resolve) => {
    let joinedCount = 0;
    function checkBoth() {
      joinedCount++;
      if (joinedCount === 2) resolve();
    }

    clientA.on('connect', () => {
      clientA.emit('user:join', { nickname: 'Alice_Nexa', bio: 'AI Engineer' }, (res) => {
        userA = res.user;
        console.log('✅ [Test 2A Passed] User A joined:', userA.nickname, 'UUID:', userA.id);
        checkBoth();
      });
    });

    clientB.on('connect', () => {
      clientB.emit('user:join', { nickname: 'Bob_Nexa', bio: 'Cybersecurity' }, (res) => {
        userB = res.user;
        console.log('✅ [Test 2B Passed] User B joined:', userB.nickname, 'UUID:', userB.id);
        checkBoth();
      });
    });
  });

  // 3. Test Channel Isolation & Messaging
  await new Promise((resolve) => {
    clientB.on('channel:message', (msg) => {
      if (msg.senderName === 'Alice_Nexa' && msg.content === 'Hello #general world!') {
        console.log('✅ [Test 3 Passed] Channel Broadcast received by Bob:', msg.content);
        resolve();
      }
    });

    clientA.emit('channel:message', {
      channelId: 'general',
      content: 'Hello #general world!'
    });
  });

  // 4. Test Channel Isolation (User B switches to #tech-talk, User A sends in #general)
  await new Promise((resolve, reject) => {
    clientB.emit('channel:join', 'tech-talk', (res) => {
      if (!res.success) return reject(new Error('Failed to join tech-talk'));
      
      let leaked = false;
      const leakListener = (msg) => {
        if (msg.content === 'Message strictly for general') {
          leaked = true;
        }
      };
      clientB.on('channel:message', leakListener);

      clientA.emit('channel:message', {
        channelId: 'general',
        content: 'Message strictly for general'
      });

      setTimeout(() => {
        clientB.off('channel:message', leakListener);
        if (!leaked) {
          console.log('✅ [Test 4 Passed] Channel Isolation Verified: Messages in #general did not leak to #tech-talk');
          resolve();
        } else {
          reject(new Error('Channel isolation violated!'));
        }
      }, 300);
    });
  });

  // 5. Test Direct Messaging (1-on-1)
  let sentDmMsgId = null;
  await new Promise((resolve) => {
    clientB.on('dm:message', (msg) => {
      if (msg.senderId === userA.id && msg.content === 'Private ping from Alice') {
        sentDmMsgId = msg.id;
        console.log('✅ [Test 5 Passed] DM Received by Bob from Alice:', msg.content);
        resolve();
      }
    });

    clientA.emit('dm:message', {
      recipientId: userB.id,
      content: 'Private ping from Alice'
    });
  });

  // 6. Test Message Reactions
  await new Promise((resolve) => {
    clientB.on('message:reaction', (data) => {
      if (data.messageId === sentDmMsgId && data.reactions['🔥']) {
        console.log('✅ [Test 6 Passed] DM Reaction Updated:', data.reactions);
        resolve();
      }
    });

    clientA.emit('message:reaction', {
      recipientId: userB.id,
      messageId: sentDmMsgId,
      emoji: '🔥'
    });
  });

  // 7. Test Random Stranger Matchmaking
  await new Promise((resolve) => {
    let matchedA = false;
    let matchedB = false;

    clientA.on('match:found', (data) => {
      console.log('✅ [Test 7A Passed] Alice matched with stranger:', data.partner.nickname);
      matchedA = true;
      if (matchedA && matchedB) resolve();
    });

    clientB.on('match:found', (data) => {
      console.log('✅ [Test 7B Passed] Bob matched with stranger:', data.partner.nickname);
      matchedB = true;
      if (matchedA && matchedB) resolve();
    });

    clientA.emit('match:find');
    setTimeout(() => clientB.emit('match:find'), 150);
  });

  // 8. Test Stranger Chat Message
  await new Promise((resolve) => {
    clientB.on('match:message', (msg) => {
      if (msg.content === 'Hey stranger!') {
        console.log('✅ [Test 8 Passed] Stranger chat message received:', msg.content);
        resolve();
      }
    });

    clientA.emit('match:message', { content: 'Hey stranger!' });
  });

  // 9. Test Stranger Disconnect / Leave
  await new Promise((resolve) => {
    clientB.on('match:partner-left', (data) => {
      console.log('✅ [Test 9 Passed] Stranger disconnect notification received:', data.message);
      resolve();
    });

    clientA.emit('match:leave');
  });

  clientA.disconnect();
  clientB.disconnect();

  console.log('\n🎉 ALL 9 AUTOMATED TESTS PASSED SUCCESSFULLY! NEXA platform is fully verified.');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
