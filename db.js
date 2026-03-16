const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function ensureColumn(table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some(col => col.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function seedMenu() {
  const count = await get('SELECT COUNT(*) AS count FROM menu_items');
  if (count.count > 0) return;

  const items = [
    ['Bratwurst', 'Kueche', 3.5, 1],
    ['Currywurst', 'Kueche', 5.0, 1],
    ['Pommes', 'Kueche', 3.0, 1],
    ['Steak im Broetchen', 'Kueche', 6.5, 1],
    ['Frikadelle', 'Kueche', 3.0, 1],
    ['Bockwurst', 'Kueche', 3.2, 1],
    ['Salat', 'Kueche', 4.5, 1],
    ['Cola', 'Getraenke', 2.5, 1],
    ['Fanta', 'Getraenke', 2.5, 1],
    ['Wasser', 'Getraenke', 2.0, 1],
    ['Apfelschorle', 'Getraenke', 2.5, 1],
    ['Bier', 'Getraenke', 3.0, 1],
    ['Radler', 'Getraenke', 3.0, 1],
    ['Kaffee', 'Getraenke', 2.0, 1]
  ];

  for (const item of items) {
    await run('INSERT INTO menu_items (name, category, price, is_active) VALUES (?, ?, ?, ?)', item);
  }
}

async function seedUsers() {
  const count = await get('SELECT COUNT(*) AS count FROM users');
  if (count.count > 0) return;

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'feuerwehr123';
  const hash = await bcrypt.hash(defaultPassword, 10);

  for (let i = 1; i <= 30; i += 1) {
    const username = `kellner${String(i).padStart(2, '0')}`;
    await run(
      'INSERT INTO users (username, password_hash, role, is_active, display_name, created_at) VALUES (?, ?, ?, 1, ?, ?)',
      [username, hash, 'waiter', username, new Date().toISOString()]
    );
  }

  await run(
    'INSERT INTO users (username, password_hash, role, is_active, display_name, created_at) VALUES (?, ?, ?, 1, ?, ?)',
    ['kueche', hash, 'kitchen', 'Kueche', new Date().toISOString()]
  );

  await run(
    'INSERT INTO users (username, password_hash, role, is_active, display_name, created_at) VALUES (?, ?, ?, 1, ?, ?)',
    ['getraenke', hash, 'drinks', 'Getraenke', new Date().toISOString()]
  );
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number INTEGER NOT NULL,
    waiter TEXT,
    waiter_user_id INTEGER,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'neu',
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  )`);

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    display_name TEXT,
    created_at TEXT NOT NULL
  )`);

  await ensureColumn('orders', 'waiter_user_id', 'INTEGER');
  await ensureColumn('users', 'display_name', 'TEXT');
  await ensureColumn('users', 'created_at', 'TEXT');

  await seedMenu();
  await seedUsers();
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb
};
