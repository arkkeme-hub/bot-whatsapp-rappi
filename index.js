import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import express from "express";
import qrcode from "qrcode";

const app = express();
let qrImage = null;

app.get("/", async (req, res) => {
  if (qrImage) {
    res.send(`
      <h2>Escanea este QR con WhatsApp</h2>
      <img src="${qrImage}" />
    `);
  } else {
    res.send("Bot WhatsApp Rappi activo");
  }
});

const startBot = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    browser: ["Ubuntu", "Chrome", "22.04"]
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;

    if (qr) {
      qrImage = await qrcode.toDataURL(qr);
    }

    if (connection === "open") {
      console.log("WhatsApp conectado");
      qrImage = null;
    }
  });

  sock.ev.on("creds.update", saveCreds);
};

startBot();

app.listen(3000, () => {
  console.log("Servidor web activo");
});
