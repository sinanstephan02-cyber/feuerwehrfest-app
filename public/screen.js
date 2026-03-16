function initScreen({ targetCategory, allowDelivered }) {
  const socket = io();
  const ordersEl = document.getElementById('orders');
  const statsEl = document.getElementById('stats');
  const filterButtons = document.querySelectorAll('[data-filter]');

  let currentFilter = 'offen';
  let currentOrders = [];

  function formatStatusClass(status) {
    if (status === 'in Arbeit') return 'status-inArbeit';
    return `status-${status}`;
  }

  function statusBadge(status) {
    if (status === 'in Arbeit') {
      return '<span class="badge inarbeit">in Arbeit</span>';
    }
    return `<span class="badge ${status}">${status}</span>`;
  }

  function filteredOrders() {
    const withCategory = currentOrders
      .map(order => ({
        ...order,
        items: order.items.filter(item => item.category === targetCategory)
      }))
      .filter(order => order.items.length > 0);

    if (currentFilter === 'offen') {
      return withCategory.filter(order => ['neu', 'in Arbeit'].includes(order.status));
    }
    if (currentFilter === 'fertig') {
      return withCategory.filter(order => order.status === 'fertig');
    }
    return withCategory;
  }

  async function updateStatus(orderId, status) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  }

  window.updateStatus = updateStatus;

  function renderOrders() {
    const orders = filteredOrders();

    if (orders.length === 0) {
      ordersEl.innerHTML = '<div class="center-empty">Keine passenden Bestellungen vorhanden.</div>';
      return;
    }

    ordersEl.innerHTML = orders.map(order => {
      const subtotal = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
      return `
        <div class="order-card ${formatStatusClass(order.status)}">
          <div class="order-header">
            <div>
              <h2>Tisch ${order.tableNumber}</h2>
              <div class="small">Bestellung #${order.id} · ${new Date(order.createdAt).toLocaleTimeString('de-DE')}</div>
            </div>
            <div>${statusBadge(order.status)}</div>
          </div>
          <p><strong>Bedienung:</strong> ${order.waiter || '-'}</p>
          <ul class="item-list">
            ${order.items.map(item => `<li>${item.quantity}x ${item.name} · ${euro(item.lineTotal)}</li>`).join('')}
          </ul>
          <p><strong>Bereichssumme:</strong> ${euro(subtotal)}</p>
          <p><strong>Notiz:</strong> ${order.note || '-'}</p>
          <div class="actions">
            <button class="btn-warn" onclick="updateStatus(${order.id}, 'in Arbeit')">In Arbeit</button>
            <button class="btn-success" onclick="updateStatus(${order.id}, 'fertig')">Fertig</button>
            ${allowDelivered ? `<button class="btn-info" onclick="updateStatus(${order.id}, 'geliefert')">Geliefert</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadStats() {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    statsEl.innerHTML = `
      <div class="kpi"><div class="small">Gesamtbestellungen</div><div class="kpi-value">${stats.totalOrders}</div></div>
      <div class="kpi"><div class="small">Offen</div><div class="kpi-value">${stats.openOrders}</div></div>
      <div class="kpi"><div class="small">Fertig</div><div class="kpi-value">${stats.finishedOrders}</div></div>
      <div class="kpi"><div class="small">Umsatz</div><div class="kpi-value">${euro(stats.revenue)}</div></div>
    `;
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      renderOrders();
    });
  });

  socket.on('orders-updated', orders => {
    currentOrders = orders;
    renderOrders();
    loadStats();
  });

  fetchSession().then(session => {
    updateUserBar(`Angemeldet als ${session.user?.displayName || '-'} (${session.user?.username || '-'})`);
  });
  bindLogout();
  loadStats();
}
