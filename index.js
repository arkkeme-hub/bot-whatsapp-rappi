import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'

import { google } from 'googleapis'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import express from 'express'

/* ================= CONFIG ================= */

const SHEET_ID = process.env.SHEET_ID
const SHEET_NAME = process.env.SHEET_NAME || 'Hoja 1'
const PORT = process.env.PORT || 3000

/* ============== GOOGLE SHEETS ============== */

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
})

const sheets = google.sheets({ version: 'v4', auth })

async function getCodes() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: ${SHEET_NAME}!A:B
  })

  return res.data.values || []
}

/* ================= WHATSAPP ================= */

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update

    if (qr) {
      qrcode.generate(qr, { small: true })
      console.log('📲 Escanea el QR')
    }

    if (connection === 'close') {
      const shouldReconnect =
        update.lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (shouldReconnect) startBot()
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    if (!text) return

    const codes = await getCodes()
    const found = codes.find(row => row[0] === text)

    if (found) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: ✅ Código válido: ${found[1]}
      })
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Código no encontrado'
      })
    }
  })
}

/* ================= SERVER ================= */

const app = express()

app.get('/', (req, res) => {
  res.send('Bot WhatsApp Rappi activo')
})

app.listen(PORT, () => {
  console.log(🌐 Servidor en puerto ${PORT})
})

startBot()
