const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join tracking room for specific delivery
    socket.on('track_delivery', (trackingCode) => {
      socket.join(`tracking_${trackingCode}`);
      console.log(`[Socket] ${socket.id} tracking delivery ${trackingCode}`);
    });

    // Join dashboard room
    socket.on('join_dashboard', () => {
      socket.join('dashboard');
      console.log(`[Socket] ${socket.id} joined dashboard`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

/**
 * Emit delivery location update to tracking page and dashboard
 */
function emitLocationUpdate(trackingCode, locationData) {
  if (!io) return;
  io.to(`tracking_${trackingCode}`).emit('location_update', locationData);
  io.to('dashboard').emit('delivery_location_update', { trackingCode, ...locationData });
}

/**
 * Emit delivery status change
 */
function emitDeliveryUpdate(delivery) {
  if (!io) return;
  io.to(`tracking_${delivery.tracking_code}`).emit('delivery_update', delivery);
  io.to('dashboard').emit('delivery_update', delivery);
}

/**
 * Emit schedule update
 */
function emitScheduleUpdate(schedule) {
  if (!io) return;
  io.to('dashboard').emit('schedule_update', schedule);
}

module.exports = {
  initSocket,
  getIO,
  emitLocationUpdate,
  emitDeliveryUpdate,
  emitScheduleUpdate,
};
