
const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.className = "alert";
  message.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    message.className = "alert error";
    message.textContent = data.error || "Login fehlgeschlagen";
    return;
  }

  window.location.href = data.redirectTo;
});
