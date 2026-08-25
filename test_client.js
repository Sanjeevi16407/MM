const { io } = require('socket.io-client');

async function testChat() {
  console.log('Testing WebSocket clients...');
  const client1 = io('http://localhost:3000');
  const client2 = io('http://localhost:3000');

  let c1Joined = false;
  let c2Joined = false;

  await new Promise((resolve) => {
    client1.on('connect', () => {
      console.log('Client 1 connected:', client1.id);
      client1.emit('user:join', { username: 'Alice', bio: 'Hello World' }, (res) => {
        console.log('Client 1 joined successfully:', res.success);
        c1Joined = true;
        if (c1Joined && c2Joined) resolve();
      });
    });

    client2.on('connect', () => {
      console.log('Client 2 connected:', client2.id);
      client2.emit('user:join', { username: 'Bob', bio: 'Coding' }, (res) => {
        console.log('Client 2 joined successfully:', res.success);
        c2Joined = true;
        if (c1Joined && c2Joined) resolve();
      });
    });
  });

  // Test Channel message broadcast
  console.log('Testing channel message...');
  client2.on('message:channel', (msg) => {
    if (msg.sender.username === 'Alice') {
      console.log(`[Channel Test Passed] Bob received message from Alice: "${msg.text}"`);
    }
  });

  client1.emit('channel:send_message', { channel: 'general', text: 'Hello everyone in #general!' });

  // Test Direct Message
  console.log('Testing direct message...');
  client2.on('message:dm', (msg) => {
    console.log(`[DM Test Passed] Bob received DM from ${msg.sender.username}: "${msg.text}"`);
  });

  client1.emit('dm:send_message', { recipientId: client2.id, text: 'Hey Bob, private message here!' });

  // Test Stranger Matchmaking
  console.log('Testing Stranger Matchmaking...');
  client1.on('stranger:matched', (data) => {
    console.log(`[Stranger Match Passed] Alice matched with: ${data.partner.username}`);
  });
  client2.on('stranger:matched', (data) => {
    console.log(`[Stranger Match Passed] Bob matched with: ${data.partner.username}`);
    setTimeout(() => {
      client1.disconnect();
      client2.disconnect();
      console.log('All socket tests completed successfully!');
      process.exit(0);
    }, 500);
  });

  client1.emit('stranger:find');
  setTimeout(() => {
    client2.emit('stranger:find');
  }, 200);
}

testChat().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
