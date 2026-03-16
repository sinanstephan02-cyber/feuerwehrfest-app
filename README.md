# Feuerwehrfest App – saubere Version A

## Funktionen
- 50 Tische standardmäßig
- Kellner-Login (`kellner01` bis `kellner30`)
- Küche-Login (`kueche`)
- Getränke-Login (`getraenke`)
- Admin mit separatem Passwort
- Artikelverwaltung
- variable Tischzahl im Admin
- Bestellungen getrennt für Küche und Getränke
- Render-tauglich

## Standard-Logins
- Kellner: `kellner01` bis `kellner30`
- Küche: `kueche`
- Getränke: `getraenke`
- Passwort für diese Logins: `feuerwehr123`

## Admin
Admin läuft **nicht** über den normalen Login.

Admin-Login:
`/admin-login`

Standard Admin-Passwort:
`BitteUnbedingtAendern2026!`

Für Render bitte besser als Environment Variable setzen:
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## Lokal starten
```bash
npm install
npm start
```

Dann öffnen:
- `http://localhost:3000/login`
- `http://localhost:3000/kitchen`
- `http://localhost:3000/drinks`
- `http://localhost:3000/admin-login`

## Render
- Start Command: `npm start`
- Build Command: `npm install`

## Wichtiger Hinweis
Diese Version erstellt `data.db` beim ersten Start selbst.
Wenn du alte Fehler vermeiden willst, lösche auf GitHub die alte `data.db`, bevor du diese Version hochlädst.