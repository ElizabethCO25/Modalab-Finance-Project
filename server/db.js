// DB helper: crea y expone la base de datos SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'finances.db');
const db = new sqlite3.Database(dbPath);

// Crear tabla si no existe
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    type TEXT,
    category TEXT,
    amount REAL,
    description TEXT
  )`);
});

module.exports = db;
