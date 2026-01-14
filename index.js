import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import P from 'pino'
import { google } from 'googleapis'
import fs from 'fs'

const SHEET_ID = '1SlNF1NaXSk-NkmEDZWxmj469v14Y1PskdAFgdLxJVtE'
const SHEET_NAME = 'Hoja 1' // ⚠️ CAMBIA si tu hoja tiene otro nombre

// 🔐 Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync('credentials.json')),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
})

async function guardarEnSheets(codigo, tienda) {
  const sheets = google.sheets({ version: 'v4', auth })

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:B`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[codigo, tienda]]
    }
  })

  console.log('📊 Guardado en Sheets:', codigo, tienda)
}

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      console.log('✅ Bot conectado')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    if (!from.endsWith('@g.us')) return

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    // 🧠 FORMATO: "TIENDA CODIGO"
    const match = texto.trim().match(/^(.+?)\s+(\d+)$/)
    if (!match) return

    const tienda = match[1].trim()
    const codigo = match[2].trim()

    console.log('🏪 TIENDA:', tienda)
    console.log('🔐 CÓDIGO:', codigo)

    await guardarEnSheets(codigo, tienda)
  })
}

iniciarBot()
