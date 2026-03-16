function euro(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

async function fetchSession() {
  const res = await fetch('/api/session');
  return res.json();
}

async function logout() {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/login';
}

function bindLogout() {
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', logout);
}

function updateUserBar(text) {
  const userBar = document.getElementById('userBar');
  if (userBar) userBar.textContent = text;
}
