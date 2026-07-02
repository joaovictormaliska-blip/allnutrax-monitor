// ============================================================
// Widget de chat — isso é o "sininho" que fica no canto do site
// Você inclui esse arquivo em QUALQUER página da loja com:
// <script src="/widget.js"></script>
// e ele desenha o balãozinho de chat sozinho.
// ============================================================

(function () {
  const socket = io();

  // Avisa o servidor "cheguei, sou um visitante, e estou nessa página"
  socket.emit("identify:visitor", { page: window.location.pathname });

  // ---------- Cria o HTML do widget dinamicamente ----------
  const style = document.createElement("style");
  style.textContent = `
    #an-chat-bubble {
      position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px;
      border-radius: 50%; background: #C6F135; box-shadow: 0 6px 20px rgba(0,0,0,.25);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      z-index: 999999; transition: transform .15s ease;
    }
    #an-chat-bubble:hover { transform: scale(1.06); }
    #an-chat-bubble svg { width: 28px; height: 28px; }
    #an-chat-box {
      position: fixed; bottom: 96px; right: 24px; width: 320px; max-height: 420px;
      background: #101510; border: 1px solid #26311f; border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,.4); display: none; flex-direction: column;
      overflow: hidden; z-index: 999999; font-family: system-ui, sans-serif;
    }
    #an-chat-box.open { display: flex; }
    #an-chat-header {
      background: #C6F135; color: #101510; padding: 14px 16px; font-weight: 700;
      font-size: 14px;
    }
    #an-chat-messages {
      flex: 1; padding: 12px; overflow-y: auto; min-height: 160px; max-height: 260px;
      display: flex; flex-direction: column; gap: 8px; background: #101510;
    }
    .an-msg { padding: 8px 12px; border-radius: 10px; font-size: 13px; max-width: 80%; line-height: 1.4; }
    .an-msg.visitor { align-self: flex-end; background: #C6F135; color: #101510; }
    .an-msg.admin { align-self: flex-start; background: #1e281a; color: #eafcd6; }
    #an-chat-inputRow { display: flex; border-top: 1px solid #26311f; }
    #an-chat-input {
      flex: 1; border: none; background: #101510; color: #eafcd6; padding: 12px;
      font-size: 13px; outline: none;
    }
    #an-chat-send { background: #C6F135; border: none; padding: 0 16px; cursor: pointer; font-weight: 700; }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement("div");
  bubble.id = "an-chat-bubble";
  bubble.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#101510" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

  const box = document.createElement("div");
  box.id = "an-chat-box";
  box.innerHTML = `
    <div id="an-chat-header">Fale com a AllNutrax 💪</div>
    <div id="an-chat-messages"></div>
    <div id="an-chat-inputRow">
      <input id="an-chat-input" placeholder="Digite sua mensagem..." />
      <button id="an-chat-send">Enviar</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(box);

  const messagesEl = box.querySelector("#an-chat-messages");
  const inputEl = box.querySelector("#an-chat-input");
  const sendBtn = box.querySelector("#an-chat-send");

  function addMessage(text, from) {
    const div = document.createElement("div");
    div.className = "an-msg " + from;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  bubble.addEventListener("click", () => box.classList.toggle("open"));

  function sendMsg() {
    const text = inputEl.value.trim();
    if (!text) return;
    socket.emit("visitor:message", { text });
    addMessage(text, "visitor");
    inputEl.value = "";
  }

  sendBtn.addEventListener("click", sendMsg);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMsg();
  });

  // Quando o admin manda mensagem, o servidor devolve aqui em tempo real
  socket.on("chat:incoming", (msg) => {
    addMessage(msg.text, "admin");
    if (!box.classList.contains("open")) {
      bubble.style.boxShadow = "0 0 0 4px #C6F135, 0 6px 20px rgba(0,0,0,.25)";
    }
  });
})();
