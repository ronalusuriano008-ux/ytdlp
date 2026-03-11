let socket;

export function initWebSocket() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocol}://${location.host}`;

  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    console.log("🔌 WebSocket conectado");
  });

  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.progress !== undefined) {
        // 🔥 Emitimos evento personalizado
        document.dispatchEvent(
          new CustomEvent("downloadProgress", {
            detail: data.progress
          })
        );
      }

    } catch (err) {
      console.error("Error parseando mensaje WS:", err);
    }
  });

  socket.addEventListener("close", () => {
    console.log("❌ WebSocket desconectado");
  });

  socket.addEventListener("error", (err) => {
    console.error("🚨 Error WebSocket:", err);
  });
}

export function getSocket() {
  return socket;
}