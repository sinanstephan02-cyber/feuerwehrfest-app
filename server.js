const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { run, get, all, initDb } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'BitteAdminPasswortAendern2026!';
const SESSION_SECRET = process.env.SESSION_SECRET || 'feuerwehrfest-session-secret';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 16
  }
}));
app.use('/static', express.static(path.join(__dirname, 'public')));

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name || user.username
  };
}

function mapOrderRows(rows) {
  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        tableNumber: row.table_number,
        waiter: row.waiter || '',
        waiterUserId: row.waiter_user_id || null,
        note: row.note || '',
        status: row.status,
        total: row.total,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: []
      });
    }

    if (row.item_id) {
      grouped.get(row.id).items.push({
        id: row.item_id,
        menuItemId: row.menu_item_id,
        name: row.item_name,
        category: row.item_category,
        price: row.price,
        quantity: row.quantity,
        lineTotal: row.line_total
      });
    }
  }

  return Array.from(grouped.values());
}

async function fetchOrders() {
  const rows = await all(`
    SELECT
      o.id, o.table_number, o.waiter, o.waiter_user_id, o.note, o.status, o.total, o.created_at, o.updated_at,
      oi.id AS item_id, oi.menu_item_id, oi.name AS item_name, oi.category AS item_category,
      oi.price, oi.quantity, oi.line_total
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    ORDER BY o.created_at DESC, oi.id ASC
  `);
  return mapOrderRows(rows);
}

async function currentUserFromSession(req) {
  if (!req.session.userId) return null;
  const user = await get('SELECT id, username, role, display_name, is_active FROM users WHERE id = ?', [req.session.userId]);
  if (!user || !user.is_active) return null;
  return user;
}

async function attachUser(req, res, next) {
  req.user = await currentUserFromSession(req);
  if (!req.user) {
    req.session.userId = null;
    req.session.adminUnlocked = false;
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht eingeloggt.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Keine Berechtigung.' });
    next();
  };
}

function requirePageRoles(roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) return res.redirect('/login');
    next();
  };
}

function requireAdminUnlock(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.session.adminUnlocked) return next();
  return res.redirect('/admin-login');
}

async function broadcastOrders() {
  const orders = await fetchOrders();
  io.emit('orders-updated', orders);
}

app.use(attachUser);

app.get('/login', (req, res) => {
  if (req.user) {
    if (req.user.role === 'kitchen') return res.redirect('/kitchen');
    if (req.user.role === 'drinks') return res.redirect('/drinks');
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Bitte Benutzername und Passwort eingeben.' });
    }

    const user = await get(
      'SELECT id, username, password_hash, role, display_name, is_active FROM users WHERE lower(username) = lower(?)',
      [username]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Benutzer oder Passwort ist falsch.' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Benutzer oder Passwort ist falsch.' });
    }

    req.session.userId = user.id;
    req.session.adminUnlocked = false;

    res.json({
      ok: true,
      user: sanitizeUser(user),
      redirectTo: user.role === 'kitchen' ? '/kitchen' : user.role === 'drinks' ? '/drinks' : '/'
    });
  } catch (error) {
    res.status(500).json({ error: 'Login fehlgeschlagen.' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/session', (req, res) => {
  res.json({
    authenticated: Boolean(req.user),
    user: sanitizeUser(req.user),
    adminUnlocked: Boolean(req.session.adminUnlocked)
  });
});

app.get('/admin-login', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.post('/admin-login', requireLogin, (req, res) => {
  const password = String(req.body.password || '');
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Admin-Passwort ist falsch.' });
  }
  req.session.adminUnlocked = true;
  res.json({ ok: true, redirectTo: '/admin' });
});

app.get('/', requirePageRoles(['waiter', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/kitchen', requirePageRoles(['kitchen', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kitchen.html'));
});

app.get('/drinks', requirePageRoles(['drinks', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'drinks.html'));
});

app.get('/admin', requireAdminUnlock, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/menu', requireLogin, async (req, res) => {
  try {
    const items = await all(
      'SELECT id, name, category, price, is_active AS isActive FROM menu_items WHERE is_active = 1 ORDER BY category, name'
    );
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Menue konnte nicht geladen werden.' });
  }
});

app.get('/api/admin/menu', requireLogin, async (req, res) => {
  if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin-Passwort fehlt.' });
  try {
    const items = await all(
      'SELECT id, name, category, price, is_active AS isActive FROM menu_items ORDER BY category, name'
    );
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Admin-Menue konnte nicht geladen werden.' });
  }
});

app.post('/api/admin/menu', requireLogin, async (req, res) => {
  if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin-Passwort fehlt.' });
  try {
    const { name, category, price } = req.body;
    if (!name || !category || Number(price) < 0) {
      return res.status(400).json({ error: 'Bitte Name, Kategorie und Preis angeben.' });
    }

    const result = await run(
      'INSERT INTO menu_items (name, category, price, is_active) VALUES (?, ?, ?, 1)',
      [String(name).trim(), String(category).trim(), Number(price)]
    );
    const item = await get(
      'SELECT id, name, category, price, is_active AS isActive FROM menu_items WHERE id = ?',
      [result.id]
    );
    io.emit('menu-updated');
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Artikel konnte nicht gespeichert werden.' });
  }
});

app.patch('/api/admin/menu/:id', requireLogin, async (req, res) => {
  if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin-Passwort fehlt.' });
  try {
    const id = Number(req.params.id);
    const { name, category, price, isActive } = req.body;
    await run(
      'UPDATE menu_items SET name = ?, category = ?, price = ?, is_active = ? WHERE id = ?',
      [String(name).trim(), String(category).trim(), Number(price), isActive ? 1 : 0, id]
    );
    const item = await get(
      'SELECT id, name, category, price, is_active AS isActive FROM menu_items WHERE id = ?',
      [id]
    );
    io.emit('menu-updated');
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Artikel konnte nicht aktualisiert werden.' });
  }
});

app.get('/api/admin/users', requireLogin, async (req, res) => {
  if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin-Passwort fehlt.' });
  try {
    const users = await all(
      'SELECT id, username, role, is_active AS isActive, COALESCE(display_name, username) AS displayName, created_at AS createdAt FROM users ORDER BY role, username'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Benutzer konnten nicht geladen werden.' });
  }
});

app.post('/api/admin/users', requireLogin, async (req, res) => {
  if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin-Passwort fehlt.' });
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const displayName = String(req.body.displayName || username).trim();
    const password = String(req.body.password || '');
    const role = String(req.body.role || 'waiter');
    const allowedRoles = ['waiter', 'kitchen', 'drinks', 'admin'];

    if (!username || !password || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Bitte Benutzername, Passwort und Rolle korrekt angeben.' });
    }

    const existing = await get('SELECT id FROM users WHERE lower(username) = lower(?)', [username]);
    if (existing) {
      return res.status(409).json({ error: 'Benutzername existiert bereits.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password_hash, role, is_active, display_name, created_at) VALUES (?, ?, ?, 1, ?, ?)',
      [username, passwordHash, role, displayName, new Date().toISOString()]
    );

    const user = await get(
      'SELECT id, username, role, is_active AS isActive, COALESCE(display_name, username) AS displayName, created_at AS createdAt FROM users WHERE id = ?',
      [result.id]
    );
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Benutzer konnte nicht angelegt werden.' });
  }
});

app.patch('/api/admin/users/:id', requireLogin, async (req, res) => {
  if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin-Passwort fehlt.' });
  try {
    const id = Number(req.params.id);
    const existing = await get('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

    const fields = [];
    const params = [];

    if (typeof req.body.displayName === 'string') {
      fields.push('display_name = ?');
      params.push(req.body.displayName.trim());
    }
    if (typeof req.body.role === 'string') {
      fields.push('role = ?');
      params.push(req.body.role);
    }
    if (typeof req.body.isActive === 'boolean') {
      fields.push('is_active = ?');
      params.push(req.body.isActive ? 1 : 0);
    }
    if (typeof req.body.password === 'string' && req.body.password.trim()) {
      const hash = await bcrypt.hash(req.body.password.trim(), 10);
      fields.push('password_hash = ?');
      params.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Aenderung uebergeben.' });
    }

    params.push(id);
    await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

    const user = await get(
      'SELECT id, username, role, is_active AS isActive, COALESCE(display_name, username) AS displayName, created_at AS createdAt FROM users WHERE id = ?',
      [id]
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Benutzer konnte nicht aktualisiert werden.' });
  }
});

app.get('/api/orders', requireLogin, async (req, res) => {
  try {
    const orders = await fetchOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Bestellungen konnten nicht geladen werden.' });
  }
});

app.post('/api/orders', requireRoles(['waiter', 'admin']), async (req, res) => {
  try {
    const { tableNumber, note, items } = req.body;

    if (!tableNumber || Number(tableNumber) < 1 || Number(tableNumber) > 50) {
      return res.status(400).json({ error: 'Bitte einen gueltigen Tisch von 1 bis 50 auswaehlen.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Bitte mindestens einen Artikel auswaehlen.' });
    }

    const now = new Date().toISOString();
    const sanitizedItems = items
      .filter(item => Number(item.quantity) > 0)
      .map(item => ({
        menuItemId: Number(item.id),
        quantity: Number(item.quantity)
      }));

    if (sanitizedItems.length === 0) {
      return res.status(400).json({ error: 'Bitte mindestens einen Artikel mit Menge > 0 auswaehlen.' });
    }

    const ids = sanitizedItems.map(item => item.menuItemId);
    const placeholders = ids.map(() => '?').join(',');
    const menuItems = await all(
      `SELECT id, name, category, price FROM menu_items WHERE id IN (${placeholders}) AND is_active = 1`,
      ids
    );

    const menuMap = new Map(menuItems.map(item => [item.id, item]));
    const fullItems = sanitizedItems.map(item => {
      const menuItem = menuMap.get(item.menuItemId);
      if (!menuItem) {
        throw new Error(`Artikel ${item.menuItemId} nicht gefunden.`);
      }
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        category: menuItem.category,
        price: menuItem.price,
        quantity: item.quantity,
        lineTotal: Number((menuItem.price * item.quantity).toFixed(2))
      };
    });

    const total = Number(fullItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
    const waiterName = req.user.display_name || req.user.username;

    const orderResult = await run(
      'INSERT INTO orders (table_number, waiter, waiter_user_id, note, status, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [Number(tableNumber), waiterName, req.user.id, String(note || '').trim(), 'neu', total, now, now]
    );

    for (const item of fullItems) {
      await run(
        'INSERT INTO order_items (order_id, menu_item_id, name, category, price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderResult.id, item.menuItemId, item.name, item.category, item.price, item.quantity, item.lineTotal]
      );
    }

    const order = (await fetchOrders()).find(o => o.id === orderResult.id);
    await broadcastOrders();
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Bestellung konnte nicht gespeichert werden.' });
  }
});

app.patch('/api/orders/:id/status', requireRoles(['kitchen', 'drinks', 'admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const allowed = ['neu', 'in Arbeit', 'fertig', 'geliefert'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Ungueltiger Status.' });
    }

    const existing = await get('SELECT id FROM orders WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
    }

    await run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), id]);
    const order = (await fetchOrders()).find(o => o.id === id);
    await broadcastOrders();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Status konnte nicht aktualisiert werden.' });
  }
});

app.get('/api/stats', requireLogin, async (req, res) => {
  try {
    const stats = {
      totalOrders: await get('SELECT COUNT(*) AS value FROM orders'),
      openOrders: await get("SELECT COUNT(*) AS value FROM orders WHERE status IN ('neu', 'in Arbeit')"),
      finishedOrders: await get("SELECT COUNT(*) AS value FROM orders WHERE status = 'fertig'"),
      deliveredOrders: await get("SELECT COUNT(*) AS value FROM orders WHERE status = 'geliefert'"),
      revenue: await get('SELECT COALESCE(SUM(total), 0) AS value FROM orders')
    };

    res.json({
      totalOrders: stats.totalOrders.value,
      openOrders: stats.openOrders.value,
      finishedOrders: stats.finishedOrders.value,
      deliveredOrders: stats.deliveredOrders.value,
      revenue: Number(stats.revenue.value || 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Statistiken konnten nicht geladen werden.' });
  }
});

app.get('/api/admin/waiter-stats', requireLogin, async (req, res) => {
  if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin-Passwort fehlt.' });
  try {
    const rows = await all(`
      SELECT
        COALESCE(u.display_name, o.waiter, u.username) AS waiter,
        COUNT(o.id) AS totalOrders,
        COALESCE(SUM(o.total), 0) AS revenue
      FROM orders o
      LEFT JOIN users u ON u.id = o.waiter_user_id
      GROUP BY COALESCE(u.display_name, o.waiter, u.username)
      ORDER BY totalOrders DESC, waiter ASC
    `);
    res.json(rows.map(row => ({ ...row, revenue: Number(row.revenue || 0) })));
  } catch (error) {
    res.status(500).json({ error: 'Kellner-Statistiken konnten nicht geladen werden.' });
  }
});

io.on('connection', async socket => {
  socket.emit('orders-updated', await fetchOrders());
  socket.emit('menu-updated');
});

initDb().then(() => {
 app.get("/setup", async (req, res) => {
  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash("feuerwehr123", 10);

  for (let i = 1; i <= 30; i++) {
    const username = "kellner" + String(i).padStart(2, "0");

    db.run(
      "INSERT OR IGNORE INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)",
      [username, passwordHash, "waiter"]
    );
  }

  db.run(
    "INSERT OR IGNORE INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)",
    ["kueche", passwordHash, "kitchen"]
  );

  db.run(
    "INSERT OR IGNORE INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)",
    ["getraenke", passwordHash, "drinks"]
  );

  res.send("Standard-Benutzer erstellt");
}); 
server.listen(PORT, () => {
    console.log(`Server laeuft auf http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Datenbankstart fehlgeschlagen:', error);
  process.exit(1);
});
