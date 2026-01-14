import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import P from 'pino'
import { google } from 'googleapis'

// ===============================
// 🔐 GOOGLE SHEETS CONFIG
// ===============================
const SHEET_ID = '1SlNF1NaXSk-NkmEDZWxmj469v14Y1PskdAFgdLxJVtE'
const SHEET_NAME = 'Hoja 1' // cambia solo si tu hoja se llama distinto

// Credenciales desde Render (ENV)
if (!process.env.GOOGLE_CREDENTIALS_JSON) {
  console.error('❌ GOOGLE_CREDENTIALS_JSON no está definida')
  process.exit(1)
}

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)

const authGoogle = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth: authGoogle })

async function guardarEnSheets(codigo, tienda) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:B`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[codigo, tienda]],
    },
  })

  console.log('📊 Guardado en Sheets:', codigo, tienda)
}

// ===============================
// 🤖 WHATSAPP BOT
// ===============================
async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true, // solo para LOCAL, en Render no se usa
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('✅ Bot conectado a WhatsApp')
    } else if (connection === 'close') {
      console.log('⚠️ Conexión cerrada, reintentando...')
      iniciarBot()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    if (!from.endsWith('@g.us')) return // solo grupos

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    // 🎯 FORMATO EXACTO: "TIENDA CODIGO"
    // Ejemplo: "Éxito 12345"
    const match = texto.trim().match(/^(.+?)\s+(\d+)$/)
    if (!match) return

    const tienda = match[1].trim()
    const codigo = match[2].trim()

    console.log('🏪 TIENDA:', tienda)
    console.log('🔐 CÓDIGO:', codigo)

    try {
      await guardarEnSheets(codigo, tienda)
    } catch (err) {
      console.error('❌ Error guardando en Sheets:', err.message)
    }
  })
}

iniciarBot()

