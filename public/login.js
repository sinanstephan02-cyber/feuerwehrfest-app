const btn = document.getElementById('loginBtn');
const messageEl = document.getElementById('loginMessage');

function showMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;
}

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (!res.ok) {
    showMessage(data.error || 'Login fehlgeschlagen.');
    return;
  }

  window.location.href = data.redirectTo || '/';
}

btn.addEventListener('click', login);
document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});
