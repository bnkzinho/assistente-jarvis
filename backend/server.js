import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { FERRAMENTAS, executarFerramenta } from './ferramentas.js'
import { iniciarChecadorDeLembretes } from './lembretes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = process.env.PORT || 3000
const JARVIS_SECRET = process.env.JARVIS_SECRET
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'
const MAX_RODADAS_FERRAMENTA = 4

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY não definida — configure no .env (veja .env.example).')
}
if (!JARVIS_SECRET) {
  console.warn('JARVIS_SECRET não definida — qualquer pessoa que achar a URL poderia usar o assistente. Configure no .env.')
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function montarSystemPrompt() {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' })
  return `Você é a Márcia, assistente pessoal de voz do usuário — e tem personalidade de
verdade, não é uma IA genérica de atendimento. Você é espirituosa, sarcástica na medida
certa, solta uma piadinha ou comentário irônico quando cabe, e fala com o usuário como
uma amiga próxima zoaria falaria — não como uma secretária formal. Isso vale sempre,
mesmo em tarefas chatas (criar lembrete, mandar e-mail): você faz o trabalho direito,
só que com graça.
Agora são: ${agora} (horário de Brasília).

Suas respostas são LIDAS EM VOZ ALTA, então:
- Nunca use markdown, listas numeradas, asteriscos ou formatação.
- Seja direta e curta — 1 a 3 frases, a não ser que o pedido exija mais detalhe. Humor
  é tempero, não enrolação: a piada não pode atrapalhar a pessoa entender se a tarefa
  foi feita.
- Fale em português do Brasil, num tom natural de conversa, não robótico.
- Nunca faça humor sobre o conteúdo sério de algo (luto, saúde, dinheiro apertado,
  briga) — nessas horas, acolhe primeiro, humor fica pra depois ou nem aparece.
- Se não souber ou não conseguir fazer algo (ainda não tem essa ferramenta conectada),
  diga isso claramente em vez de inventar.
- Use as ferramentas disponíveis sempre que o pedido for sobre notas, lembretes,
  e-mail, WhatsApp ou o Painel BKO (contestações, ranking, cust codes) — não finja
  que fez, chame a ferramenta de verdade.
- Ações no Painel BKO mexem com dado de verdade da equipe (ex: aprovar uma
  contestação afeta a comissão de alguém) — confirme antes de decidir qualquer
  coisa lá, igual você já faz com e-mail e WhatsApp.`
}

// Histórico em memória, por dispositivo — reseta se o servidor reiniciar.
// Guarda os blocos "crus" (inclusive tool_use/tool_result), do jeito que
// a API da Anthropic espera de volta numa próxima chamada.
const HISTORICO_MAX = 20
const historicos = new Map()

function pegarHistorico(dispositivo) {
  if (!historicos.has(dispositivo)) historicos.set(dispositivo, [])
  return historicos.get(dispositivo)
}

// Guarda só a ÚLTIMA troca (pergunta + resposta) de cada dispositivo —
// separado do histórico "cru" da Claude — pra tela (tela/index.html)
// poder mostrar o que ela acabou de dizer sem expor a conversa inteira.
const ultimasMensagens = new Map()

function textoFinal(blocosDeConteudo) {
  return blocosDeConteudo
    .filter((bloco) => bloco.type === 'text')
    .map((bloco) => bloco.text)
    .join(' ')
    .trim()
}

// Deixa a Claude usar ferramentas em rodadas sucessivas (ex: criar um
// lembrete, ver o resultado, só então responder em texto) até ela parar
// de pedir ferramenta ou até o limite de rodadas — evita loop infinito
// se algo der errado. Além do texto final, junta as "ações locais" que
// o dispositivo (Mac/iPhone) precisa executar (ex: abrir uma URL do
// WhatsApp) — o servidor não tem como fazer isso sozinho.
async function responderComFerramentas(historico, dispositivo) {
  const acoes = []

  for (let rodada = 0; rodada < MAX_RODADAS_FERRAMENTA; rodada++) {
    const resposta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: montarSystemPrompt(),
      tools: FERRAMENTAS,
      messages: historico,
    })

    historico.push({ role: 'assistant', content: resposta.content })

    if (resposta.stop_reason !== 'tool_use') {
      return { texto: textoFinal(resposta.content), acoes }
    }

    const chamadas = resposta.content.filter((b) => b.type === 'tool_use')
    const resultados = []
    for (const chamada of chamadas) {
      let saida
      try {
        saida = await executarFerramenta(chamada.name, chamada.input, dispositivo)
      } catch (err) {
        saida = { texto: `Erro ao executar: ${err.message}` }
      }
      if (saida.acaoLocal) acoes.push(saida.acaoLocal)
      resultados.push({ type: 'tool_result', tool_use_id: chamada.id, content: saida.texto })
    }
    historico.push({ role: 'user', content: resultados })
  }
  return { texto: 'Deu uma confusão tentando fazer isso em várias etapas — tenta de novo, mais direto?', acoes }
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ ok: true, servico: 'marcia-backend' })
})

app.post('/falar', async (req, res) => {
  if (JARVIS_SECRET && req.get('x-jarvis-key') !== JARVIS_SECRET) {
    return res.status(401).json({ erro: 'chave inválida' })
  }

  const { texto, dispositivo = 'desconhecido' } = req.body || {}
  if (!texto || !texto.trim()) {
    return res.status(400).json({ erro: 'campo "texto" é obrigatório' })
  }

  const historico = pegarHistorico(dispositivo)
  historico.push({ role: 'user', content: texto })

  try {
    const { texto: textoResposta, acoes } = await responderComFerramentas(historico, dispositivo)
    while (historico.length > HISTORICO_MAX) historico.shift()
    ultimasMensagens.set(dispositivo, { texto, resposta: textoResposta, quando: new Date().toISOString() })
    res.json({ resposta: textoResposta, acoes })
  } catch (err) {
    console.error('Erro ao chamar a Claude:', err)
    res.status(500).json({ erro: 'falha ao gerar resposta' })
  }
})

app.get('/ultima-mensagem', (req, res) => {
  if (JARVIS_SECRET && req.get('x-jarvis-key') !== JARVIS_SECRET) {
    return res.status(401).json({ erro: 'chave inválida' })
  }
  const dispositivo = req.query.dispositivo || 'desconhecido'
  res.json(ultimasMensagens.get(dispositivo) || {})
})

// Serve a tela animada (tela/index.html) direto do backend — abre em
// qualquer navegador, sem precisar publicar nada à parte.
app.use('/tela', express.static(path.join(__dirname, 'tela')))

iniciarChecadorDeLembretes()

app.listen(PORT, () => {
  console.log(`Márcia (backend) rodando em http://localhost:${PORT}`)
})
