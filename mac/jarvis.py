#!/usr/bin/env python3
"""
Márcia — cliente de voz pro Mac.

Aperta Enter pra começar a gravar, fala, aperta Enter de novo pra parar.
O áudio vira texto (reconhecimento de voz gratuito do Google, sem chave
nem cadastro), o texto vai pro backend (que pergunta pra Claude), e a
resposta é falada em voz alta com o comando `say` do próprio macOS.

Requisitos (uma vez só) — tudo via pip, sem precisar de Homebrew:
  pip install -r requirements.txt
  cp .env.example .env   # e preenche as chaves
"""

import os
import subprocess
import sys
import tempfile
import time
import urllib.parse
import wave

import numpy as np
import requests
import sounddevice as sd
import speech_recognition as sr
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")
JARVIS_SECRET = os.environ.get("JARVIS_SECRET", "")
VOZ = os.environ.get("JARVIS_VOZ", "Luciana")  # voz em pt-BR já instalada no macOS
ESPERA_WHATSAPP_SEGUNDOS = float(os.environ.get("ESPERA_WHATSAPP_SEGUNDOS", "3.5"))
ESPERA_RSA_ABRIR_SEGUNDOS = float(os.environ.get("ESPERA_RSA_ABRIR_SEGUNDOS", "2"))
ESPERA_RSA_PASSO_SEGUNDOS = float(os.environ.get("ESPERA_RSA_PASSO_SEGUNDOS", "0.8"))

if not BACKEND_URL:
    sys.exit("Falta BACKEND_URL no .env — veja .env.example.")


def falar(texto):
    subprocess.run(["say", "-v", VOZ, texto])


def gravar_audio(caminho_wav):
    # Grava com sounddevice (pip puro, sem precisar de Homebrew nem de
    # nenhum programa externo) — acumula os pedaços de áudio num callback
    # até apertar Enter de novo, depois salva como .wav com o módulo
    # `wave` (já vem com o Python, não precisa instalar nada a mais).
    print("🎙️  Gravando... aperta Enter de novo pra parar.")
    TAXA = 16000
    pedacos = []

    def callback(indata, frames_count, time_info, status):
        pedacos.append(indata.copy())

    with sd.InputStream(samplerate=TAXA, channels=1, dtype="int16", callback=callback):
        input()

    audio = np.concatenate(pedacos, axis=0) if pedacos else np.zeros((0, 1), dtype="int16")
    with wave.open(caminho_wav, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # int16 = 2 bytes
        wf.setframerate(TAXA)
        wf.writeframes(audio.tobytes())


def transcrever(caminho_wav):
    # Reconhecimento de voz gratuito do Google (via lib SpeechRecognition)
    # — sem chave, sem cadastro, sem custo. Qualidade um pouco abaixo do
    # Whisper pra frases complexas, mas funciona bem pra comandos do dia
    # a dia. Se não entender nada, devolve string vazia (tratado como
    # "tenta de novo" lá no laço principal).
    reconhecedor = sr.Recognizer()
    with sr.AudioFile(caminho_wav) as fonte:
        audio = reconhecedor.record(fonte)
    try:
        return reconhecedor.recognize_google(audio, language="pt-BR").strip()
    except sr.UnknownValueError:
        return ""


def perguntar_jarvis(texto):
    resp = requests.post(
        f"{BACKEND_URL}/falar",
        headers={"x-jarvis-key": JARVIS_SECRET},
        json={"texto": texto, "dispositivo": "mac"},
        timeout=60,
    )
    resp.raise_for_status()
    corpo = resp.json()
    return corpo["resposta"], corpo.get("acoes") or []


def enviar_whatsapp_mac(telefone, mensagem):
    # whatsapp:// abre o app Desktop do WhatsApp direto na conversa já
    # com o texto digitado (mais confiável que o link wa.me pra isso,
    # que pode cair no navegador em vez do app). Depois de dar um tempo
    # pra carregar, simula a tecla Enter de verdade com o "System
    # Events" do macOS — a MESMA coisa que você apertar Enter na mão.
    #
    # Na primeira vez, o macOS vai pedir permissão de Acessibilidade
    # pro Terminal (ou o app que estiver rodando este script) controlar
    # outros aplicativos — sem isso o envio automático não funciona,
    # mas o resto da Márcia continua normal.
    url = f"whatsapp://send?phone={telefone}&text={urllib.parse.quote(mensagem)}"
    subprocess.run(["open", url])
    time.sleep(ESPERA_WHATSAPP_SEGUNDOS)
    subprocess.run([
        "osascript",
        "-e", 'tell application "WhatsApp" to activate',
        "-e", 'tell application "System Events" to keystroke return',
    ])


def _escapar_applescript(texto):
    return texto.replace("\\", "\\\\").replace('"', '\\"')


def _osascript(script):
    subprocess.run(["osascript", "-e", script])


def abrir_rsa_e_copiar_codigo(matricula):
    # MELHOR ESFORÇO — nunca vimos o app RSA de verdade (nome, botões e
    # layout exatos), então isso é uma automação genérica: tenta clicar
    # no primeiro botão da janela (pra abrir a lista de matrículas) e
    # depois procura, em TODOS os elementos da tela, um cujo nome ou
    # valor contenha o texto da matrícula falada, clicando nele. Se não
    # achar nada com esse nome, a automação simplesmente não clica em
    # nada (sem erro visível) — por isso é importante CONFERIR na tela
    # se selecionou a matrícula certa antes de usar o código.
    #
    # Se isso não funcionar direito no seu Mac, me manda o que aconteceu
    # (ou mesmo um print da tela do RSA) que eu ajusto os seletores —
    # mesmo processo que usamos pras telas do Portal Parcelamento.
    subprocess.run(["open", "-a", "RSA"])
    time.sleep(ESPERA_RSA_ABRIR_SEGUNDOS)

    _osascript('''
    tell application "System Events"
      tell process "RSA"
        set frontmost to true
        try
          click button 1 of window 1
        on error
          try
            click pop up button 1 of window 1
          on error
            try
              click menu button 1 of window 1
            end try
          end try
        end try
      end tell
    end tell
    ''')
    time.sleep(ESPERA_RSA_PASSO_SEGUNDOS)

    alvo = _escapar_applescript(matricula)
    _osascript(f'''
    tell application "System Events"
      tell process "RSA"
        repeat with el in (entire contents of window 1)
          set nomeEl to ""
          set valorEl to ""
          try
            set nomeEl to (name of el as string)
          end try
          try
            set valorEl to (value of el as string)
          end try
          if (nomeEl contains "{alvo}") or (valorEl contains "{alvo}") then
            click el
            exit repeat
          end if
        end repeat
      end tell
    end tell
    ''')
    time.sleep(ESPERA_RSA_PASSO_SEGUNDOS)

    _osascript('''
    tell application "RSA" to activate
    tell application "System Events" to keystroke "c" using command down
    ''')


def executar_acoes(acoes):
    for acao in acoes:
        tipo = acao.get("tipo")
        if tipo == "whatsapp" and acao.get("telefone") and acao.get("mensagem"):
            enviar_whatsapp_mac(acao["telefone"], acao["mensagem"])
        elif tipo == "rsa_p2b" and acao.get("matricula"):
            abrir_rsa_e_copiar_codigo(acao["matricula"])
            if acao.get("url"):
                subprocess.run(["open", acao["url"]])
        elif tipo == "abrir_url" and acao.get("url"):
            # `open` é o comando nativo do macOS que abre qualquer link
            # com o app certo, igual dar dois cliques.
            subprocess.run(["open", acao["url"]])


def abrir_tela():
    # Abre a tela animada (backend/tela/index.html, servida pelo próprio
    # backend em /tela) no navegador padrão, já passando a URL e a chave
    # pela query string — ela salva sozinha e não pergunta de novo.
    url = f"{BACKEND_URL}/tela?backend={urllib.parse.quote(BACKEND_URL)}&chave={urllib.parse.quote(JARVIS_SECRET)}"
    subprocess.run(["open", url])


def tocar_musica_abertura():
    # Opcional — só roda se SPOTIFY_URI_ABERTURA estiver no .env. Abre o
    # Spotify, toca a faixa, e pula pro meio dela (calcula a duração de
    # verdade da música, não é um tempo fixo chutado).
    uri = os.environ.get("SPOTIFY_URI_ABERTURA", "").strip()
    if not uri:
        return
    subprocess.run(["osascript", "-e", f'''
    tell application "Spotify"
      activate
      play track "{uri}"
      delay 2
      set trackDuration to duration of current track
      set player position to (trackDuration / 1000 / 2)
    end tell
    '''])


def main():
    print("Márcia (Mac) — aperta Enter pra falar com ela. Ctrl+C pra sair.\n")
    abrir_tela()
    tocar_musica_abertura()
    while True:
        try:
            input("Aperta Enter pra gravar...")
        except (KeyboardInterrupt, EOFError):
            print("\nAté mais.")
            return

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            caminho = tmp.name

        try:
            gravar_audio(caminho)
            texto = transcrever(caminho)
            if not texto:
                print("(não entendi nada, tenta de novo)")
                continue
            print(f"Você: {texto}")

            resposta, acoes = perguntar_jarvis(texto)
            print(f"Márcia: {resposta}")
            falar(resposta)
            executar_acoes(acoes)
        except requests.HTTPError as err:
            print(f"Erro de rede: {err}")
        except sr.RequestError as err:
            print(f"Erro no serviço de reconhecimento de voz: {err} — tenta de novo.")
        finally:
            os.remove(caminho)


if __name__ == "__main__":
    main()
