import nodemailer from 'nodemailer'

// Manda e-mail pela conta do próprio usuário (Gmail), usando uma "senha
// de app" — não a senha normal da conta. Veja o README pra gerar uma.
let transportador = null

function pegarTransportador() {
  if (transportador) return transportador
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) return null
  transportador = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  })
  return transportador
}

export async function enviarEmail({ para, assunto, corpo }) {
  const t = pegarTransportador()
  if (!t) {
    throw new Error('E-mail não configurado — falta EMAIL_USER/EMAIL_APP_PASSWORD no .env.')
  }
  await t.sendMail({
    from: process.env.EMAIL_USER,
    to: para,
    subject: assunto,
    text: corpo,
  })
}
