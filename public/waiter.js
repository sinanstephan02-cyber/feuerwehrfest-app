
let menuData = [];
let selectedTable = null;

function euro(v) {
  return Number(v || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

async function loadMe() {
  const res = await fetch("/api/me");
  const data = await res.json();
  if (!data.user) {
    window.location.href = "/login";
    return;
  }
  document.getElementById("who").textContent = data.user.username;
  document.getElementById("waiterName").textContent = data.user.username;
}

async function loadTables() {
  const res = await fetch("/api/tables");
  const data = await res.json();
  const wrap = document.getElementById("tables");
  wrap.innerHTML = "";
  for (let i = 1; i <= data.count; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "table-btn";
    btn.textContent = i;
    btn.addEventListener("click", () => {
      selectedTable = i;
      document.querySelectorAll(".table-btn").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("selectedTableLabel").textContent = i;
    });
    wrap.appendChild(btn);
  }
}

function updateTotal() {
  let total = 0;
  document.querySelectorAll(".qty-input").forEach(input => {
    const qty = Number(input.value || 0);
    const price = Number(input.dataset.price || 0);
    total += qty * price;
  });
  document.getElementById("total").textContent = euro(total);
}

async function loadMenu() {
  const res = await fetch("/api/menu");
  menuData = await res.json();
  const wrap = document.getElementById("menu");
  wrap.innerHTML = "";

  const groups = {
    kitchen: "Küche",
    drinks: "Getränke"
  };

  ["kitchen","drinks"].forEach(station => {
    const items = menuData.filter(i => i.station === station);
    if (!items.length) return;

    const heading = document.createElement("h3");
    heading.textContent = groups[station];
    wrap.appendChild(heading);

    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "menu-row";
      row.innerHTML = `
        <div>
          <strong>${item.name}</strong><br>
          <span class="muted small">${euro(item.price)} · ${groups[item.station]}</span>
        </div>
        <span class="pill">${groups[item.station]}</span>
        <input class="qty-input" type="number" min="0" value="0" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}" data-station="${item.station}">
      `;
      wrap.appendChild(row);
    });
  });

  document.querySelectorAll(".qty-input").forEach(i => i.addEventListener("input", updateTotal));
  updateTotal();
}

function showMessage(type, text) {
  const el = document.getElementById("message");
  el.className = `alert ${type}`;
  el.textContent = text;
}

document.getElementById("resetBtn")?.addEventListener("click", () => {
  selectedTable = null;
  document.getElementById("selectedTableLabel").textContent = "-";
  document.getElementById("note").value = "";
  document.querySelectorAll(".table-btn").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".qty-input").forEach(x => x.value = 0);
  updateTotal();
  showMessage("", "");
});

document.getElementById("submitBtn")?.addEventListener("click", async () => {
  if (!selectedTable) {
    showMessage("error", "Bitte zuerst einen Tisch auswählen.");
    return;
  }

  const items = [...document.querySelectorAll(".qty-input")]
    .map(input => ({
      id: Number(input.dataset.id),
      name: input.dataset.name,
      price: Number(input.dataset.price),
      station: input.dataset.station,
      quantity: Number(input.value || 0)
    }))
    .filter(item => item.quantity > 0);

  if (!items.length) {
    showMessage("error", "Bitte mindestens einen Artikel auswählen.");
    return;
  }

  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_number: selectedTable,
      note: document.getElementById("note").value,
      items
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showMessage("error", data.error || "Bestellung konnte nicht gesendet werden.");
    return;
  }

  document.getElementById("resetBtn").click();
  showMessage("success", `Bestellung #${data.id} wurde gesendet.`);
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  window.location.href = "/login";
});

loadMe();
loadTables();
loadMenu();
