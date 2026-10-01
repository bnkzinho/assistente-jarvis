import { criarNota, listarNotas, apagarNota, criarLembrete, listarLembretes } from './armazenamento.js'
import { enviarEmail } from './email.js'

// Formato que a Claude usa (Anthropic "tool use") — cada ferramenta tem
// nome, descrição (é isso que ela lê pra decidir QUANDO usar) e o
// formato esperado dos parâmetros.
export const FERRAMENTAS = [
  {
    name: 'criar_nota',
    description: 'Guarda uma anotação do usuário pra consultar depois. Use sempre que ele pedir pra anotar/guardar/lembrar de algo que NÃO tem hora marcada (se tiver hora, use criar_lembrete).',
    input_schema: {
      type: 'object',
      properties: { texto: { type: 'string', description: 'o conteúdo da anotação' } },
      required: ['texto'],
    },
  },
  {
    name: 'listar_notas',
    description: 'Lista as anotações guardadas. Use quando o usuário perguntar o que ele anotou, ou pedir pra ver as notas.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'apagar_nota',
    description: 'Apaga uma anotação pelo id (peça pro usuário confirmar qual, mostrando a lista antes se não tiver certeza).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id da nota, obtido antes via listar_notas' } },
      required: ['id'],
    },
  },
  {
    name: 'criar_lembrete',
    description: 'Agenda um lembrete que vai notificar o usuário no celular/Mac na hora marcada. Use sempre que o pedido tiver um horário/data, mesmo relativo ("daqui a 1 hora", "amanhã de manhã") — calcule a data/hora exata em ISO 8601 (com fuso -03:00) a partir da data/hora atual informada no seu system prompt.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'o que lembrar' },
        quando_iso: { type: 'string', description: 'data/hora exata em ISO 8601, ex: 2026-10-02T09:00:00-03:00' },
      },
      required: ['texto', 'quando_iso'],
    },
  },
  {
    name: 'listar_lembretes',
    description: 'Lista os lembretes ainda não disparados. Use quando o usuário perguntar o que ele tem agendado/marcado.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'enviar_email',
    description: 'Manda um e-mail de verdade em nome do usuário. SEMPRE confirme destinatário e conteúdo com o usuário antes de chamar essa ferramenta (não envie sem confirmação explícita no histórico da conversa).',
    input_schema: {
      type: 'object',
      properties: {
        para: { type: 'string', description: 'e-mail do destinatário' },
        assunto: { type: 'string' },
        corpo: { type: 'string' },
      },
      required: ['para', 'assunto', 'corpo'],
    },
  },
]

export async function executarFerramenta(nome, input) {
  switch (nome) {
    case 'criar_nota': {
      const nota = criarNota(input.texto)
      return `Anotado (id ${nota.id}): ${nota.texto}`
    }
    case 'listar_notas': {
      const notas = listarNotas()
      if (!notas.length) return 'Não tem nenhuma anotação guardada.'
      return notas.map((n) => `[${n.id}] ${n.texto}`).join('\n')
    }
    case 'apagar_nota': {
      const ok = apagarNota(input.id)
      return ok ? 'Nota apagada.' : 'Não achei essa nota.'
    }
    case 'criar_lembrete': {
      const lembrete = criarLembrete(input.texto, input.quando_iso)
      return `Lembrete marcado pra ${new Date(lembrete.quando).toLocaleString('pt-BR')}: ${lembrete.texto}`
    }
    case 'listar_lembretes': {
      const lembretes = listarLembretes()
      if (!lembretes.length) return 'Não tem nenhum lembrete pendente.'
      return lembretes
        .map((l) => `[${l.id}] ${new Date(l.quando).toLocaleString('pt-BR')} — ${l.texto}`)
        .join('\n')
    }
    case 'enviar_email': {
      await enviarEmail(input)
      return `E-mail enviado pra ${input.para}.`
    }
    default:
      return `Ferramenta desconhecida: ${nome}`
  }
}
