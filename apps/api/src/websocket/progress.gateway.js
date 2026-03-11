const WebSocket = require("ws");

let wss;

function init(server) {
  wss = new WebSocket.Server({ server });

  wss.on("connection", ws => {
    console.log("Cliente WebSocket conectado");
    ws.on("close", () => console.log("Cliente desconectado"));
  });
}

function broadcast(data) {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

module.exports = { init, broadcast };
