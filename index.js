import express from 'express'
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'

const app = express()
const PORT = process.env.PORT || 3000

let qrCodeData = null

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('/tmp/auth')

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
}

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

startBot()

