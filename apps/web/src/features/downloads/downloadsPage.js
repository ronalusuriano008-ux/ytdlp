import { getSession } from "../../core/auth/session.js";

export async function saveDownload(title, url, type) {
  const username = getSession();
  if (!username) return;

  try {
    const response = await fetch("/user/downloads/add", {
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

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error guardando descarga:", data.error || "Error desconocido");
    }
  } catch (error) {
    console.error("Error de red guardando descarga:", error);
  }
}

export async function getDownloads() {
  const username = getSession();
  if (!username) return;

  const container = document.getElementById("downloads");
  if (!container) return;

  container.innerHTML = "<p>Cargando descargas...</p>";

  try {
    const response = await fetch(`/user/downloads/${encodeURIComponent(username)}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      container.innerHTML = `<p style="color:red;">${data.error || "Error cargando descargas"}</p>`;
      return;
    }

    const downloads = data.downloads || [];
    container.innerHTML = "";

    if (downloads.length === 0) {
      container.innerHTML = "<p>No hay descargas guardadas.</p>";
      return;
    }

    downloads.forEach(file => {
      const div = document.createElement("div");
      div.className = "item";

      div.innerHTML = `
        <div>
          <strong>${file.title}</strong>
          <p>Tipo: ${file.type}</p>
        </div>
        <button type="button">Reproducir</button>
      `;

      const btn = div.querySelector("button");
      btn.addEventListener("click", () => {
        window.open(file.url, "_blank");
      });

      container.appendChild(div);
    });
  } catch (error) {
    console.error("Error obteniendo descargas:", error);
    container.innerHTML = "<p style='color:red;'>Error de conexión cargando descargas</p>";
  }
}

getDownloads();