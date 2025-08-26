import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Database setup
const db = new sqlite3.Database(join(__dirname, 'kopi.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  db.serialize(() => {
    // Materials table
    db.run(`CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      packageSize INTEGER NOT NULL,
      purchasePrice INTEGER NOT NULL
    )`);

    // Menu items table
    db.run(`CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      cost INTEGER NOT NULL,
      ingredients TEXT NOT NULL
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customerName TEXT NOT NULL,
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL
    )`);

    // KDS tickets table
    db.run(`CREATE TABLE IF NOT EXISTS kds_tickets (
      orderId TEXT PRIMARY KEY,
      status TEXT NOT NULL
    )`);
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle data sync events
  socket.on('sync', (change) => {
    const { type, action, data, id } = change;
    
    // Broadcast to all other clients
    socket.broadcast.emit('sync', change);
    
    // Persist to database
    switch (type) {
      case 'materials':
        handleMaterialsSync(action, data, id);
        break;
      case 'menuItems':
        handleMenuItemsSync(action, data, id);
        break;
      case 'orders':
        handleOrdersSync(action, data, id);
        break;
      case 'kdsTickets':
        handleKdsTicketsSync(action, data, id);
        break;
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Database sync handlers
function handleMaterialsSync(action, data, id) {
  switch (action) {
    case 'create':
    case 'update':
      db.run(
        'INSERT OR REPLACE INTO materials (id, name, unit, packageSize, purchasePrice) VALUES (?, ?, ?, ?, ?)',
        [data.id, data.name, data.unit, data.packageSize, data.purchasePrice]
      );
      break;
    case 'delete':
      db.run('DELETE FROM materials WHERE id = ?', [id]);
      break;
  }
}

function handleMenuItemsSync(action, data, id) {
  switch (action) {
    case 'create':
    case 'update':
      db.run(
        'INSERT OR REPLACE INTO menu_items (id, name, category, price, cost, ingredients) VALUES (?, ?, ?, ?, ?, ?)',
        [data.id, data.name, data.category, data.price, data.cost, JSON.stringify(data.ingredients)]
      );
      break;
    case 'delete':
      db.run('DELETE FROM menu_items WHERE id = ?', [id]);
      break;
  }
}

function handleOrdersSync(action, data, id) {
  switch (action) {
    case 'create':
    case 'update':
      db.run(
        'INSERT OR REPLACE INTO orders (id, customerName, items, total, status, date) VALUES (?, ?, ?, ?, ?, ?)',
        [data.id, data.customerName, JSON.stringify(data.items), data.total, data.status, typeof data.date === 'string' ? data.date : data.date.toISOString()]
      );
      break;
    case 'delete':
      db.run('DELETE FROM orders WHERE id = ?', [id]);
      break;
  }
}

// REST API endpoints for initial data load
app.get('/api/materials', (req, res) => {
  db.all('SELECT * FROM materials', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/menu-items', (req, res) => {
  db.all('SELECT * FROM menu_items', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(row => ({
      ...row,
      ingredients: JSON.parse(row.ingredients)
    })));
  });
});

app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(row => ({
      ...row,
      items: JSON.parse(row.items),
      date: new Date(row.date)
    })));
  });
});

// KDS Tickets endpoints
app.get('/api/kds-tickets', (req, res) => {
  db.all('SELECT * FROM kds_tickets', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const tickets = rows.reduce((acc, row) => {
      acc[row.orderId] = { status: row.status };
      return acc;
    }, {});
    res.json(tickets);
  });
});

function handleKdsTicketsSync(action, data, id) {
  switch (action) {
    case 'update':
      db.run(
        'INSERT OR REPLACE INTO kds_tickets (orderId, status) VALUES (?, ?)',
        [data.orderId, data.status]
      );
      break;
    case 'delete':
      db.run('DELETE FROM kds_tickets WHERE orderId = ?', [id]);
      break;
  }
}

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
