const btn = document.getElementById('adminLoginBtn');
const messageEl = document.getElementById('adminLoginMessage');

function showMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;
}

async function unlockAdmin() {
  const password = document.getElementById('password').value;
  const res = await fetch('/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();

  if (!res.ok) {
    showMessage(data.error || 'Freischalten fehlgeschlagen.');
    return;
  }

  window.location.href = data.redirectTo || '/admin';
}

btn.addEventListener('click', unlockAdmin);
document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') unlockAdmin();
});
