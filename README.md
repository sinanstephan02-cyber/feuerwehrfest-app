# Feuerwehrfest Bestell-App 2.0

Komplette Web-App fuer ein Fest mit 50 Tischen, Benutzerkonten, Kueche, Getraenke und extra Admin-Passwort.

## Funktionen

- 50 feste Tische als grosse Buttons
- Login pro Benutzer
- 30 vorbereitete Kellnerkonten
- Kuechenansicht
- Getraenkeansicht
- Live-Aktualisierung mit Socket.IO
- SQLite-Datenbank
- Status: neu, in Arbeit, fertig, geliefert
- Adminseite mit separatem Admin-Passwort
- Artikelverwaltung
- Benutzerverwaltung
- Kellner-Statistik

## Standard-Zugaenge nach dem ersten Start

- Kellner: `kellner01` bis `kellner30`
- Kueche: `kueche`
- Getraenke: `getraenke`
- Standard-Passwort fuer diese Konten: `feuerwehr123`

Wichtig: Bitte aendere die Passwoerter spaeter im Adminbereich.

## Separates Admin-Passwort

Standardmaessig ist im Projekt hinterlegt:

`BitteAdminPasswortAendern2026!`

Fuer den echten Einsatz solltest du das **nicht** so lassen, sondern beim Start als Umgebungsvariable setzen:

### Windows PowerShell

```powershell
$env:ADMIN_PASSWORD="DEIN_STARKES_ADMIN_PASSWORT"
$env:SESSION_SECRET="EIN_LANGES_ZUFAELLIGES_GEHEIMNIS"
npm start
```

## Software, die du brauchst

- Node.js
- Visual Studio Code
- Browser: Chrome, Edge oder Firefox

## Lokal starten

```bash
npm install
npm start
```

Dann im Browser:

- Login: http://localhost:3000/login
- Bestellung: http://localhost:3000
- Küche: http://localhost:3000/kitchen
- Getränke: http://localhost:3000/drinks
- Admin-Freigabe: http://localhost:3000/admin-login
- Admin: http://localhost:3000/admin

## Online mit mobilen Daten

Damit mehrere Handys ueber mobile Daten zugreifen koennen, muss die App auf einem oeffentlich erreichbaren Server laufen.

Geeignet sind zum Beispiel:

- Render
- Railway
- ein eigener VPS / Root-Server

## Projektstruktur

- `server.js` -> Server, Login, Rollen, API
- `db.js` -> Datenbank, Benutzer- und Menue-Initialisierung
- `public/login.html` -> normales Login
- `public/index.html` -> Bedienung
- `public/kitchen.html` -> Küche
- `public/drinks.html` -> Getränke
- `public/admin-login.html` -> extra Admin-Passwort
- `public/admin.html` -> Artikel, Benutzer, Statistik
