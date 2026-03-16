
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database("./data.db");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "feuerwehr-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  })
);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      role TEXT,
      active INTEGER DEFAULT 1
    )
  `);
});

async function seedUsers() {
  const passwordHash = await bcrypt.hash("feuerwehr123", 10);

  const users = [
    ["kueche", "kitchen"],
    ["getraenke", "drinks"]
  ];

  for (let i = 1; i <= 30; i++) {
    users.push([`kellner${String(i).padStart(2, "0")}`, "waiter"]);
  }

  users.forEach(([username, role]) => {
    db.run(
      `INSERT OR IGNORE INTO users (username, password_hash, role, active)
       VALUES (?, ?, ?, 1)`,
      [username, passwordHash, role]
    );
  });
}

seedUsers();

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Login</title>
        <style>
          body { font-family: Arial; max-width: 420px; margin: 40px auto; padding: 20px; }
          input, button { width: 100%; padding: 12px; margin: 8px 0; font-size: 16px; }
        </style>
      </head>
      <body>
        <h1>Feuerwehrfest Login</h1>
        <form method="POST" action="/login">
          <input name="username" placeholder="Benutzername" required />
          <input name="password" type="password" placeholder="Passwort" required />
          <button type="submit">Anmelden</button>
        </form>
      </body>
    </html>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ? AND active = 1",
    [username],
    async (err, user) => {
      if (err) return res.status(500).send("Serverfehler");
      if (!user) return res.status(401).send("Login fehlgeschlagen");

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).send("Login fehlgeschlagen");

      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      if (user.role === "kitchen") return res.redirect("/kitchen");
      if (user.role === "drinks") return res.redirect("/drinks");
      return res.redirect("/waiter");
    }
  );
});

app.get("/waiter", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.send(`<h1>Angemeldet als ${req.session.user.username}</h1><p>Kellnerbereich läuft.</p>`);
});

app.get("/kitchen", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.send(`<h1>Küche</h1><p>Angemeldet als ${req.session.user.username}</p>`);
});

app.get("/drinks", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.send(`<h1>Getränke</h1><p>Angemeldet als ${req.session.user.username}</p>`);
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
