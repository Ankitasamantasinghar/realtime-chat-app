const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const clients = new Map(); // socket -> {username, room}
const rooms = new Map();   // roomName -> Set of sockets

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      return;
    }

    // Set username
    if (msg.type === 'setUsername') {
      clients.set(ws, { username: msg.username, room: null });
      ws.send(JSON.stringify({ type: 'system', text: `Username set to ${msg.username}` }));
      broadcastToAll(`${msg.username} joined the chat`);
    }

    // Join room
    if (msg.type === 'joinRoom') {
      const user = clients.get(ws);
      if (!user) return;
      
      // Leave old room
      if (user.room && rooms.has(user.room)) {
        rooms.get(user.room).delete(ws);
      }
      
      user.room = msg.room;
      if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
      rooms.get(msg.room).add(ws);
      
      ws.send(JSON.stringify({ type: 'system', text: `You joined room: ${msg.room}` }));
      broadcastToRoom(msg.room, `${user.username} joined ${msg.room}`, ws);
    }

    // Chat message
    if (msg.type === 'chat') {
      const user = clients.get(ws);
      if (user && user.room) {
        broadcastToRoom(user.room, `${user.username}: ${msg.text}`);
      }
    }
  });

  ws.on('close', () => {
    const user = clients.get(ws);
    if (user) {
      if (user.room && rooms.has(user.room)) {
        rooms.get(user.room).delete(ws);
        broadcastToRoom(user.room, `${user.username} left the chat`);
      }
      clients.delete(ws);
    }
  });
});

function broadcastToRoom(room, text, excludeWs = null) {
  if (rooms.has(room)) {
    rooms.get(room).forEach(client => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', text }));
      }
    });
  }
}

function broadcastToAll(text) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'message', text }));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));