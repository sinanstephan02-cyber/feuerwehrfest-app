
async function loadAll() {
  const meRes = await fetch("/api/me");
  const me = await meRes.json();
  if (!me.isAdmin) {
    window.location.href = "/admin-login";
    return;
  }

  const tables = await (await fetch("/api/admin/tables")).json();
  document.getElementById("tableCount").value = tables.count;

  const users = await (await fetch("/api/admin/users")).json();
  document.getElementById("usersTable").innerHTML = users.map(u => `
    <tr>
      <td>${u.username}</td>
      <td>${u.role === "waiter" ? "Kellner" : u.role === "kitchen" ? "Küche" : "Getränke"}</td>
      <td>${u.orders_count || 0}</td>
      <td>${Number(u.revenue || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
      <td>
        <button class="secondary edit-user-btn" type="button" data-id="${u.id}" data-username="${u.username}" data-role="${u.role}">Bearbeiten</button>
        ${u.role === "waiter" ? `<button class="secondary delete-user-btn" type="button" data-id="${u.id}" data-username="${u.username}">Löschen</button>` : ""}
      </td>
    </tr>
  `).join("");

  const stats = await (await fetch("/api/admin/stats")).json();
  document.getElementById("statsTable").innerHTML = stats.map(s => `
    <tr><td>${s.waiter_username}</td><td>${s.orders_count}</td><td>${Number(s.revenue || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td></tr>
  `).join("");

  const menu = await (await fetch("/api/admin/menu")).json();
  document.getElementById("menuTable").innerHTML = menu.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${Number(item.price).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</td>
      <td>${item.station === "drinks" ? "Getränke" : "Küche"}</td>
      <td>${item.active ? "Ja" : "Nein"}</td>
      <td><button class="secondary" type="button" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}" data-station="${item.station}" data-active="${item.active}">Bearbeiten</button></td>
    </tr>
  `).join("");

  document.querySelectorAll("#menuTable button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const name = prompt("Name", btn.dataset.name);
      if (!name) return;
      const price = prompt("Preis", btn.dataset.price);
      if (price === null) return;
      const station = prompt("Bereich: kitchen oder drinks", btn.dataset.station);
      if (!station) return;
      const active = confirm("Artikel aktiv lassen? OK = aktiv, Abbrechen = inaktiv");

      await fetch(`/api/admin/menu/${btn.dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, station, active })
      });
      loadAll();
    });
  });


  document.querySelectorAll(".edit-user-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const username = prompt("Neuer Benutzername", btn.dataset.username);
      if (!username) return;
      const role = prompt("Rolle: waiter, kitchen oder drinks", btn.dataset.role);
      if (!role) return;
      const password = prompt("Neues Passwort (leer lassen = altes Passwort behalten)", "");

      const res = await fetch(`/api/admin/users/${btn.dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return show("userMsg", "error", data.error || "Benutzer konnte nicht geändert werden.");
      show("userMsg", "success", "Benutzer geändert.");
      loadAll();
    });
  });

  document.querySelectorAll(".delete-user-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Kellner ${btn.dataset.username} wirklich löschen?`)) return;
      const res = await fetch(`/api/admin/users/${btn.dataset.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return show("userMsg", "error", data.error || "Benutzer konnte nicht gelöscht werden.");
      show("userMsg", "success", "Kellner gelöscht.");
      loadAll();
    });
  });
}

function show(id, type, text) {
  const el = document.getElementById(id);
  el.className = `alert ${type}`;
  el.textContent = text;
}

document.getElementById("saveTablesBtn")?.addEventListener("click", async () => {
  const count = Number(document.getElementById("tableCount").value);
  const res = await fetch("/api/admin/tables", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count })
  });
  if (!res.ok) return show("tableMsg", "error", "Tischzahl konnte nicht gespeichert werden.");
  show("tableMsg", "success", "Tischzahl gespeichert.");
});

document.getElementById("saveUserBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newPassword").value;
  const role = document.getElementById("newRole").value;

  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return show("userMsg", "error", data.error || "Benutzer konnte nicht gespeichert werden.");
  show("userMsg", "success", "Benutzer gespeichert.");
  document.getElementById("newUsername").value = "";
  document.getElementById("newPassword").value = "";
  loadAll();
});

document.getElementById("saveItemBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("itemName").value.trim();
  const price = document.getElementById("itemPrice").value;
  const station = document.getElementById("itemStation").value;

  const res = await fetch("/api/admin/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, station })
  });
  if (!res.ok) return show("itemMsg", "error", "Artikel konnte nicht gespeichert werden.");
  show("itemMsg", "success", "Artikel angelegt.");
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  loadAll();
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/admin-logout", { method: "POST" });
  window.location.href = "/admin-login";
});

loadAll();
