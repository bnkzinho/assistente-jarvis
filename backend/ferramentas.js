import { criarNota, listarNotas, apagarNota, criarLembrete, listarLembretes } from './armazenamento.js'
import { enviarEmail } from './email.js'
import {
  listarContestacoesPendentes,
  decidirContestacao,
  consultarRanking,
  consultarCustCodes,
  consultarReagendamentos,
  consultarEquipe,
  consultarCnpjCrivo,
} from './painel-bko.js'

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
    description: 'Manda uma mensagem no WhatsApp pro número informado. No Mac ela é enviada de verdade, sozinha (sem precisar de mais nenhum toque). No iPhone (ou em qualquer outro dispositivo que não seja o Mac) ela só deixa a mensagem pronta, escrita, pro usuário conferir e apertar enviar — isso é uma limitação do iPhone, não escolha sua, então não prometa envio automático se o dispositivo não for "mac". Como no Mac o envio é IRREVERSÍVEL e automático, SEMPRE confirme o número de telefone e o texto exatos com o usuário antes de chamar essa ferramenta (se ele só der um nome, sem número, pergunte o número — ainda não existe agenda de contatos).',
    input_schema: {
      type: 'object',
      properties: {
        telefone: { type: 'string', description: 'número de telefone, com DDD (o país já é assumido como Brasil se não vier com código)' },
        mensagem: { type: 'string' },
      },
      required: ['telefone', 'mensagem'],
    },
  },
  {
    name: 'listar_contestacoes_pendentes',
    description: 'Lista as contestações do Painel BKO (site da equipe) que estão esperando decisão do supervisor. Use quando o usuário perguntar o que tem pra aprovar/decidir.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'decidir_contestacao',
    description: 'Aprova ("autorizada") ou recusa ("recusada") uma contestação no Painel BKO — ação de supervisor de verdade, afeta a meta/comissão de um BKO da equipe. SEMPRE confirme com o usuário qual contestação (mostre a lista antes se não tiver certeza do id) e a decisão exata antes de chamar.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id da contestação, obtido via listar_contestacoes_pendentes' },
        status: { type: 'string', enum: ['autorizada', 'recusada'] },
        motivo: { type: 'string', description: 'motivo da recusa (opcional, só faz sentido se status for recusada)' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'consultar_ranking',
    description: 'Consulta o ranking de comissão da equipe no Painel BKO. Use quando o usuário perguntar quem tá na frente, como anda o ranking, etc.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_cust_codes',
    description: 'Lista os Cust Codes de contestação no Painel BKO, filtrando por status.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pendente', 'autorizada', 'recusada', 'all'], description: 'padrão: pendente' },
      },
    },
  },
  {
    name: 'consultar_reagendamentos',
    description: 'Consulta o progresso de reagendamento de cada BKO da equipe (feitos vs meta) no Painel BKO.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_equipe',
    description: 'Lista os BKOs da equipe no Painel BKO (nome, usuário, se está ativo).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_cnpj_crivo',
    description: 'Dispara uma consulta de crédito (Crivo) pro CNPJ informado, igual digitar na tela de Aprovação do Painel BKO, e espera um pouco pela resposta. SÓ funciona se tiver algum computador da equipe com a extensão Crivo ativa numa aba do Easy Vendas — avise o usuário se der timeout (pronto=false) que pode ser isso. Confirme o CNPJ antes de chamar se não tiver certeza.',
    input_schema: {
      type: 'object',
      properties: { cnpj: { type: 'string', description: 'só os números, 14 dígitos' } },
      required: ['cnpj'],
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
export async function executarFerramenta(nome, input, dispositivo) {
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
      // No Mac ela aperta enviar sozinha (o cliente Mac sabe fazer isso);
      // no iPhone (e em qualquer outro dispositivo) só deixa pronto, porque
      // os Atalhos da Siri não têm como simular um toque no botão Enviar.
      const texto = dispositivo === 'mac'
        ? 'Prontinho, já mandei no WhatsApp.'
        : 'Deixei a mensagem pronta no WhatsApp — é só conferir e apertar enviar.'
      return {
        texto,
        acaoLocal: { tipo: 'whatsapp', telefone, mensagem: input.mensagem, url },
      }
    }
    case 'listar_contestacoes_pendentes': {
      const lista = await listarContestacoesPendentes()
      if (!lista.length) return { texto: 'Não tem nenhuma contestação pendente.' }
      return {
        texto: lista
          .map((c) => `[${c.id}] ${c.profiles?.name || '?'} — Cust Code ${c.cust_code}: ${c.observacao || '(sem observação)'}`)
          .join('\n'),
      }
    }
    case 'decidir_contestacao': {
      await decidirContestacao(input.id, input.status, input.motivo)
      return { texto: `Contestação ${input.status}.` }
    }
    case 'consultar_ranking': {
      const ranking = await consultarRanking()
      return {
        texto: ranking
          .map((r, i) => `${i + 1}º ${r.nome} — comissão R$ ${Number(r.commission || 0).toFixed(2)}`)
          .join('\n'),
      }
    }
    case 'consultar_cust_codes': {
      const lista = await consultarCustCodes(input.status)
      if (!lista.length) return { texto: 'Nenhum cust code encontrado com esse filtro.' }
      return { texto: lista.map((c) => `${c.cust_code} (${c.status})`).join(', ') }
    }
    case 'consultar_reagendamentos': {
      const lista = await consultarReagendamentos()
      return { texto: lista.map((r) => `${r.nome}: ${r.feitos} de ${r.meta}`).join('\n') }
    }
    case 'consultar_equipe': {
      const lista = await consultarEquipe()
      return { texto: lista.map((b) => `${b.name} (@${b.username}) — ${b.active ? 'ativo' : 'inativo'}`).join('\n') }
    }
    case 'consultar_cnpj_crivo': {
      const resultado = await consultarCnpjCrivo(input.cnpj)
      if (!resultado.pronto) return { texto: 'Mandei pra fila do Crivo, mas ainda não veio resposta — tenta perguntar de novo daqui a pouco.' }
      if (resultado.erro) return { texto: `Deu erro no Crivo: ${resultado.erro}` }
      return { texto: `Resultado do Crivo: ${resultado.resultado}.` }
    }
    default:
      return { texto: `Ferramenta desconhecida: ${nome}` }
  }
}
