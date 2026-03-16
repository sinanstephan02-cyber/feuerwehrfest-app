const socket = io();
const bodyEl = document.getElementById('menuTableBody');
const usersBodyEl = document.getElementById('usersTableBody');
const waiterStatsBody = document.getElementById('waiterStatsBody');
const messageEl = document.getElementById('adminMessage');
const addItemBtn = document.getElementById('addItemBtn');
const addUserBtn = document.getElementById('addUserBtn');

function euroInput(value) {
  return Number(value).toFixed(2);
}

function showAdminMessage(text, type = 'success') {
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;
}

async function loadAdminMenu() {
  const res = await fetch('/api/admin/menu');
  const items = await res.json();
  bodyEl.innerHTML = items.map(item => `
    <tr>
      <td><input type="text" value="${item.name}" data-field="name" data-id="${item.id}" /></td>
      <td>
        <select data-field="category" data-id="${item.id}">
          <option value="Kueche" ${item.category === 'Kueche' ? 'selected' : ''}>Küche</option>
          <option value="Getraenke" ${item.category === 'Getraenke' ? 'selected' : ''}>Getränke</option>
        </select>
      </td>
      <td><input type="number" step="0.01" min="0" value="${euroInput(item.price)}" data-field="price" data-id="${item.id}" /></td>
      <td><input type="checkbox" ${item.isActive ? 'checked' : ''} data-field="isActive" data-id="${item.id}" /></td>
      <td><button class="btn-secondary" onclick="saveRow(${item.id})">Speichern</button></td>
    </tr>
  `).join('');
}

async function loadUsers() {
  const res = await fetch('/api/admin/users');
  const users = await res.json();
  usersBodyEl.innerHTML = users.map(user => `
    <tr>
      <td>${user.username}</td>
      <td><input type="text" value="${user.displayName}" data-user-field="displayName" data-user-id="${user.id}" /></td>
      <td>
        <select data-user-field="role" data-user-id="${user.id}">
          <option value="waiter" ${user.role === 'waiter' ? 'selected' : ''}>Kellner</option>
          <option value="kitchen" ${user.role === 'kitchen' ? 'selected' : ''}>Küche</option>
          <option value="drinks" ${user.role === 'drinks' ? 'selected' : ''}>Getränke</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td><input type="checkbox" ${user.isActive ? 'checked' : ''} data-user-field="isActive" data-user-id="${user.id}" /></td>
      <td><input type="text" placeholder="leer lassen = unverändert" data-user-field="password" data-user-id="${user.id}" /></td>
      <td><button class="btn-secondary" onclick="saveUserRow(${user.id})">Speichern</button></td>
    </tr>
  `).join('');
}

async function loadWaiterStats() {
  const res = await fetch('/api/admin/waiter-stats');
  const rows = await res.json();
  waiterStatsBody.innerHTML = rows.map(row => `
    <tr>
      <td>${row.waiter}</td>
      <td>${row.totalOrders}</td>
      <td>${euro(row.revenue)}</td>
    </tr>
  `).join('') || '<tr><td colspan="3">Noch keine Bestellungen vorhanden.</td></tr>';
}

async function saveRow(id) {
  const getField = field => document.querySelector(`[data-id="${id}"][data-field="${field}"]`);
  const payload = {
    name: getField('name').value.trim(),
    category: getField('category').value,
    price: Number(getField('price').value),
    isActive: getField('isActive').checked
  };

  const res = await fetch(`/api/admin/menu/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (!res.ok) {
    showAdminMessage(data.error || 'Speichern fehlgeschlagen.', 'error');
    return;
  }

  showAdminMessage(`Artikel „${data.name}“ gespeichert.`, 'success');
  loadAdminMenu();
}

async function saveUserRow(id) {
  const getField = field => document.querySelector(`[data-user-id="${id}"][data-user-field="${field}"]`);
  const payload = {
    displayName: getField('displayName').value.trim(),
    role: getField('role').value,
    isActive: getField('isActive').checked,
    password: getField('password').value.trim()
  };

  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (!res.ok) {
    showAdminMessage(data.error || 'Benutzer konnte nicht gespeichert werden.', 'error');
    return;
  }

  showAdminMessage(`Benutzer „${data.username}“ gespeichert.`, 'success');
  loadUsers();
}

window.saveRow = saveRow;
window.saveUserRow = saveUserRow;

addItemBtn.addEventListener('click', async () => {
  const name = document.getElementById('newName').value.trim();
  const category = document.getElementById('newCategory').value;
  const price = Number(document.getElementById('newPrice').value);

  if (!name || Number.isNaN(price)) {
    showAdminMessage('Bitte Name und Preis angeben.', 'error');
    return;
  }

  const res = await fetch('/api/admin/menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category, price })
  });
  const data = await res.json();

  if (!res.ok) {
    showAdminMessage(data.error || 'Artikel konnte nicht angelegt werden.', 'error');
    return;
  }

  document.getElementById('newName').value = '';
  document.getElementById('newPrice').value = '';
  showAdminMessage(`Artikel „${data.name}“ angelegt.`, 'success');
  loadAdminMenu();
});

addUserBtn.addEventListener('click', async () => {
  const username = document.getElementById('newUsername').value.trim();
  const displayName = document.getElementById('newDisplayName').value.trim();
  const role = document.getElementById('newUserRole').value;
  const password = document.getElementById('newUserPassword').value.trim();

  if (!username || !password) {
    showAdminMessage('Bitte Benutzername und Passwort angeben.', 'error');
    return;
  }

  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, displayName, role, password })
  });
  const data = await res.json();

  if (!res.ok) {
    showAdminMessage(data.error || 'Benutzer konnte nicht angelegt werden.', 'error');
    return;
  }

  document.getElementById('newUsername').value = '';
  document.getElementById('newDisplayName').value = '';
  document.getElementById('newUserPassword').value = '';
  showAdminMessage(`Benutzer „${data.username}“ angelegt.`, 'success');
  loadUsers();
});

async function init() {
  bindLogout();
  const session = await fetchSession();
  updateUserBar(`Freigeschaltet als ${session.user?.displayName || '-'} (${session.user?.username || '-'})`);
  await Promise.all([loadAdminMenu(), loadUsers(), loadWaiterStats()]);
}

socket.on('menu-updated', loadAdminMenu);
socket.on('orders-updated', loadWaiterStats);
init();
