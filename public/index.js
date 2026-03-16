const socket = io();
const tableGrid = document.getElementById('tableGrid');
const menuContainer = document.getElementById('menuContainer');
const totalPriceEl = document.getElementById('totalPrice');
const messageEl = document.getElementById('message');
const submitOrderBtn = document.getElementById('submitOrderBtn');
const resetBtn = document.getElementById('resetBtn');
const selectedTableValue = document.getElementById('selectedTableValue');
const currentWaiterEl = document.getElementById('currentWaiter');

let selectedTable = null;
let menuItems = [];
let sessionUser = null;

function showMessage(text, type = 'success') {
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;
}

function clearMessage() {
  messageEl.className = 'message';
  messageEl.textContent = '';
}

function renderTables() {
  tableGrid.innerHTML = '';
  for (let i = 1; i <= 50; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `table-btn ${selectedTable === i ? 'active' : ''}`;
    btn.textContent = `Tisch ${i}`;
    btn.addEventListener('click', () => {
      selectedTable = i;
      selectedTableValue.textContent = `Tisch ${i}`;
      renderTables();
      clearMessage();
    });
    tableGrid.appendChild(btn);
  }
}

function calculateTotal() {
  const total = menuItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.price)), 0);
  totalPriceEl.textContent = euro(total);
}

function renderMenu() {
  const grouped = menuItems.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  menuContainer.innerHTML = '';

  Object.keys(grouped).forEach(category => {
    const block = document.createElement('div');
    block.className = 'category-block';
    block.innerHTML = `<h3>${category === 'Kueche' ? 'Küche' : 'Getränke'}</h3>`;

    grouped[category].forEach(item => {
      const row = document.createElement('div');
      row.className = 'menu-item';
      row.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <div class="small">${category === 'Kueche' ? 'Küche' : 'Getränke'}</div>
        </div>
        <div class="price">${euro(item.price)}</div>
        <input class="qty-input" type="number" min="0" value="${item.quantity || 0}" data-id="${item.id}" />
      `;
      block.appendChild(row);
    });

    menuContainer.appendChild(block);
  });

  menuContainer.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('input', event => {
      const id = Number(event.target.dataset.id);
      const item = menuItems.find(entry => entry.id === id);
      item.quantity = Math.max(0, Number(event.target.value || 0));
      calculateTotal();
      clearMessage();
    });
  });

  calculateTotal();
}

async function loadMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  menuItems = data.map(item => ({ ...item, quantity: 0 }));
  renderMenu();
}

function resetForm() {
  selectedTable = null;
  selectedTableValue.textContent = '-';
  document.getElementById('note').value = '';
  menuItems = menuItems.map(item => ({ ...item, quantity: 0 }));
  renderTables();
  renderMenu();
  clearMessage();
}

async function submitOrder() {
  const note = document.getElementById('note').value.trim();
  const items = menuItems.filter(item => item.quantity > 0).map(item => ({ id: item.id, quantity: item.quantity }));

  if (!selectedTable) {
    showMessage('Bitte zuerst einen Tisch auswählen.', 'error');
    return;
  }

  if (items.length === 0) {
    showMessage('Bitte mindestens einen Artikel auswählen.', 'error');
    return;
  }

  submitOrderBtn.disabled = true;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber: selectedTable, note, items })
    });

    const data = await res.json();
    if (!res.ok) {
      showMessage(data.error || 'Bestellung konnte nicht gesendet werden.', 'error');
      return;
    }

    showMessage(`Bestellung für Tisch ${selectedTable} erfolgreich gesendet.`, 'success');
    resetForm();
  } catch (error) {
    showMessage('Netzwerkfehler beim Senden. Bitte Verbindung prüfen.', 'error');
  } finally {
    submitOrderBtn.disabled = false;
  }
}

async function init() {
  bindLogout();
  const session = await fetchSession();
  sessionUser = session.user;
  currentWaiterEl.textContent = sessionUser?.displayName || '-';
  updateUserBar(`Angemeldet als ${sessionUser?.displayName || '-'} (${sessionUser?.username || '-'})`);
  renderTables();
  await loadMenu();
}

resetBtn.addEventListener('click', resetForm);
submitOrderBtn.addEventListener('click', submitOrder);
socket.on('menu-updated', loadMenu);

init();
