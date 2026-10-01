# Márcia no iPhone (Atalhos / Siri)

Não precisa instalar nenhum app — só montar um Atalho no app **Atalhos**
(já vem no iPhone), em uns 5 minutos.

## Montar o Atalho

1. Abre o app **Atalhos** → aba **Meus Atalhos** → **+** (novo atalho).
2. Renomeia pra **Márcia** (toca nos três pontinhos → nome).
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

## Deixar ela abrir o WhatsApp pronto (opcional)

Quando você pede pra ela mandar uma mensagem no WhatsApp, o backend
devolve um link pronto (com o número e o texto já preenchidos) — só
falta o Atalho abrir esse link. Adiciona mais essas ações, depois da
"Falar Texto" (passo d acima):

   **e) Obter Valor de Dicionário**
   - Obter o valor de: `acoes`
   - Em: **Conteúdo de URL** (a mesma da ação b)

   **f) Se (If)**
   - Condição: a ação anterior **tem algum valor** / não está vazia

   **g) (dentro do Se) Obter Valor de Dicionário**
   - Obter o valor de: `url`
   - Em: primeiro item de **acoes** (o Atalhos deixa escolher "Item 1")

   **h) (dentro do Se) Abrir URLs**
   - URLs: o valor obtido na ação g

Isso abre o app do WhatsApp (ou o WhatsApp Web, se não tiver o app) já
com a conversa e a mensagem prontas — você só confere e aperta enviar.

## Ativar só falando o nome dela

Configurações do Atalho (os três pontinhos) → liga **"Adicionar à Siri"** →
grava a frase **"Márcia"**. A partir daí é **"Ei Siri, Márcia"** e já pode
falar — a Siri entende o nome dela como gatilho.

(O "Ei Siri" na frente não dá pra tirar — é assim que todo atalho da Siri
funciona no iPhone, não é uma limitação só da Márcia. Sem isso o iPhone
precisaria ficar com o microfone sempre ligado ouvindo tudo o tempo todo,
o que a Apple não permite pra apps/atalhos de terceiros.)

Também dá pra adicionar o atalho na **Tela de Início** ou no **Botão de
Ação** (se o modelo tiver), pra abrir com um toque sem precisar falar nada.

## Limitação da v1

Fora isso, não tem "sempre ouvindo" — cada vez que quiser falar com ela,
chama pela Siri (ou toca no atalho). Um modo "sempre ligado", sem nem
precisar do "Ei Siri", dá pra fazer depois, mas exige um app de verdade
(publicado ou instalado manualmente) rodando em segundo plano — por
enquanto esse é o jeito que funciona sem programar e publicar um app na
App Store.
