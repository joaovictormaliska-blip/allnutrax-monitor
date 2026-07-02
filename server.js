// ============================================================
// AllNutrax — Servidor de Monitoramento + Chat ao Vivo
// ============================================================
// O que este arquivo faz, em português claro:
// 1) Sobe um servidor web (Express) que serve os arquivos da pasta /public
// 2) Abre um "canal ao vivo" (Socket.io) entre navegador <-> servidor
// 3) Guarda em memória quem está online agora (visitantes) e o total de acessos
// 4) Permite que o admin (você) converse em tempo real com qualquer visitante
// ============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve tudo que estiver dentro da pasta /public como arquivo estático
// (ou seja: seu HTML, CSS, JS do site e do painel admin)
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------
// "Banco de dados" em memória (simples, reinicia se o servidor reiniciar)
// Depois eu te mostro como trocar isso por um arquivo/banco real se quiser.
// ------------------------------------------------------------
const visitors = new Map(); // socket.id -> { id, ip, page, joinedAt, name, history: [] }
const adminSockets = new Set(); // sockets conectados como admin

let totalAccessesAllTime = 0; // contador histórico de acessos desde que o servidor ligou

// Gera um "nome curto" tipo #A1B2 pra identificar visitante sem mostrar o IP todo pro admin na lista
function shortId() {
  return crypto.randomBytes(2).toString("hex").toUpperCase();
}

// Pega o IP real do visitante (considera proxies tipo Render/Vercel/Nginx)
function getClientIp(socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return socket.handshake.address;
}

// Envia pra TODOS os admins conectados a lista atualizada de visitantes online
function broadcastVisitorsToAdmins() {
  const list = Array.from(visitors.values()).map((v) => ({
    id: v.id,
    socketId: v.socketId,
    ip: v.ip,
    page: v.page,
    joinedAt: v.joinedAt,
    unread: v.unread || 0,
  }));

  const payload = {
    online: list.length,
    totalAccesses: totalAccessesAllTime,
    visitors: list,
  };

  adminSockets.forEach((adminSocketId) => {
    io.to(adminSocketId).emit("stats:update", payload);
  });
}

io.on("connection", (socket) => {
  // O cliente (navegador) precisa dizer quem ele é assim que conecta:
  // ou é um "visitante" navegando na loja, ou é o "admin" abrindo o painel.

  socket.on("identify:visitor", (data) => {
    const ip = getClientIp(socket);
    totalAccessesAllTime += 1;

    const visitor = {
      id: shortId(),
      socketId: socket.id,
      ip,
      page: (data && data.page) || "/",
      joinedAt: new Date().toISOString(),
      unread: 0,
      history: [], // guarda o histórico de mensagens dessa visita
    };

    visitors.set(socket.id, visitor);
    broadcastVisitorsToAdmins();
  });

  socket.on("identify:admin", () => {
    adminSockets.add(socket.id);
    socket.join("admins");
    // Assim que o admin entra, já manda o estado atual pra ele
    broadcastVisitorsToAdmins();
  });

  // Visitante mudou de página (ex: foi da home pro produto de whey)
  socket.on("visitor:pageChange", (data) => {
    const v = visitors.get(socket.id);
    if (!v) return;
    v.page = (data && data.page) || v.page;
    broadcastVisitorsToAdmins();
  });

  // Visitante enviou uma mensagem no chat
  socket.on("visitor:message", (data) => {
    const v = visitors.get(socket.id);
    if (!v || !data || !data.text) return;

    const msg = { from: "visitor", text: String(data.text).slice(0, 1000), at: new Date().toISOString() };
    v.history.push(msg);
    v.unread = (v.unread || 0) + 1;

    // Manda a mensagem pra todos os admins, identificando de qual visitante veio
    adminSockets.forEach((adminSocketId) => {
      io.to(adminSocketId).emit("chat:incoming", { visitorId: v.id, socketId: v.socketId, ...msg });
    });

    broadcastVisitorsToAdmins();
  });

  // Admin enviou uma mensagem para um visitante específico
  socket.on("admin:message", (data) => {
    if (!adminSockets.has(socket.id)) return; // segurança básica
    if (!data || !data.socketId || !data.text) return;

    const v = visitors.get(data.socketId);
    if (!v) return; // visitante pode ter saído do site

    const msg = { from: "admin", text: String(data.text).slice(0, 1000), at: new Date().toISOString() };
    v.history.push(msg);
    v.unread = 0;

    // Entrega a mensagem só pro navegador daquele visitante específico
    io.to(v.socketId).emit("chat:incoming", msg);
    broadcastVisitorsToAdmins();
  });

  // Admin pede o histórico de conversa de um visitante (ao clicar nele na lista)
  socket.on("admin:getHistory", (data) => {
    if (!adminSockets.has(socket.id)) return;
    const v = visitors.get(data && data.socketId);
    if (!v) return;
    v.unread = 0;
    socket.emit("chat:history", { socketId: v.socketId, history: v.history });
    broadcastVisitorsToAdmins();
  });

  socket.on("disconnect", () => {
    if (visitors.has(socket.id)) {
      visitors.delete(socket.id);
      broadcastVisitorsToAdmins();
    }
    if (adminSockets.has(socket.id)) {
      adminSockets.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`AllNutrax Monitor rodando em http://localhost:${PORT}`);
  console.log(`Painel admin: http://localhost:${PORT}/admin.html`);
  console.log(`Loja demo:   http://localhost:${PORT}/loja-demo.html`);
});
