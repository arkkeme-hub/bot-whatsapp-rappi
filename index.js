const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Servidor mínimo para Render
app.get("/", (req, res) => {
  res.send("Bot WhatsApp Rappi activo");
});

app.listen(PORT, () => {
  console.log("Servidor web activo en puerto", PORT);
});

// 🔹 WhatsApp Bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("Conexión cerrada. Reintentando:", shouldReconnect);

      if (shouldReconnect) startBot();
    }

    if (connection === "open") {
      console.log("✅ Bot conectado a WhatsApp");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!texto) return;

    if (texto.toLowerCase() === "hola") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "Hola 👋 Bot Rappi activo"
      });
    }
  });
}

startBot();
