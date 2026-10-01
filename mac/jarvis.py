#!/usr/bin/env python3
"""
Márcia — cliente de voz pro Mac.

Aperta Enter pra começar a gravar, fala, aperta Enter de novo pra parar.
O áudio vira texto (Whisper da OpenAI), o texto vai pro backend (que
pergunta pra Claude), e a resposta é falada em voz alta com o comando
`say` do próprio macOS.

Requisitos (uma vez só):
  brew install sox
  pip install -r requirements.txt
  cp .env.example .env   # e preenche as chaves
"""

import os
import subprocess
import sys
import tempfile

import requests
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")
JARVIS_SECRET = os.environ.get("JARVIS_SECRET", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
VOZ = os.environ.get("JARVIS_VOZ", "Luciana")  # voz em pt-BR já instalada no macOS

if not BACKEND_URL:
    sys.exit("Falta BACKEND_URL no .env — veja .env.example.")
if not OPENAI_API_KEY:
    sys.exit("Falta OPENAI_API_KEY no .env (usada só pra transcrever o áudio) — veja .env.example.")


def falar(texto):
    subprocess.run(["say", "-v", VOZ, texto])


def gravar_audio(caminho_wav):
    print("🎙️  Gravando... aperta Enter de novo pra parar.")
    processo = subprocess.Popen(["rec", "-q", caminho_wav, "rate", "16k", "channels", "1"])
    input()
    processo.terminate()
    processo.wait()


def transcrever(caminho_wav):
    with open(caminho_wav, "rb") as f:
        resp = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            files={"file": (os.path.basename(caminho_wav), f, "audio/wav")},
            data={"model": "whisper-1", "language": "pt"},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.json()["text"].strip()


def perguntar_jarvis(texto):
    resp = requests.post(
        f"{BACKEND_URL}/falar",
        headers={"x-jarvis-key": JARVIS_SECRET},
        json={"texto": texto, "dispositivo": "mac"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["resposta"]


def main():
    print("Márcia (Mac) — aperta Enter pra falar com ela. Ctrl+C pra sair.\n")
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

            resposta = perguntar_jarvis(texto)
            print(f"Márcia: {resposta}")
            falar(resposta)
        except requests.HTTPError as err:
            print(f"Erro de rede: {err}")
        finally:
            os.remove(caminho)


if __name__ == "__main__":
    main()
