// Guarda notas e lembretes num arquivo JSON simples — sem precisar de
// banco de dados nenhum pra começar. Único cuidado: no plano grátis do
// Render o disco pode ser zerado a cada novo deploy (não em reinícios
// normais). Se isso incomodar no uso real, trocar por um banco de
// verdade (ex: Supabase) é só trocar este arquivo — o resto do código
// não muda.

import fs from 'fs'
import path from 'path'

const ARQUIVO = path.join(process.cwd(), 'data', 'dados.json')

function lerDados() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'))
  } catch {
    return { notas: [], lembretes: [] }
  }
}

function salvarDados(dados) {
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true })
  fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2))
}

export function criarNota(texto) {
  const dados = lerDados()
  const nota = { id: Date.now().toString(36), texto, criadaEm: new Date().toISOString() }
  dados.notas.push(nota)
  salvarDados(dados)
  return nota
}

export function listarNotas() {
  return lerDados().notas
}

export function apagarNota(id) {
  const dados = lerDados()
  const antes = dados.notas.length
  dados.notas = dados.notas.filter((n) => n.id !== id)
  salvarDados(dados)
  return dados.notas.length < antes
}

export function criarLembrete(texto, quandoISO) {
  const dados = lerDados()
  const lembrete = {
    id: Date.now().toString(36),
    texto,
    quando: quandoISO,
    enviado: false,
    criadoEm: new Date().toISOString(),
  }
  dados.lembretes.push(lembrete)
  salvarDados(dados)
  return lembrete
}

export function listarLembretes({ incluirEnviados = false } = {}) {
  const lembretes = lerDados().lembretes
  return incluirEnviados ? lembretes : lembretes.filter((l) => !l.enviado)
}

export function lembretesPendentesAte(dataLimite) {
  const dados = lerDados()
  return dados.lembretes.filter((l) => !l.enviado && new Date(l.quando) <= dataLimite)
}

export function marcarLembreteEnviado(id) {
  const dados = lerDados()
  const lembrete = dados.lembretes.find((l) => l.id === id)
  if (lembrete) lembrete.enviado = true
  salvarDados(dados)
}
