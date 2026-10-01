# Jarvis — assistente pessoal com voz

v1: conversar por voz com a Claude, pelo Mac e pelo iPhone. É a base — notas,
lembretes, e-mail, WhatsApp e automações entram por cima disso depois.

## Como funciona

```
Mac (jarvis.py)  ──┐
                    ├──► backend (Node/Express) ──► Claude ──► resposta
iPhone (Atalho)  ──┘
```

Um backend só, publicado uma vez, atende os dois dispositivos. O Mac grava
o áudio e transcreve (Whisper) antes de mandar o texto; o iPhone já manda
texto direto (o próprio app Atalhos dita).

## 1. Publicar o backend

Precisa de uma URL pública (o iPhone não alcança seu Mac local).

1. Cria uma conta em [render.com](https://render.com) (tem plano grátis).
2. **New +** → **Web Service** → conecta este repositório → pasta raiz `backend/`.
3. Build command: `npm install` — Start command: `npm start`.
4. Em **Environment**, adiciona as variáveis (veja `backend/.env.example`):
   - `ANTHROPIC_API_KEY` — sua chave da Anthropic ([console.anthropic.com](https://console.anthropic.com))
   - `JARVIS_SECRET` — inventa uma senha longa qualquer (ex: gerada em
     [1password.com/password-generator](https://1password.com/password-generator))
   - `CLAUDE_MODEL` — pode deixar `claude-sonnet-5`
5. Deploy. Guarda a URL que o Render te dá (tipo `https://jarvis-xxxx.onrender.com`).

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

Aperta Enter, fala, aperta Enter de novo — ele responde em voz.

**Por que precisa de uma chave da OpenAI também:** a Claude não transcreve
áudio — só texto. O Whisper (OpenAI) faz só essa parte (ouvir e virar
texto); quem responde de verdade continua sendo a Claude, lá no backend.
Pega a chave em [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
— custa centavos por minuto de áudio.

## 3. Configurar o iPhone

Veja o passo a passo em [`ios/README.md`](ios/README.md) — é só montar um
Atalho, sem instalar nada.

## O que já dá pra fazer / o que falta

**Já funciona na v1:** conversar por voz, nos dois aparelhos, com memória
da conversa (reseta se o backend reiniciar).

**Ainda não tem (próximos passos, por prioridade a combinar):**
- Notas e lembretes de verdade (hoje ele só conversa, não guarda nada)
- Mandar e-mail
- Mandar mensagem no WhatsApp
- Disparar as automações do Painel BKO (Crivo, Portal Parcelamento)
- Modo "sempre ouvindo" (hoje é só apertando Enter / chamando o Atalho)

Cada um desses é um pedaço novo de ferramenta que o backend ganha — o
Mac e o iPhone não precisam mudar quando isso acontecer.
