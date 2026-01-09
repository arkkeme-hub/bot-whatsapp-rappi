const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Bot Rappi', 'Chrome', '1.0.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      console.log('❌ conexión cerrada. Reintentando:', shouldReconnect)

      if (shouldReconnect) {
        startBot()
      }
    } else if (connection === 'open') {
      console.log('✅ BOT CONECTADO A WHATSAPP')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    console.log('📩 Mensaje recibido:', texto)

    if (texto.toLowerCase() === 'ping') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'pong 🟢' })
    }
  })
}

startBot()
