# Márcia — assistente pessoal com voz

Conversa por voz pelo Mac e pelo iPhone, guarda notas, agenda lembretes
que notificam de verdade no celular, manda e-mail por você, deixa
mensagem pronta no WhatsApp, e acessa o Painel BKO com o seu login de
supervisor (ver contestações, aprovar/recusar, ranking, cust codes).

## Como funciona

```
Mac (jarvis.py)  ──┐
                    ├──► backend (Node/Express) ──► Claude (com ferramentas:
iPhone (Atalho)  ──┘      notas, lembretes, e-mail,        ──► resposta + ação
                           WhatsApp, Painel BKO)                   │
                                     │                             └──► Mac/iPhone abre o
                                     │                                  link do WhatsApp
                                     ├──► lembrete vencido ──► ntfy.sh ──► notificação no celular/Mac
                                     └──► login de supervisor ──► Supabase do Painel BKO
```

Um backend só, publicado uma vez, atende os dois dispositivos. A Claude
decide sozinha, pela conversa, quando precisa usar uma ferramenta (criar
nota, agendar lembrete, mandar e-mail, abrir WhatsApp) em vez de só
responder em texto. Pra WhatsApp, o backend nunca manda nada sozinho —
ele só devolve um link pronto (`wa.me/...`), e quem abre esse link é o
próprio Mac ou iPhone, que é quem tem o WhatsApp instalado de verdade.

## 1. Publicar o backend

Precisa de uma URL pública (o iPhone não alcança seu Mac local).

1. Cria uma conta em [render.com](https://render.com) (tem plano grátis).
2. **New +** → **Web Service** → conecta este repositório → pasta raiz `backend/`.
3. Build command: `npm install` — Start command: `npm start`.
4. Em **Environment**, adiciona as variáveis (veja `backend/.env.example` pra
   todas — as três primeiras são obrigatórias, o resto é opcional):
   - `ANTHROPIC_API_KEY` — sua chave da Anthropic ([console.anthropic.com](https://console.anthropic.com))
   - `JARVIS_SECRET` — inventa uma senha longa qualquer (ex: gerada em
     [1password.com/password-generator](https://1password.com/password-generator))
   - `CLAUDE_MODEL` — pode deixar `claude-sonnet-5`
   - `NTFY_TOPIC` — pra lembretes virarem notificação de verdade (veja passo 4 abaixo)
   - `EMAIL_USER` / `EMAIL_APP_PASSWORD` — pra ela poder mandar e-mail (veja passo 5)
   - `PAINEL_BKO_USUARIO` / `PAINEL_BKO_SENHA` — pra ela acessar o Painel BKO (veja passo 6)
5. Deploy. Guarda a URL que o Render te dá (tipo `https://marcia-xxxx.onrender.com`).

**Sobre guardar notas e lembretes:** por enquanto fica num arquivo simples
no próprio servidor — funciona bem, só que no plano grátis do Render esse
arquivo pode ser apagado quando você publica uma atualização nova do
código (não em reinícios normais). Se isso incomodar no dia a dia, trocar
por um banco de verdade depois é simples, sem mexer em mais nada.

## 2. Configurar o Mac

```bash
cd mac
brew install sox
pip install -r requirements.txt
cp .env.example .env
# edita o .env: BACKEND_URL (a URL do passo 1), JARVIS_SECRET (a mesma senha),
# e OPENAI_API_KEY (veja abaixo)
python3 jarvis.py
```

Aperta Enter, fala, aperta Enter de novo — ela responde em voz. Ao
iniciar, já abre sozinha a **tela animada** dela no navegador (veja a
seção "A tela" mais abaixo).

**Por que precisa de uma chave da OpenAI também:** a Claude não transcreve
áudio — só texto. O Whisper (OpenAI) faz só essa parte (ouvir e virar
texto); quem responde de verdade continua sendo a Claude, lá no backend.
Pega a chave em [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
— custa centavos por minuto de áudio.

**Pra abrir só falando "Ei Siri, abre Márcia" (sem rodar o jarvis.py):**
o Mac também tem Atalhos/Siri, igual o iPhone.
1. Abre o app **Atalhos** no Mac → novo atalho → renomeia pra **Abrir Márcia**.
2. Adiciona a ação **Abrir URLs**, com a URL:
   `SEU-BACKEND.onrender.com/tela?backend=https://SEU-BACKEND.onrender.com&chave=SUA_JARVIS_SECRET`
3. Nas configurações do atalho, liga "Adicionar à Siri" e grava a frase "Márcia".

Isso só abre a tela (mostra o que ela disse por último, se o `jarvis.py`
estiver rodando em algum lugar) — pra realmente FALAR com ela por voz
ainda precisa do `jarvis.py` rodando (é ele que grava e transcreve o
áudio).

## 3. Configurar o iPhone

Veja o passo a passo em [`ios/README.md`](ios/README.md) — é só montar um
Atalho, sem instalar nada. A frase pra chamar é "Ei Siri, Márcia".

## A tela animada

`backend/tela/index.html` — uma página com um "orbe" azul pulsante (estilo
holograma), o que você falou e a resposta dela, e os ícones do que ela
sabe fazer (notas, lembretes, e-mail, WhatsApp, Painel BKO). Servida pelo
próprio backend, sem publicar nada à parte: `SEU-BACKEND.onrender.com/tela`.

Na primeira vez que abrir direto (sem vir do `jarvis.py` ou do Atalho
"Abrir Márcia"), ela pergunta a URL do backend e a chave — só uma vez,
fica guardado no navegador. Atualiza sozinha a cada 2 segundos.

## 4. Notificação de lembrete no celular (ntfy)

1. Instala o app **ntfy** — grátis, sem criar conta ([App Store](https://apps.apple.com/app/ntfy/id1625396347) / [ntfy.sh](https://ntfy.sh) pro Mac).
2. Escolhe um nome de tópico difícil de adivinhar (ex: `marcia-lembretes-83f2k1`)
   e se inscreve nele dentro do app.
3. Coloca esse mesmo nome na variável `NTFY_TOPIC` do backend (Render).

Pronto — quando um lembrete vencer, chega notificação push de verdade,
mesmo com o app fechado.

## 5. E-mail (opcional)

1. Ativa a verificação em duas etapas na sua conta Google (se ainda não tiver).
2. Gera uma "senha de app" em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Coloca seu Gmail em `EMAIL_USER` e a senha gerada (não a senha normal!)
   em `EMAIL_APP_PASSWORD`, no backend (Render).

A Márcia sempre confirma destinatário e conteúdo com você antes de mandar
de verdade — não envia e-mail sozinha sem você falar "pode mandar".

## 6. Painel BKO (opcional)

Coloca seu usuário e senha de supervisor do Painel BKO (os mesmos que você
usa pra entrar no site) em `PAINEL_BKO_USUARIO` / `PAINEL_BKO_SENHA`, no
backend (Render).

**Importante:** isso dá pra Márcia o MESMO poder que você tem logado como
supervisor — ela decide contestação (afeta comissão de alguém de verdade),
não é só consulta. Não compartilha esse `.env`/essas variáveis do Render
com mais ninguém, e troca a senha se algum dia desconfiar que vazou.

As ações disponíveis hoje: ver contestações pendentes, aprovar/recusar
uma, ver o ranking, listar cust codes por status, ver o progresso de
reagendamento da equipe, listar os BKOs, e disparar uma consulta de CNPJ
no Crivo (precisa ter algum computador da equipe com a extensão Crivo
ativa numa aba do Easy Vendas, senão ela fica esperando sem resposta).
Ela sempre confirma qual contestação e qual decisão antes de executar de
verdade.

## O que já dá pra fazer / o que falta

**Já funciona:**
- Conversar por voz, nos dois aparelhos, com memória da conversa
- Criar, listar e apagar notas
- Agendar lembretes, com notificação push de verdade quando vencem
- Mandar e-mail (com confirmação antes)
- Mandar mensagem no WhatsApp: **no Mac, sozinha de verdade** (abre o
  WhatsApp Desktop e aperta Enter); **no iPhone, deixa pronta** pra você
  conferir e apertar enviar
- Painel BKO: ver contestações pendentes, aprovar/recusar (com
  confirmação antes), ver ranking, listar cust codes, ver reagendamentos
  da equipe, listar BKOs, disparar consulta de CNPJ no Crivo
- RSA + P2B (só no Mac): abre o app RSA, tenta selecionar a matrícula
  falada, copia o código gerado, e abre o login do P2B — **melhor
  esforço** (veja o aviso logo abaixo)
- Uma tela animada (orbe pulsante) mostrando o que ela ouviu/respondeu,
  servida pelo próprio backend em `/tela` — abre sozinha com o `jarvis.py`,
  ou via "Ei Siri, Márcia" no Mac (veja a seção "A tela animada")

**Por que no iPhone ela não manda sozinha:** o app Atalhos (Siri) não tem
nenhum jeito de simular um toque no botão Enviar — só o Mac permite isso,
usando um recurso do próprio macOS (Acessibilidade) pra controlar o
WhatsApp Desktop como se fosse você apertando Enter. Não é falta de
esforço, é uma parede real do iPhone.

**Permissão necessária no Mac (só na primeira vez):** quando ela tentar
mandar a primeira mensagem (ou abrir o RSA), o macOS vai pedir permissão
de **Acessibilidade** pro Terminal (ou o app que você usa pra rodar o
`jarvis.py`) controlar outros aplicativos — sem autorizar isso, os apps
abrem mas ela não consegue clicar/digitar sozinha neles (segue
funcionando o resto todo normal). Autoriza em **Ajustes do Sistema →
Privacidade e Segurança → Acessibilidade**.

**Sobre o RSA + P2B — é mesmo "melhor esforço":** eu nunca vi o app RSA
nem a tela de login do P2B de verdade, então essa automação (achar e
clicar na matrícula certa) é genérica — procura, em TUDO que aparece na
tela do RSA, um botão/texto que contenha o nome/número que você falou, e
clica nele. Pode não achar nada (aí não clica em nada, sem avisar) ou
achar a coisa errada. **Sempre confere na tela se selecionou a matrícula
certa antes de usar o código copiado.** Ela também não preenche usuário
nem senha no P2B sozinha — só deixa a tela de login aberta e o código no
clipboard, pra você colar. Se não funcionar bem no seu Mac, me conta o
que aconteceu (ou manda um print) que eu ajusto.

**Ainda não tem — e por quê:**
- **Mais ações no Painel BKO** (ex: ativar/desativar um BKO, mudar a
  planilha do Portal Parcelamento, editar comissão): a conexão já existe
  — cada uma dessas é só mais uma função em `painel-bko.js` + uma
  ferramenta em `ferramentas.js`. Me fala quais você quer primeiro.
- **Modo "sempre ouvindo"** (sem precisar chamar "Ei Siri" nem apertar
  Enter): precisa de um app de verdade rodando em segundo plano nos dois
  aparelhos — é o passo natural depois que o resto estiver redondo.

Cada ferramenta nova é só mais uma função no backend (`ferramentas.js`) —
o Mac e o iPhone não precisam mudar quando isso acontecer.
