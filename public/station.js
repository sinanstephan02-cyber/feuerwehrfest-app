
const station = location.pathname.includes("drinks") ? "drinks" : "kitchen";
const groupTitle = station === "drinks" ? "Getränke" : "Küche";

async function loadMe() {
  const res = await fetch("/api/me");
  const data = await res.json();
  if (!data.user) {
    window.location.href = "/login";
    return;
  }
  document.getElementById("who").textContent = data.user.username;
}

function statusClass(status) {
  if (status === "in Arbeit") return "status-inarbeit";
  if (status === "fertig") return "status-fertig";
  return "status-neu";
}

async function setStatus(id, status) {
  await fetch(`/api/order-items/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  loadOrders();
}

async function loadOrders() {
  const res = await fetch(`/api/orders?station=${station}`);
  const orders = await res.json();
  const wrap = document.getElementById("orders");
  wrap.innerHTML = "";

  if (!orders.length) {
    wrap.innerHTML = `<div class="card"><p>Keine ${groupTitle.toLowerCase()}-Bestellungen vorhanden.</p></div>`;
    return;
  }

  orders.forEach(order => {
    const card = document.createElement("div");
    card.className = "order";
    card.innerHTML = `
      <div class="order-head">
        <div>
          <h2>Tisch ${order.table_number}</h2>
          <p class="small muted">Bedienung: ${order.waiter_username}</p>
          <p class="small muted">Zeit: ${new Date(order.created_at).toLocaleString("de-DE")}</p>
          <p class="small">${order.note ? "Notiz: " + order.note : ""}</p>
        </div>
      </div>
    `;

    order.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <strong>${item.quantity} × ${item.name}</strong>
            <div class="small muted">${item.station === "drinks" ? "Getränke" : "Küche"}</div>
          </div>
          <div>
            <span class="status ${statusClass(item.status)}">${item.status}</span>
          </div>
        </div>
        <div class="actions">
          <button class="neutral" type="button">neu</button>
          <button class="warn" type="button">in Arbeit</button>
          <button class="success" type="button">fertig</button>
        </div>
      `;
      const buttons = row.querySelectorAll("button");
      buttons[0].addEventListener("click", () => setStatus(item.id, "neu"));
      buttons[1].addEventListener("click", () => setStatus(item.id, "in Arbeit"));
      buttons[2].addEventListener("click", () => setStatus(item.id, "fertig"));
      card.appendChild(row);
    });

    wrap.appendChild(card);
  });
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  window.location.href = "/login";
});

loadMe();
loadOrders();
setInterval(loadOrders, 4000);
