// Ponte entre a Márcia e o Painel BKO (o site da equipe,
// github.com/.../EQUIPEBKOBRAYAN) — ela entra com o SEU login de
// supervisor (igual você entraria pelo navegador) e usa as mesmas
// funções que o site usa, então as mesmas regras de segurança do banco
// (RLS) valem pra ela também.
//
// Credenciais (.env): PAINEL_BKO_USUARIO e PAINEL_BKO_SENHA são o SEU
// usuário/senha de supervisor do Painel BKO — nunca comitados, só no
// .env local/Render. PAINEL_BKO_SUPABASE_URL e _ANON_KEY não são
// segredo (já vêm públicos no próprio site e na extensão Crivo), por
// isso têm um valor padrão — só precisa trocar se um dia mudar de
// projeto Supabase.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PAINEL_BKO_SUPABASE_URL || 'https://cdbvevtsaorburbmogpk.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.PAINEL_BKO_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkYnZldnRzYW9yYnVyYm1vZ3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzkwODcsImV4cCI6MjEwMjMxNTA4N30.JQS_71VpIHELYUBK27eY8X7asAA3LvzlXbbps8Iaeho'

const EMAIL_DOMAIN = 'painelbko.internal' // mesmo truque do site: login é por usuário, não e-mail
const usernameToEmail = (username) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`

let cliente = null
let logado = false
let usuarioId = null

function pegarCliente() {
  if (!cliente) cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cliente
}

async function garantirLogin() {
  const usuario = process.env.PAINEL_BKO_USUARIO
  const senha = process.env.PAINEL_BKO_SENHA
  if (!usuario || !senha) {
    throw new Error('Painel BKO não configurado — falta PAINEL_BKO_USUARIO/PAINEL_BKO_SENHA no .env.')
  }
  if (logado) return
  const { data, error } = await pegarCliente().auth.signInWithPassword({ email: usernameToEmail(usuario), password: senha })
  if (error) throw new Error('Login no Painel BKO falhou — confere usuário/senha no .env.')
  logado = true
  usuarioId = data.user.id
}

// Roda uma chamada ao Supabase já logada; se der erro de autenticação
// (ex: sessão expirou), tenta logar de novo uma vez antes de desistir.
async function comLogin(fn) {
  await garantirLogin()
  const resultado = await fn(pegarCliente())
  if (resultado.error?.message?.toLowerCase().includes('jwt')) {
    logado = false
    await garantirLogin()
    return fn(pegarCliente())
  }
  return resultado
}

export async function listarContestacoesPendentes() {
  const { data, error } = await comLogin((db) =>
    db
      .from('contestacoes')
      .select('id, cust_code, observacao, created_at, profiles!contestacoes_user_id_fkey(name)')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
  )
  if (error) throw new Error(error.message)
  return data
}

export async function decidirContestacao(id, status, motivo) {
  if (!['autorizada', 'recusada'].includes(status)) {
    throw new Error('status precisa ser "autorizada" ou "recusada"')
  }
  const { error } = await comLogin((db) =>
    db.rpc('decide_contestacao', { p_id: id, p_status: status, p_motivo: motivo || null })
  )
  if (error) throw new Error(error.message)
}

export async function consultarRanking() {
  const { data, error } = await comLogin((db) =>
    db
      .from('profiles')
      .select('name, performance(commission, contestations_done, rescheduling_done)')
      .eq('role', 'bko')
  )
  if (error) throw new Error(error.message)
  return data
    .map((p) => ({ nome: p.name, ...(p.performance ?? {}) }))
    .sort((a, b) => Number(b.commission || 0) - Number(a.commission || 0))
}

export async function consultarCustCodes(status = 'pendente') {
  const { data, error } = await comLogin((db) => {
    let query = db.from('contestacoes').select('cust_code, status, created_at')
    if (status !== 'all') query = query.eq('status', status)
    return query.order('created_at', { ascending: false })
  })
  if (error) throw new Error(error.message)
  return data
}

export async function consultarReagendamentos() {
  const { data, error } = await comLogin((db) =>
    db
      .from('profiles')
      .select('name, performance(rescheduling_done, rescheduling_goal)')
      .eq('role', 'bko')
  )
  if (error) throw new Error(error.message)
  return data.map((p) => ({
    nome: p.name,
    feitos: p.performance?.rescheduling_done ?? 0,
    meta: p.performance?.rescheduling_goal ?? 0,
  }))
}

export async function consultarEquipe() {
  const { data, error } = await comLogin((db) =>
    db.from('profiles').select('id, name, username, active').eq('role', 'bko').order('name')
  )
  if (error) throw new Error(error.message)
  return data
}

// Dispara uma consulta de CNPJ no Crivo (igual digitar na tela de
// Aprovação do site) e espera um pouco pela resposta — quem responde de
// verdade é a extensão Crivo rodando no Chrome de alguém, lendo os
// sistemas do TIM, então só funciona se tiver uma aba logada nisso em
// algum computador da equipe.
export async function consultarCnpjCrivo(cnpj, segundosDeEspera = 15) {
  const { data: inserido, error: erroInsert } = await comLogin((db) =>
    db.from('crivo_consultas').insert({ cnpj, solicitado_por: usuarioId }).select('id').single()
  )
  if (erroInsert) throw new Error(erroInsert.message)

  const inicio = Date.now()
  while (Date.now() - inicio < segundosDeEspera * 1000) {
    await new Promise((r) => setTimeout(r, 2000))
    const { data: linha, error } = await comLogin((db) =>
      db.from('crivo_consultas').select('status, sistema1_resultado, sistema2_resultado, erro_mensagem').eq('id', inserido.id).single()
    )
    if (error) throw new Error(error.message)
    if (linha.status === 'concluido') {
      // sistema1 "reprovado" já fecha sozinho (não espera sistema2) — fora
      // isso, quem decide é o sistema2 (crivo de mercado, mais rigoroso).
      const resultado = linha.sistema1_resultado === 'reprovado' ? 'reprovado' : linha.sistema2_resultado
      return { pronto: true, resultado }
    }
    if (linha.status === 'erro') {
      return { pronto: true, erro: linha.erro_mensagem }
    }
  }
  return { pronto: false }
}
