import express from 'express'
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import { google } from 'googleapis'
import fs from 'fs'

/* =====================
   CONFIGURACIÓN
===================== */

const PORT = process.env.PORT || 3000

// Google Sheets
const SHEET_ID = '1SlNF1NaXSk-NkmEDZWxmj469v14Y1PskdAFgdLxJVtE'
const SHEET_NAME = 'Hoja 1' // cambia si tu hoja tiene otro nombre

// Credenciales (archivo credentials.json)
const CREDENTIALS_PATH = './credentials.json'

/* =====================
   EXPRESS
===================== */

const app = express()
let qrCodeData = null

app.get('/', (req, res) => {
  if (qrCodeData) {
    res.send(`
      <h2>Escanea el QR con WhatsApp</h2>
      <img src="${qrCodeData}" />
    `)
  } else {
    res.send('<h2>Bot conectado o esperando QR...</h2>')
  }
})

app.listen(PORT, () => {
  console.log('Servidor web activo en puerto', PORT)
})

/* =====================
   GOOGLE SHEETS
===================== */

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })

  const client = await auth.getClient()
  return google.sheets({ version: 'v4', auth: client })
}

async function appendToSheet(code, store) {
  const sheets = await getSheetsClient()

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: ${SHEET_NAME}!A:B,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[code, store]]
    }
  })

  console.log('Guardado en Sheets:', code, store)
}

/* =====================
   WHATSAPP BOT
===================== */

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    browser: ['Ubuntu', 'Chrome', '22.04']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update

    if (qr) {
      qrCodeData = await QRCode.toDataURL(qr)
      console.log('QR generado')
    }

    if (connection === 'open') {
      console.log('WhatsApp conectado ✅')
      qrCodeData = null
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || !msg.message.conversation) return

    const text = msg.message.conversation.trim()

    // Regla: código + nombre tienda (ej: "3484 AC Asados Al Carbón Centro")
    const match = text.match(/^(\d{3,6})\s+(.+)/)

    if (!match) return

    const code = match[1]
    const store = match[2]

    await appendToSheet(code, store)
  })
}

startBot()
