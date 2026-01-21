// Login simples (segurança básica)
// Troque as credenciais aqui:
const FIXED_USER = "admin";
const FIXED_PASS = "1234";

document.getElementById("btn").addEventListener("click", () => {
  const u = document.getElementById("user").value.trim();
  const p = document.getElementById("pass").value;

  if (u === FIXED_USER && p === FIXED_PASS) {
    sessionStorage.setItem("auth", "ok");
    window.location.href = "app.html";
    return;
  }

  document.getElementById("msg").textContent = "Usuário ou senha inválidos.";
});
