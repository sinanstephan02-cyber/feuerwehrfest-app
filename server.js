
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data.db");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "BitteUnbedingtAendern2026!";

const db = new sqlite3.Database(DB_PATH);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "feuerwehrfest-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  })
);

app.use("/assets", express.static(path.join(__dirname, "public")));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function addColumnIfMissing(table, column, definition) {
  const cols = await all(`PRAGMA table_info(${table})`);
  const exists = cols.some(c => c.name === column);
  if (!exists) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'waiter'
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      station TEXT NOT NULL DEFAULT 'kitchen',
      active INTEGER NOT NULL DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number INTEGER NOT NULL,
      waiter_username TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      station TEXT NOT NULL DEFAULT 'kitchen',
      status TEXT NOT NULL DEFAULT 'neu',
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )
  `);

  await addColumnIfMissing("menu_items", "active", "INTEGER NOT NULL DEFAULT 1");
  await addColumnIfMissing("menu_items", "station", "TEXT NOT NULL DEFAULT 'kitchen'");
  await addColumnIfMissing("menu_items", "price", "REAL NOT NULL DEFAULT 0");

  const tableCount = await get(`SELECT value FROM settings WHERE key = 'table_count'`);
  if (!tableCount) {
    await run(`INSERT INTO settings (key, value) VALUES ('table_count', '50')`);
  }

  const menuCount = await get(`SELECT COUNT(*) AS count FROM menu_items`);
  if (!menuCount || menuCount.count === 0) {
    const defaults = [
      ["Bratwurst", 4.5, "kitchen"],
      ["Currywurst", 6.5, "kitchen"],
      ["Pommes", 3.5, "kitchen"],
      ["Steak", 8.5, "kitchen"],
      ["Cola", 2.5, "drinks"],
      ["Fanta", 2.5, "drinks"],
      ["Wasser", 2.0, "drinks"],
      ["Bier", 3.0, "drinks"]
    ];
    for (const item of defaults) {
      await run(
        `INSERT INTO menu_items (name, price, station, active) VALUES (?, ?, ?, 1)`,
        item
      );
    }
  }

  const hash = await bcrypt.hash("feuerwehr123", 10);

  for (let i = 1; i <= 30; i++) {
    const username = `kellner${String(i).padStart(2, "0")}`;
    await run(
      `INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, 'waiter')`,
      [username, hash]
    );
  }

  await run(
    `INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, 'kitchen')`,
    ["kueche", hash]
  );
  await run(
    `INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, 'drinks')`,
    ["getraenke", hash]
  );
}

function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) return res.redirect("/login");
    if (!roles.includes(req.session.user.role)) return res.status(403).send("Kein Zugriff");
    next();
  };
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect("/admin-login");
}

app.get("/", (req, res) => {
  if (req.session?.user) {
    if (req.session.user.role === "kitchen") return res.redirect("/kitchen");
    if (req.session.user.role === "drinks") return res.redirect("/drinks");
    return res.redirect("/waiter");
  }
  return res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Fehlende Daten" });
  try {
    const user = await get(`SELECT * FROM users WHERE username = ?`, [username.trim()]);
    if (!user) return res.status(401).json({ error: "Login fehlgeschlagen" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Login fehlgeschlagen" });

    req.session.user = { id: user.id, username: user.username, role: user.role };
    let redirectTo = "/waiter";
    if (user.role === "kitchen") redirectTo = "/kitchen";
    if (user.role === "drinks") redirectTo = "/drinks";

    return res.json({ ok: true, redirectTo, role: user.role, username: user.username });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Serverfehler" });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/admin-login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

app.post("/admin-login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true, redirectTo: "/admin" });
  }
  return res.status(401).json({ error: "Falsches Admin-Passwort" });
});

app.post("/admin-logout", (req, res) => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

app.get("/waiter", requireRole(["waiter"]), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "waiter.html"));
});

app.get("/kitchen", requireRole(["kitchen"]), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "kitchen.html"));
});

app.get("/drinks", requireRole(["drinks"]), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "drinks.html"));
});

app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/api/me", (req, res) => {
  res.json({
    user: req.session?.user || null,
    isAdmin: !!req.session?.isAdmin
  });
});

app.get("/api/tables", requireLogin, async (req, res) => {
  const row = await get(`SELECT value FROM settings WHERE key = 'table_count'`);
  res.json({ count: Number(row?.value || 50) });
});

app.get("/api/menu", requireLogin, async (req, res) => {
  const rows = await all(`SELECT * FROM menu_items WHERE active = 1 ORDER BY station, name`);
  res.json(rows);
});

app.get("/api/orders", requireLogin, async (req, res) => {
  const station = req.query.station;
  let where = "";
  let params = [];
  if (station) {
    where = "WHERE oi.station = ?";
    params.push(station);
  }

  const rows = await all(`
    SELECT
      o.id AS order_id,
      o.table_number,
      o.waiter_username,
      o.note,
      o.created_at,
      oi.id AS order_item_id,
      oi.menu_item_id,
      oi.name,
      oi.price,
      oi.quantity,
      oi.station,
      oi.status
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    ${where}
    ORDER BY o.id DESC, oi.id ASC
  `, params);

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.order_id)) {
      map.set(row.order_id, {
        id: row.order_id,
        table_number: row.table_number,
        waiter_username: row.waiter_username,
        note: row.note,
        created_at: row.created_at,
        items: []
      });
    }
    map.get(row.order_id).items.push({
      id: row.order_item_id,
      menu_item_id: row.menu_item_id,
      name: row.name,
      price: row.price,
      quantity: row.quantity,
      station: row.station,
      status: row.status
    });
  }
  res.json(Array.from(map.values()));
});

app.post("/api/orders", requireRole(["waiter"]), async (req, res) => {
  const { table_number, note, items } = req.body;
  if (!table_number || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Ungültige Bestellung" });
  }

  const filtered = items.filter(i => Number(i.quantity) > 0);
  if (filtered.length === 0) return res.status(400).json({ error: "Keine Artikel ausgewählt" });

  const createdAt = new Date().toISOString();
  const orderInsert = await run(
    `INSERT INTO orders (table_number, waiter_username, note, created_at) VALUES (?, ?, ?, ?)`,
    [Number(table_number), req.session.user.username, note || "", createdAt]
  );

  for (const item of filtered) {
    await run(
      `INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, station, status)
       VALUES (?, ?, ?, ?, ?, ?, 'neu')`,
      [orderInsert.lastID, item.id, item.name, Number(item.price || 0), Number(item.quantity), item.station]
    );
  }

  res.json({ ok: true, id: orderInsert.lastID });
});

app.patch("/api/order-items/:id/status", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!["neu", "in Arbeit", "fertig"].includes(status)) {
    return res.status(400).json({ error: "Ungültiger Status" });
  }
  await run(`UPDATE order_items SET status = ? WHERE id = ?`, [status, id]);
  res.json({ ok: true });
});

/* Admin APIs */
app.get("/api/admin/tables", requireAdmin, async (req, res) => {
  const row = await get(`SELECT value FROM settings WHERE key = 'table_count'`);
  res.json({ count: Number(row?.value || 50) });
});

app.post("/api/admin/tables", requireAdmin, async (req, res) => {
  const count = Number(req.body.count);
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    return res.status(400).json({ error: "Ungültige Tischzahl" });
  }
  await run(`UPDATE settings SET value = ? WHERE key = 'table_count'`, [String(count)]);
  res.json({ ok: true });
});

app.get("/api/admin/menu", requireAdmin, async (req, res) => {
  const rows = await all(`SELECT * FROM menu_items ORDER BY active DESC, station, name`);
  res.json(rows);
});

app.post("/api/admin/menu", requireAdmin, async (req, res) => {
  const { name, price, station } = req.body;
  if (!name || !station) return res.status(400).json({ error: "Fehlende Daten" });
  await run(
    `INSERT INTO menu_items (name, price, station, active) VALUES (?, ?, ?, 1)`,
    [name.trim(), Number(price || 0), station]
  );
  res.json({ ok: true });
});

app.patch("/api/admin/menu/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, station, active } = req.body;
  await run(
    `UPDATE menu_items SET name = ?, price = ?, station = ?, active = ? WHERE id = ?`,
    [name.trim(), Number(price || 0), station, active ? 1 : 0, id]
  );
  res.json({ ok: true });
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const rows = await all(`
    SELECT
      u.id,
      u.username,
      u.role,
      COALESCE(COUNT(DISTINCT o.id), 0) AS orders_count,
      COALESCE(ROUND(SUM(oi.quantity * oi.price), 2), 0) AS revenue
    FROM users u
    LEFT JOIN orders o ON o.waiter_username = u.username
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY u.id, u.username, u.role
    ORDER BY u.role, u.username
  `);
  res.json(rows);
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: "Fehlende Daten" });
  const hash = await bcrypt.hash(password, 10);
  try {
    await run(
      `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
      [username.trim(), hash, role]
    );
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(400).json({ error: "Benutzer existiert bereits" });
    }
    throw err;
  }
});

app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { username, password, role } = req.body;
  if (!id || !username || !role) return res.status(400).json({ error: "Fehlende Daten" });

  const current = await get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!current) return res.status(404).json({ error: "Benutzer nicht gefunden" });
  if (!["waiter", "kitchen", "drinks"].includes(role)) {
    return res.status(400).json({ error: "Ungültige Rolle" });
  }

  try {
    if (password && password.trim()) {
      const hash = await bcrypt.hash(password.trim(), 10);
      await run(
        `UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?`,
        [username.trim(), hash, role, id]
      );
    } else {
      await run(
        `UPDATE users SET username = ?, role = ? WHERE id = ?`,
        [username.trim(), role, id]
      );
    }

    if (current.username !== username.trim()) {
      await run(`UPDATE orders SET waiter_username = ? WHERE waiter_username = ?`, [username.trim(), current.username]);
    }

    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(400).json({ error: "Benutzername existiert bereits" });
    }
    throw err;
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const current = await get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!current) return res.status(404).json({ error: "Benutzer nicht gefunden" });
  if (current.role !== "waiter") {
    return res.status(400).json({ error: "Nur Kellner können gelöscht werden" });
  }

  await run(`DELETE FROM users WHERE id = ?`, [id]);
  res.json({ ok: true });
});

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  const rows = await all(`
    SELECT
      o.waiter_username,
      COUNT(DISTINCT o.id) AS orders_count,
      COALESCE(ROUND(SUM(oi.quantity * oi.price), 2), 0) AS revenue
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.waiter_username
    ORDER BY revenue DESC, orders_count DESC, o.waiter_username ASC
  `);
  res.json(rows);
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server läuft auf Port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("DB-Init fehlgeschlagen:", err);
    process.exit(1);
  });
