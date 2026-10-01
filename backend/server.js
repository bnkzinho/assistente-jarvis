import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const PORT = process.env.PORT || 3000
const JARVIS_SECRET = process.env.JARVIS_SECRET
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY não definida — configure no .env (veja .env.example).')
}
if (!JARVIS_SECRET) {
  console.warn('JARVIS_SECRET não definida — qualquer pessoa que achar a URL poderia usar o assistente. Configure no .env.')
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Você é o assistente pessoal de voz do usuário — um "Jarvis" pessoal.
Suas respostas são LIDAS EM VOZ ALTA, então:
- Nunca use markdown, listas numeradas, asteriscos ou formatação.
- Seja direto e curto — 1 a 3 frases, a não ser que o pedido exija mais detalhe.
- Fale em português do Brasil, num tom natural de conversa, não robótico.
- Se não souber ou não conseguir fazer algo (ainda não tem essa ferramenta conectada),
  diga isso claramente em vez de inventar.`

// Histórico em memória, por dispositivo — reseta se o servidor reiniciar.
// Suficiente pro uso pessoal da v1; se precisar sobreviver a reinícios,
// trocar por um banco (ex: Supabase) é o próximo passo natural.
const HISTORICO_MAX = 12
const historicos = new Map()

function pegarHistorico(dispositivo) {
  if (!historicos.has(dispositivo)) historicos.set(dispositivo, [])
  return historicos.get(dispositivo)
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ ok: true, servico: 'jarvis-backend' })
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
    const resposta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: historico,
    })

    const textoResposta = resposta.content
      .filter((bloco) => bloco.type === 'text')
      .map((bloco) => bloco.text)
      .join(' ')
      .trim()

    historico.push({ role: 'assistant', content: textoResposta })
    while (historico.length > HISTORICO_MAX) historico.shift()

    res.json({ resposta: textoResposta })
  } catch (err) {
    console.error('Erro ao chamar a Claude:', err)
    res.status(500).json({ erro: 'falha ao gerar resposta' })
  }
})

app.listen(PORT, () => {
  console.log(`Jarvis backend rodando em http://localhost:${PORT}`)
})
