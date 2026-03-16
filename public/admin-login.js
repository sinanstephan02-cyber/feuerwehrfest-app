
const form = document.getElementById("adminLoginForm");
const message = document.getElementById("message");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.className = "alert";
  message.textContent = "";

  const password = document.getElementById("password").value;

  const res = await fetch("/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    message.className = "alert error";
    message.textContent = data.error || "Anmeldung fehlgeschlagen";
    return;
  }

  window.location.href = data.redirectTo;
});
