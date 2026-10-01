import cron from 'node-cron'
import { lembretesPendentesAte, marcarLembreteEnviado } from './armazenamento.js'
import { notificar } from './notificar.js'

// Checa a cada minuto se tem lembrete vencido — simples e confiável o
// bastante pra uso pessoal (não precisa de fila/agendador chique).
export function iniciarChecadorDeLembretes() {
  cron.schedule('* * * * *', async () => {
    const vencidos = lembretesPendentesAte(new Date())
    for (const lembrete of vencidos) {
      await notificar('Márcia — lembrete', lembrete.texto)
      marcarLembreteEnviado(lembrete.id)
    }
  })
  console.log('Checador de lembretes ativo (a cada minuto).')
}
