import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import express from "express";

const app = express();
let lastQR = null;

app.get("/", async (req, res) => {
  if (lastQR) {
    const qrImage = await qrcode.toDataURL(lastQR);
    res.send(`
      <h2>Escanea este QR</h2>
      <img src="${qrImage}" />
    `);
  } else {
    res.send("Bot WhatsApp Rappi activo");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor web activo en puerto", PORT);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state
  });

  sock.ev.on("connection.update", (update) => {
    if (update.qr) {
      lastQR = update.qr;
      console.log("QR generado");
    }

    if (update.connection === "open") {
      lastQR = null;
      console.log("WhatsApp conectado");
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startBot();
