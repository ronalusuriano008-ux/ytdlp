import { setSession } from "./session.js";

const API_BASE = "";

export async function register(username, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      alert(data.error || "No se pudo registrar el usuario");
      return false;
    }

    setSession(data.user.username);
    return true;
  } catch (error) {
    console.error("Error en register:", error);
    alert("Error de conexión al registrar");
    return false;
  }
}

export async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      alert(data.error || "No se pudo iniciar sesión");
      return false;
    }

    setSession(data.user.username);
    return true;
  } catch (error) {
    console.error("Error en login:", error);
    alert("Error de conexión al iniciar sesión");
    return false;
  }
}