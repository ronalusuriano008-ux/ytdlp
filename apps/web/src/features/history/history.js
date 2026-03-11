import { getSession } from "../../core/auth/session.js";

export async function addHistory(title, url, type = "video") {

  const session = getSession();
  const username = session?.user || session;

  console.log("📦 addHistory() llamado");
  console.log("SESSION:", session);
  console.log("USERNAME RESUELTO:", username);
  console.log("DATOS A GUARDAR:", { title, url, type });

  if (!username) {
    console.warn("⚠️ No hay username en sesión, no se guardará historial");
    return false;
  }

  try {

    console.log("➡️ Enviando POST /user/history/add");

    const response = await fetch("/user/history/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        title,
        url,
        type
      })
    });

    console.log("📡 STATUS RESPONSE:", response.status);

    const data = await response.json();

    console.log("📥 RESPUESTA DEL SERVIDOR:", data);

    if (!response.ok || !data.ok) {
      console.error("❌ Error guardando historial:", data.error || "Error desconocido");
      return false;
    }

    console.log("✅ Historial guardado correctamente");

    return true;

  } catch (error) {

    console.error("❌ Error de red guardando historial:", error);
    return false;

  }
}

export async function getHistory() {

  const session = getSession();
  const username = session?.user || session;

  console.log("📦 getHistory() llamado");
  console.log("SESSION:", session);
  console.log("USERNAME RESUELTO:", username);

  if (!username) {
    console.warn("⚠️ No hay username en sesión, historial vacío");
    return [];
  }

  try {

    console.log(`➡️ Solicitando historial: /user/history/${username}`);

    const response = await fetch(`/user/history/${encodeURIComponent(username)}`);

    console.log("📡 STATUS RESPONSE:", response.status);

    const data = await response.json();

    console.log("📥 RESPUESTA HISTORIAL:", data);

    if (!response.ok || !data.ok) {
      console.error("❌ Error obteniendo historial:", data.error || "Error desconocido");
      return [];
    }

    const history = Array.isArray(data.history) ? data.history : [];

    console.log("📚 HISTORIAL RECIBIDO:", history);

    return history;

  } catch (error) {

    console.error("❌ Error de red obteniendo historial:", error);
    return [];

  }
}