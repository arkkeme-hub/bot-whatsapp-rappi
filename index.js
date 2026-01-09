import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'

import qrcode from 'qrcode-terminal'
import { google } from 'googleapis'
import fs from 'fs'

// =====================
// GOOGLE SHEETS SETUP
// =====================
const SPREADSHEET_ID = '1SlNF1NaXSk-NkmEDZWxmj469v14Y1PskdAFgdLxJVtE'
const SHEET_NAME = 'Códigos Rappi' // ⚠️ debe llamarse EXACTAMENTE así

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
})

const sheets = google.sheets({ version: 'v4', auth })

// =====================
// PARSEADOR INTELIGENTE
// =====================
function parseMessage(text) {
  // Busca: NUMERO – TEXTO
  const match = text.match(/(\d{3,6})\s*[-–—]\s*(.+)/i)

  if (!match) return null

  return {
    codigo: match[1].trim(),
    tienda: match[2].trim()
  }
}

// =====================
// GUARDAR EN SHEET
// =====================
async function saveToSheet(codigo, tienda) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: ${SHEET_NAME}!A:B,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[codigo, tienda]]
    }
  })
}

// =====================
// WHATSAPP BOT
// =====================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update

    if (qr) {
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      startBot()
    }

    if (connection === 'open') {
      console.log('✅ Bot conectado a WhatsApp')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || !msg.message.conversation) return

    const text = msg.message.conversation
    const parsed = parseMessage(text)

    if (!parsed) return

    await saveToSheet(parsed.codigo, parsed.tienda)

    await sock.sendMessage(msg.key.remoteJid, {
      text: ✅ Guardado:\nCódigo: ${parsed.codigo}\nTienda: ${parsed.tienda}
    })
  })
}


startBot()
