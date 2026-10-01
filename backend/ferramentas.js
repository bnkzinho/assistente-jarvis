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
  {
    name: 'abrir_whatsapp',
    description: 'Deixa uma mensagem pronta no WhatsApp (Mac ou iPhone, o que o usuário estiver usando), já escrita, pra ele só conferir e apertar enviar — NÃO manda sozinha, é só um atalho. Use quando o usuário pedir pra mandar/escrever mensagem no WhatsApp pra alguém. Sempre confirme o número de telefone e o texto da mensagem antes de chamar (se ele só der um nome, sem número, pergunte o número — ainda não existe agenda de contatos).',
    input_schema: {
      type: 'object',
      properties: {
        telefone: { type: 'string', description: 'número de telefone, com DDD (o país já é assumido como Brasil se não vier com código)' },
        mensagem: { type: 'string' },
      },
      required: ['telefone', 'mensagem'],
    },
  },
]

function normalizarTelefone(numero) {
  const digitos = (numero || '').replace(/\D/g, '')
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

// Devolve { texto, acaoLocal? } — texto vira o tool_result pra Claude.
// acaoLocal, quando existe (hoje só em abrir_whatsapp — o servidor não
// tem como abrir nada na tela de ninguém, só o Mac/iPhone conseguem),
// é repassado pro dispositivo no JSON de resposta, pra ele executar.
// acaoLocal (quando existe) é o que o server.js repassa pro dispositivo
// executar.
export async function executarFerramenta(nome, input) {
  switch (nome) {
    case 'criar_nota': {
      const nota = criarNota(input.texto)
      return { texto: `Anotado (id ${nota.id}): ${nota.texto}` }
    }
    case 'listar_notas': {
      const notas = listarNotas()
      if (!notas.length) return { texto: 'Não tem nenhuma anotação guardada.' }
      return { texto: notas.map((n) => `[${n.id}] ${n.texto}`).join('\n') }
    }
    case 'apagar_nota': {
      const ok = apagarNota(input.id)
      return { texto: ok ? 'Nota apagada.' : 'Não achei essa nota.' }
    }
    case 'criar_lembrete': {
      const lembrete = criarLembrete(input.texto, input.quando_iso)
      return { texto: `Lembrete marcado pra ${new Date(lembrete.quando).toLocaleString('pt-BR')}: ${lembrete.texto}` }
    }
    case 'listar_lembretes': {
      const lembretes = listarLembretes()
      if (!lembretes.length) return { texto: 'Não tem nenhum lembrete pendente.' }
      return {
        texto: lembretes
          .map((l) => `[${l.id}] ${new Date(l.quando).toLocaleString('pt-BR')} — ${l.texto}`)
          .join('\n'),
      }
    }
    case 'enviar_email': {
      await enviarEmail(input)
      return { texto: `E-mail enviado pra ${input.para}.` }
    }
    case 'abrir_whatsapp': {
      const telefone = normalizarTelefone(input.telefone)
      const url = `https://wa.me/${telefone}?text=${encodeURIComponent(input.mensagem)}`
      return {
        texto: 'Deixei a mensagem pronta no WhatsApp — é só conferir e apertar enviar.',
        acaoLocal: { tipo: 'abrir_url', url },
      }
    }
    default:
      return { texto: `Ferramenta desconhecida: ${nome}` }
  }
}
