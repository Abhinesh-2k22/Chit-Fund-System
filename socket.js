import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Store active group rooms
const activeGroups = new Set();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle joining a group room
  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
    activeGroups.add(groupId);
    console.log(`Client ${socket.id} joined group ${groupId}`);
  });

  // Handle new bids
  socket.on('newBid', (groupId) => {
    if (activeGroups.has(groupId)) {
      io.to(groupId).emit('newBid');
      console.log(`New bid notification sent to group ${groupId}`);
    }
  });

  // Handle winner selection
  socket.on('winnerSelected', (groupId) => {
    if (activeGroups.has(groupId)) {
      io.to(groupId).emit('winnerSelected');
      console.log(`Winner selection notification sent to group ${groupId}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.SOCKET_PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 