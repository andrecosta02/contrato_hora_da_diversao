// Login simples (segurança básica)
// Troque as credenciais aqui:
const FIXED_USER = "horadadiversao";
const FIXED_PASS = "Contrato@2026";

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

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("pass");
const icon = togglePassword?.querySelector("i");

if (togglePassword && passwordInput && icon) {
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";
    icon.classList.toggle("bi-eye", !isPassword);
    icon.classList.toggle("bi-eye-slash", isPassword);
  });
}

