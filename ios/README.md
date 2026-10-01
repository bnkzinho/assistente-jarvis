# Jarvis no iPhone (Atalhos / Siri)

Não precisa instalar nenhum app — só montar um Atalho no app **Atalhos**
(já vem no iPhone), em uns 5 minutos.

## Montar o Atalho

1. Abre o app **Atalhos** → aba **Meus Atalhos** → **+** (novo atalho).
2. Renomeia pra **Jarvis** (toca nos três pontinhos → nome).
3. Adiciona essas ações, nessa ordem:

   **a) Ditar Texto**
   - Idioma: Português (Brasil)

   **b) Obter Conteúdo de URL**
   - URL: `https://SEU-BACKEND.onrender.com/falar` (a URL do backend publicado)
   - Método: `POST`
   - Cabeçalhos (Headers):
     - `Content-Type` → `application/json`
     - `x-jarvis-key` → a mesma chave que você colocou em `JARVIS_SECRET` no backend
   - Corpo da Requisição (Request Body): **JSON**
     - campo `texto` → valor: **Texto Ditado** (a variável da ação anterior)
     - campo `dispositivo` → valor: `iphone`

   **c) Obter Valor de Dicionário**
   - Obter o valor de: `resposta`
   - Em: **Conteúdo de URL** (resultado da ação anterior)

   **d) Falar Texto**
   - Texto: o valor obtido na ação anterior

4. Pronto — toca em **Concluído**.

## Deixar rápido de usar

- **Pela Siri:** Configurações do Atalho (os três pontinhos) → liga "Adicionar
  à Siri" → grava uma frase, tipo "Ei Jarvis". Depois é só "Ei Siri, Jarvis"
  e falar.
- **Botão de Ação / Tela de Início** (iPhone com Botão de Ação, ou qualquer
  modelo): adiciona o atalho lá pra abrir com um toque.

## Limitação da v1

Não tem "sempre ouvindo" — você precisa abrir o atalho (ou chamar pela
Siri) toda vez que quiser falar com ele. Um modo "sempre ligado" dá pra
fazer depois, mas exige mais (um app de verdade rodando em segundo
plano) — por enquanto esse é o jeito que funciona sem precisar programar
e publicar um app na App Store.
