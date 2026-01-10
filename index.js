import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'

import qrcode from 'qrcode-terminal'
import P from 'pino'
import { google } from 'googleapis'

/* =======================
   CONFIGURACIÓN
======================= */

const SPREADSHEET_ID = '1SlNF1NaXSk-NkmEDZWxmj469v14Y1PskdAFgdLxJVtE'
const SHEET_NAME = 'Códigos Organizados' // 

console.log('INICIANDO BOT...')

/* =======================
   BOT
======================= */

async function startBot () {
  // Auth WhatsApp
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['Chrome', 'Windows', '20'],
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  // Google Sheets auth
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })

  const sheets = google.sheets({ version: 'v4', auth })

  /* =======================
     CONEXIÓN WHATSAPP
  ======================= */

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update

    if (qr) {
      console.log('📱 ESCANEA ESTE QR')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ CONECTADO A WHATSAPP')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      console.log('❌ CONEXIÓN CERRADA - código:', code)

      if (code !== DisconnectReason.loggedOut) {
        startBot()
      }
    }
  })

  /* =======================
     MENSAJES
  ======================= */

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    if (!text) return

    /*
      Regla:
      - Detecta mensajes tipo:
        3484 – AC Asados Al Carbón Centro
        3484 AC Asados Al Carbón Centro
    */

    const match = text.match(/^(\d{3,6})\s*[-–]?\s*(.+)$/)
    if (!match) return

    const codigo = match[1].trim()
    const tienda = match[2].trim()

    try {
      // Leer códigos existentes
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '${SHEET_NAME}!A:A'
      })

      const codes = existing.data.values
        ? existing.data.values.flat()
        : []

      if (codes.includes(codigo)) {
        console.log('⏩ DUPLICADO IGNORADO:', codigo)
        return
      }

      // Guardar nuevo registro
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '${SHEET_NAME}!A:B',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[codigo, tienda]]
        }
      })

      console.log('✅ GUARDADO:', codigo, tienda)

    } catch (err) {
      console.error('❌ ERROR GOOGLE SHEETS:', err.message)
    }
  })
}

startBot()