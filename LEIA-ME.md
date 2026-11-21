# 🎄 Site — Natal Quilombo (Vale do Ribeira)

Site de uma página só (com rolagem), feito com HTML, CSS e JavaScript puros.
Inclui o **`editor.html`** para que qualquer pessoa possa trocar fotos, vídeos, textos e links sem mexer em código!

## ✏️ Jeito mais fácil de editar (sem mexer em código)

1. Abra o site pelo servidor local (ex: `http://localhost:5500/editor.html`) ou abra o arquivo **`editor.html`** no Chrome ou Edge.
2. Clique em **📁 Conectar pasta do site** e selecione a pasta `site-natal-solidario`.
3. Edite os links (Pix, Vakinha, Instagram, WhatsApp), textos, fotos e vídeos nas abas do editor.
4. Clique em **💾 Salvar na pasta** (ele já copia as novas fotos/vídeos para `imagens/` e `videos/` e atualiza o `js/config.js`).
   - Se preferir ou usar outro navegador, clique em **⬇️ Baixar config.js**, substitua o arquivo `js/config.js` e coloque os novos arquivos em `imagens/` ou `videos/`.

## 📁 Estrutura de arquivos

```
site-natal-solidario/
├── index.html          → página principal do site
├── editor.html         → painel visual para trocar links, textos, fotos e vídeos
├── css/style.css       → cores, fontes e layout
├── js/config.js        → todos os dados (links, Pix, textos, carrossel e galeria)
├── js/script.js        → funcionamento do site (QR Code Pix, carrossel, galeria)
├── js/editor.js        → funcionamento do editor visual
├── js/vendor/qrcode.js → biblioteca do QR Code Pix
├── imagens/            → fotos (.jpg / .png / .webp)
└── videos/             → vídeos (.mp4)
```

## 🎬 Dicas para fotos e vídeos
- **Fotos:** use JPG com até ~1600px de largura para carregar rápido no celular.
- **Vídeos:** prefira arquivos `.mp4` (H.264) curtos com até ~20 MB cada, ou suba vídeos longos no **YouTube** e cole o link direto no `editor.html` (*+ Adicionar YouTube*).

## 💸 Pix e Vakinha
- A chave Pix configurada é `+5511976226299` (exibida como `(11) 97622-6299`).
- **Importante:** confira em `js/config.js` (ou no `editor.html`) os campos `recebedor` (nome do titular da conta bancária) e `cidade`, e faça um teste com Pix de R$ 1,00 antes de divulgar.

## 🚀 Como publicar grátis

### Netlify Drop (mais fácil)
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `site-natal-solidario` inteira para a página.
3. Pronto! Para atualizar depois, edite pelo `editor.html`, salve na pasta e arraste a pasta de novo em *Deploys*.

### Vercel ou GitHub Pages
1. Suba a pasta `site-natal-solidario` para um repositório no GitHub.
2. Ative o GitHub Pages ou conecte o repositório na Vercel (sem configuração extra).
