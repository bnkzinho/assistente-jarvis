// Manda notificação push de verdade pro celular/Mac, via ntfy.sh — um
// serviço público e grátis, sem precisar criar conta: você só instala o
// app "ntfy" (iPhone/Mac) e se inscreve num "tópico" (um nome qualquer,
// tipo um canal). Qualquer coisa que o backend publicar nesse tópico vira
// notificação na hora. Veja o README pra configurar.

const NTFY_TOPIC = process.env.NTFY_TOPIC

export async function notificar(titulo, mensagem) {
  if (!NTFY_TOPIC) {
    console.warn('NTFY_TOPIC não configurado — notificação não enviada:', titulo, mensagem)
    return
  }
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: { Title: titulo, Priority: 'default' },
      body: mensagem,
    })
  } catch (err) {
    console.error('Falha ao notificar via ntfy:', err.message)
  }
}
