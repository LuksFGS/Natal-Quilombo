/* =====================================================================
   EDITOR VISUAL DO SITE — editor.js
   Permite editar textos, links, Pix, fotos e vídeos sem tocar em código.
   ===================================================================== */

(function () {
  const SENHA_EDITOR = "0000";
  const CHAVE_SESSAO_EDITOR = "natalQuilomboEditorAutenticado";
  const CHAVE_RASCUNHO = "natalQuilomboRascunho";
  let pastaRaiz = null;
  let abaGaleriaAtual = "entrega";
  let editorInicializado = false;
  const arquivosPendentes = new Map(); // "imagens/nome.jpg" -> File
  const previewsLocais = new Map();    // "imagens/nome.jpg" -> blob URL

  function clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function carregarEstadoInicial() {
    const base = clonar(CONFIG);
    try {
      const salvo = localStorage.getItem(CHAVE_RASCUNHO);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (parsed && typeof parsed === "object") {
          const merged = Object.assign({}, base, parsed);
          merged.pix = Object.assign({}, base.pix, parsed.pix || {});
          merged.numeros = Object.assign({}, base.numeros, parsed.numeros || {});
          merged.redes = Object.assign({}, base.redes, parsed.redes || {});
          merged.textos = Object.assign({}, base.textos, parsed.textos || {});
          merged.galeria = Object.assign({}, base.galeria, parsed.galeria || {});
          return merged;
        }
      }
    } catch (_) {}
    return base;
  }

  let estado = carregarEstadoInicial();

  /* -------------------------------------------------------------------
     UTILITÁRIOS
     ------------------------------------------------------------------- */
  const toastEl = document.getElementById("toast");
  let timerToast;
  function avisar(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("toast--visivel");
    clearTimeout(timerToast);
    timerToast = setTimeout(function () {
      toastEl.classList.remove("toast--visivel");
    }, 3400);
  }

  function limparNomeArquivo(nome) {
    const ponto = nome.lastIndexOf(".");
    const base = (ponto > 0 ? nome.slice(0, ponto) : nome)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "arquivo";
    const ext = ponto > 0 ? nome.slice(ponto).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
    return base + ext;
  }

  function extrairIdYouTube(entrada) {
    if (!entrada) return "";
    const texto = entrada.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(texto)) return texto;
    try {
      const url = new URL(texto);
      if (url.hostname.includes("youtu.be")) {
        return url.pathname.replace(/^\/+/, "").split("/")[0].slice(0, 11);
      }
      if (url.searchParams.get("v")) {
        return url.searchParams.get("v").slice(0, 11);
      }
      const partes = url.pathname.split("/").filter(Boolean);
      const idx = partes.findIndex(function (p) { return p === "shorts" || p === "embed" || p === "live"; });
      if (idx !== -1 && partes[idx + 1]) return partes[idx + 1].slice(0, 11);
    } catch (_) {}
    return "";
  }

  function srcParaPreview(caminho) {
    return previewsLocais.get(caminho) || caminho;
  }

  function registrarArquivoLocal(file, pasta) {
    const nomeLimpo = limparNomeArquivo(file.name);
    const destino = pasta + "/" + nomeLimpo;
    arquivosPendentes.set(destino, file);
    if (previewsLocais.has(destino)) {
      URL.revokeObjectURL(previewsLocais.get(destino));
    }
    previewsLocais.set(destino, URL.createObjectURL(file));
    return destino;
  }

  /* -------------------------------------------------------------------
     PREENCHER / LER CAMPOS DE FORMULÁRIO
     ------------------------------------------------------------------- */
  function vincularCampoTexto(id, getter, setter) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = getter() ?? "";
    el.addEventListener("input", function () {
      setter(el.value);
    });
  }

  function inicializarCampos() {
    vincularCampoTexto("cfg-nome", () => estado.nomeDaAcao, v => { estado.nomeDaAcao = v; });
    vincularCampoTexto("cfg-ano", () => estado.anoDeInicio, v => { estado.anoDeInicio = Number(v) || 2007; });
    vincularCampoTexto("cfg-criancas", () => estado.numeros.criancas, v => { estado.numeros.criancas = Number(v) || 0; });
    vincularCampoTexto("cfg-itens", () => estado.numeros.itens, v => { estado.numeros.itens = Number(v) || 0; });
    vincularCampoTexto("cfg-voluntarios", () => estado.numeros.voluntarios, v => { estado.numeros.voluntarios = Number(v) || 0; });

    vincularCampoTexto("cfg-pix-chave", () => estado.pix.chave, v => { estado.pix.chave = v; });
    vincularCampoTexto("cfg-pix-recebedor", () => estado.pix.recebedor, v => { estado.pix.recebedor = v; });
    vincularCampoTexto("cfg-pix-cidade", () => estado.pix.cidade, v => { estado.pix.cidade = v; });
    vincularCampoTexto("cfg-pix-img", () => estado.pix.imagemQrCode, v => { estado.pix.imagemQrCode = v; });

    vincularCampoTexto("cfg-vakinha", () => estado.vakinha, v => { estado.vakinha = v; });
    vincularCampoTexto("cfg-instagram", () => estado.redes.instagram, v => { estado.redes.instagram = v; });
    vincularCampoTexto("cfg-whatsapp", () => estado.redes.whatsapp, v => { estado.redes.whatsapp = v; });
    vincularCampoTexto("cfg-youtube", () => estado.redes.youtube, v => { estado.redes.youtube = v; });
    vincularCampoTexto("cfg-tiktok", () => estado.redes.tiktok, v => { estado.redes.tiktok = v; });

    vincularCampoTexto("cfg-capa", () => estado.capa, v => {
      estado.capa = v;
      document.getElementById("preview-capa").src = srcParaPreview(v || "imagens/capa.jpg");
    });
    document.getElementById("preview-capa").src = srcParaPreview(estado.capa || "imagens/capa.jpg");

    vincularCampoTexto("cfg-titulo-site", () => estado.textos.tituloSite, v => { estado.textos.tituloSite = v; });
    vincularCampoTexto("cfg-chamada", () => estado.textos.chamada, v => { estado.textos.chamada = v; });
    vincularCampoTexto("cfg-titulo-inicio", () => estado.textos.tituloInicio, v => { estado.textos.tituloInicio = v; });
    vincularCampoTexto("cfg-subtitulo-inicio", () => estado.textos.subtituloInicio, v => { estado.textos.subtituloInicio = v; });
    vincularCampoTexto("cfg-titulo-doar", () => estado.textos.tituloDoar, v => { estado.textos.tituloDoar = v; });
    vincularCampoTexto("cfg-texto-doar", () => estado.textos.textoDoar, v => { estado.textos.textoDoar = v; });
    vincularCampoTexto("cfg-obs-doar", () => estado.textos.obsDoar, v => { estado.textos.obsDoar = v; });
    vincularCampoTexto("cfg-titulo-sobre", () => estado.textos.tituloSobre, v => { estado.textos.tituloSobre = v; });
    vincularCampoTexto("cfg-sobre-1", () => estado.textos.sobreParagrafo1, v => { estado.textos.sobreParagrafo1 = v; });
    vincularCampoTexto("cfg-sobre-2", () => estado.textos.sobreParagrafo2, v => { estado.textos.sobreParagrafo2 = v; });

    if (!Array.isArray(estado.textos.etapas) || estado.textos.etapas.length < 3) {
      estado.textos.etapas = clonar(CONFIG.textos.etapas);
    }
    [0, 1, 2].forEach(function (idx) {
      const n = idx + 1;
      vincularCampoTexto("cfg-etapa-" + n + "-titulo", () => estado.textos.etapas[idx].titulo, v => { estado.textos.etapas[idx].titulo = v; });
      vincularCampoTexto("cfg-etapa-" + n + "-texto", () => estado.textos.etapas[idx].texto, v => { estado.textos.etapas[idx].texto = v; });
    });

    vincularCampoTexto("cfg-titulo-contato", () => estado.textos.tituloContato, v => { estado.textos.tituloContato = v; });
    vincularCampoTexto("cfg-texto-contato", () => estado.textos.textoContato, v => { estado.textos.textoContato = v; });
  }

  /* -------------------------------------------------------------------
     LISTA DE VALORES SUGERIDOS
     ------------------------------------------------------------------- */
  function renderValores() {
    const cont = document.getElementById("lista-valores-editor");
    cont.textContent = "";
    const lista = estado.textos.valoresDoacao || (estado.textos.valoresDoacao = []);

    lista.forEach(function (item, idx) {
      const row = document.createElement("div");
      row.className = "valor-linha";

      const inpVal = document.createElement("input");
      inpVal.type = "text";
      inpVal.placeholder = "Ex: R$ 20";
      inpVal.value = item.valor || "";
      inpVal.addEventListener("input", function () { item.valor = inpVal.value; });

      const inpDesc = document.createElement("input");
      inpDesc.type = "text";
      inpDesc.placeholder = "Descrição do que ajuda a comprar";
      inpDesc.value = item.descricao || "";
      inpDesc.addEventListener("input", function () { item.descricao = inpDesc.value; });

      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn btn--perigo btn--pequeno";
      btnDel.textContent = "Remover";
      btnDel.addEventListener("click", function () {
        lista.splice(idx, 1);
        renderValores();
      });

      row.appendChild(inpVal);
      row.appendChild(inpDesc);
      row.appendChild(btnDel);
      cont.appendChild(row);
    });
  }

  document.getElementById("btn-add-valor").addEventListener("click", function () {
    estado.textos.valoresDoacao.push({ valor: "R$ ", descricao: "" });
    renderValores();
  });

  const observadorVideosEditor = new IntersectionObserver(function (entradas, obs) {
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) return;
      const vid = entrada.target;
      if (vid.dataset.src && !vid.getAttribute("src")) {
        vid.src = vid.dataset.src;
      }
      obs.unobserve(vid);
    });
  }, { rootMargin: "120px" });

  /* -------------------------------------------------------------------
     RENDERIZAÇÃO DE LISTAS DE MÍDIA (CARROSSEL E GALERIA)
     ------------------------------------------------------------------- */
  function criarCardMidia(lista, idx, opcoes) {
    const item = lista[idx];
    const card = document.createElement("div");
    card.className = "item-midia";

    // Thumbnail
    const thumb = document.createElement("div");
    thumb.className = "item-midia__thumb";
    if (item.tipo === "youtube") {
      const ytId = extrairIdYouTube(item.id || item.src || "");
      const img = document.createElement("img");
      img.src = "https://img.youtube.com/vi/" + encodeURIComponent(ytId) + "/hqdefault.jpg";
      img.alt = item.legenda || "YouTube";
      thumb.appendChild(img);
    } else if (item.tipo === "video") {
      const vid = document.createElement("video");
      vid.dataset.src = srcParaPreview(item.src) + "#t=0.5";
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "metadata";
      thumb.appendChild(vid);
      observadorVideosEditor.observe(vid);
    } else {
      const img = document.createElement("img");
      img.src = srcParaPreview(item.src);
      img.alt = item.legenda || "Foto";
      thumb.appendChild(img);
    }

    // Informações + legenda editável
    const info = document.createElement("div");
    info.className = "item-midia__info";

    const meta = document.createElement("div");
    meta.className = "item-midia__meta";
    const badge = document.createElement("span");
    badge.className = "badge badge--" + item.tipo;
    badge.textContent = item.tipo === "youtube" ? "YouTube" : (item.tipo === "video" ? "Vídeo MP4" : "Foto");
    const arquivoTxt = document.createElement("span");
    arquivoTxt.textContent = item.tipo === "youtube" ? ("ID: " + (item.id || "")) : (item.src || "");
    meta.appendChild(badge);
    meta.appendChild(arquivoTxt);

    const inpLegenda = document.createElement("input");
    inpLegenda.type = "text";
    inpLegenda.placeholder = "Descrição / legenda da foto ou vídeo";
    inpLegenda.value = item.legenda || "";
    inpLegenda.addEventListener("input", function () {
      item.legenda = inpLegenda.value;
    });

    info.appendChild(meta);
    info.appendChild(inpLegenda);

    // Controles de ordem / exclusão
    const controles = document.createElement("div");
    controles.className = "item-midia__controles";

    const btnCima = document.createElement("button");
    btnCima.type = "button";
    btnCima.className = "btn btn--contorno btn--pequeno";
    btnCima.textContent = "↑ Subir";
    btnCima.disabled = idx === 0;
    btnCima.addEventListener("click", function () {
      const tmp = lista[idx - 1];
      lista[idx - 1] = lista[idx];
      lista[idx] = tmp;
      opcoes.rerender();
    });

    const btnBaixo = document.createElement("button");
    btnBaixo.type = "button";
    btnBaixo.className = "btn btn--contorno btn--pequeno";
    btnBaixo.textContent = "↓ Descer";
    btnBaixo.disabled = idx === lista.length - 1;
    btnBaixo.addEventListener("click", function () {
      const tmp = lista[idx + 1];
      lista[idx + 1] = lista[idx];
      lista[idx] = tmp;
      opcoes.rerender();
    });

    const btnExcluir = document.createElement("button");
    btnExcluir.type = "button";
    btnExcluir.className = "btn btn--perigo btn--pequeno";
    btnExcluir.textContent = "🗑️ Excluir";
    btnExcluir.addEventListener("click", function () {
      lista.splice(idx, 1);
      opcoes.rerender();
    });

    controles.appendChild(btnCima);
    controles.appendChild(btnBaixo);
    controles.appendChild(btnExcluir);

    card.appendChild(thumb);
    card.appendChild(info);
    card.appendChild(controles);
    return card;
  }

  function renderCarrossel() {
    const cont = document.getElementById("lista-carrossel");
    cont.textContent = "";
    const lista = estado.carrossel || (estado.carrossel = []);
    if (lista.length === 0) {
      cont.innerHTML = '<p style="color:#6A5A4F;">Nenhum item no carrossel ainda.</p>';
      return;
    }
    lista.forEach(function (_, idx) {
      cont.appendChild(criarCardMidia(lista, idx, { rerender: renderCarrossel }));
    });
  }

  function atualizarContadoresGaleria() {
    document.getElementById("count-entrega").textContent = (estado.galeria.entrega || []).length;
    document.getElementById("count-montagem").textContent = (estado.galeria.montagem || []).length;
    document.getElementById("count-videos").textContent = (estado.galeria.videos || []).length;
  }

  function renderGaleria() {
    atualizarContadoresGaleria();
    const cont = document.getElementById("lista-galeria");
    cont.textContent = "";
    const lista = estado.galeria[abaGaleriaAtual] || (estado.galeria[abaGaleriaAtual] = []);
    if (lista.length === 0) {
      cont.innerHTML = '<p style="color:#6A5A4F;">Esta aba está vazia. Adicione fotos ou vídeos acima.</p>';
      return;
    }
    lista.forEach(function (_, idx) {
      cont.appendChild(criarCardMidia(lista, idx, { rerender: renderGaleria }));
    });
  }

  /* -------------------------------------------------------------------
     ADICIONAR FOTOS / VÍDEOS / YOUTUBE
     ------------------------------------------------------------------- */
  function configurarAdicaoMidia(btnFoto, inputFoto, btnVideo, inputVideo, btnYt, obterLista, rerender) {
    document.getElementById(btnFoto).addEventListener("click", function () {
      document.getElementById(inputFoto).click();
    });
    document.getElementById(inputFoto).addEventListener("change", function (ev) {
      const arquivos = Array.from(ev.target.files || []);
      arquivos.forEach(function (file) {
        const destino = registrarArquivoLocal(file, "imagens");
        obterLista().push({ tipo: "foto", src: destino, legenda: "" });
      });
      ev.target.value = "";
      rerender();
      if (arquivos.length) {
        avisar(pastaRaiz
          ? "Foto adicionada! Clique em 'Salvar na pasta' para gravar."
          : "Foto adicionada! Conecte a pasta (ou copie para imagens/) e salve.");
      }
    });

    document.getElementById(btnVideo).addEventListener("click", function () {
      document.getElementById(inputVideo).click();
    });
    document.getElementById(inputVideo).addEventListener("change", function (ev) {
      const arquivos = Array.from(ev.target.files || []);
      arquivos.forEach(function (file) {
        const destino = registrarArquivoLocal(file, "videos");
        obterLista().push({ tipo: "video", src: destino, legenda: "" });
      });
      ev.target.value = "";
      rerender();
      if (arquivos.length) {
        avisar(pastaRaiz
          ? "Vídeo adicionado! Clique em 'Salvar na pasta' para gravar."
          : "Vídeo adicionado! Conecte a pasta (ou copie para videos/) e salve.");
      }
    });

    document.getElementById(btnYt).addEventListener("click", function () {
      const link = window.prompt("Cole o link do vídeo no YouTube (ou apenas o código de 11 letras):");
      if (!link) return;
      const ytId = extrairIdYouTube(link);
      if (!ytId) {
        avisar("Link do YouTube inválido. Tente copiar a URL completa do vídeo.");
        return;
      }
      obterLista().push({ tipo: "youtube", id: ytId, legenda: "" });
      rerender();
      avisar("Vídeo do YouTube adicionado!");
    });
  }

  configurarAdicaoMidia(
    "carrossel-add-foto", "input-carrossel-foto",
    "carrossel-add-video", "input-carrossel-video",
    "carrossel-add-yt",
    () => estado.carrossel,
    renderCarrossel
  );

  configurarAdicaoMidia(
    "galeria-add-foto", "input-galeria-foto",
    "galeria-add-video", "input-galeria-video",
    "galeria-add-yt",
    () => estado.galeria[abaGaleriaAtual],
    renderGaleria
  );

  // Trocar foto da capa
  document.getElementById("btn-trocar-capa").addEventListener("click", function () {
    document.getElementById("input-capa").click();
  });
  document.getElementById("input-capa").addEventListener("change", function (ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const destino = registrarArquivoLocal(file, "imagens");
    estado.capa = destino;
    document.getElementById("cfg-capa").value = destino;
    document.getElementById("preview-capa").src = srcParaPreview(destino);
    ev.target.value = "";
    avisar("Nova capa selecionada!");
  });

  /* -------------------------------------------------------------------
     TROCA DE ABAS
     ------------------------------------------------------------------- */
  document.querySelectorAll(".aba").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".aba").forEach(a => a.classList.remove("aba--ativa"));
      document.querySelectorAll(".painel").forEach(p => p.classList.remove("painel--ativo"));
      btn.classList.add("aba--ativa");
      document.getElementById("painel-" + btn.dataset.painel).classList.add("painel--ativo");
    });
  });

  document.querySelectorAll(".sub-aba").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".sub-aba").forEach(a => a.classList.remove("sub-aba--ativa"));
      btn.classList.add("sub-aba--ativa");
      abaGaleriaAtual = btn.dataset.galeria;
      renderGaleria();
    });
  });

  /* -------------------------------------------------------------------
     GERAR ARQUIVO js/config.js
     ------------------------------------------------------------------- */
  function gerarTextoConfigJs() {
    return [
      "/* =====================================================================",
      "   CONFIGURAÇÕES DO SITE — Gerado pelo editor.html",
      "   ===================================================================== */",
      "",
      "const CONFIG = " + JSON.stringify(estado, null, 2) + ";",
      ""
    ].join("\n");
  }

  /* -------------------------------------------------------------------
     CONECTAR PASTA E SALVAR DIRETO NO DISCO (Chrome / Edge)
     ------------------------------------------------------------------- */
  const statusPasta = document.getElementById("status-pasta");
  const btnSalvarPasta = document.getElementById("btn-salvar-pasta");

  document.getElementById("btn-conectar").addEventListener("click", async function () {
    if (!window.showDirectoryPicker) {
      avisar("Seu navegador ou modo atual (arquivo local) não suporta salvar direto na pasta. Use 'Baixar config.js' ou abra pelo servidor/Chrome.");
      return;
    }
    try {
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      try {
        await dir.getFileHandle("index.html");
      } catch (_) {
        avisar("Escolha a pasta principal do site (onde está o arquivo index.html).");
        return;
      }
      pastaRaiz = dir;
      btnSalvarPasta.disabled = false;
      statusPasta.textContent = "✓ Pasta conectada: " + dir.name + " (pronto para salvar direto!)";
      statusPasta.classList.add("status-pasta--ok");
      avisar("Pasta conectada com sucesso!");
    } catch (err) {
      if (err && err.name !== "AbortError") {
        avisar("Não foi possível acessar a pasta: " + err.message);
      }
    }
  });

  async function escreverArquivoNaPasta(raiz, caminhoRelativo, conteudo) {
    const partes = caminhoRelativo.split("/");
    let atual = raiz;
    for (let i = 0; i < partes.length - 1; i++) {
      atual = await atual.getDirectoryHandle(partes[i], { create: true });
    }
    const fh = await atual.getFileHandle(partes[partes.length - 1], { create: true });
    const writable = await fh.createWritable();
    await writable.write(conteudo);
    await writable.close();
  }

  async function salvarNaPastaConectada() {
    if (!pastaRaiz) return false;
    btnSalvarPasta.disabled = true;
    try {
      for (const [destino, file] of arquivosPendentes.entries()) {
        await escreverArquivoNaPasta(pastaRaiz, destino, file);
      }
      await escreverArquivoNaPasta(pastaRaiz, "js/config.js", gerarTextoConfigJs());
      arquivosPendentes.clear();
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado));
      avisar("✓ Tudo salvo na pasta (config.js + fotos/vídeos novos)!");
      return true;
    } catch (err) {
      avisar("Erro ao salvar na pasta: " + err.message);
      return false;
    } finally {
      btnSalvarPasta.disabled = false;
    }
  }

  async function salvarGeral() {
    if (pastaRaiz) {
      await salvarNaPastaConectada();
      return;
    }
    try {
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado));
      avisar("Alterações Salvas!");
    } catch (_) {
      avisar("Não foi possível salvar no navegador.");
    }
  }

  btnSalvarPasta.addEventListener("click", salvarNaPastaConectada);
  document.getElementById("btn-salvar-topo").addEventListener("click", salvarGeral);
  document.getElementById("btn-salvar-publicar").addEventListener("click", salvarGeral);

  /* -------------------------------------------------------------------
     BAIXAR config.js (funciona em qualquer navegador)
     ------------------------------------------------------------------- */
  document.getElementById("btn-baixar").addEventListener("click", function () {
    const blob = new Blob([gerarTextoConfigJs()], { type: "application/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    localStorage.removeItem(CHAVE_RASCUNHO);

    if (arquivosPendentes.size > 0) {
      const nomes = Array.from(arquivosPendentes.keys()).join(", ");
      avisar("config.js baixado! Copie para js/config.js e coloque os arquivos novos em: " + nomes);
    } else {
      avisar("✓ config.js baixado! Substitua o arquivo js/config.js na pasta do site.");
    }
  });

  /* -------------------------------------------------------------------
     TESTAR NO SITE (rascunho no navegador)
     ------------------------------------------------------------------- */
  function testarNoSite() {
    try {
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado));
      if (arquivosPendentes.size > 0 && !pastaRaiz) {
        avisar("Abrindo prévia! Arquivos novos do PC só aparecem após salvar na pasta.");
      }
      window.open("index.html?rascunho=1", "_blank", "noopener");
    } catch (err) {
      avisar("Não foi possível salvar o rascunho no navegador.");
    }
  }

  document.getElementById("btn-testar").addEventListener("click", testarNoSite);
  document.getElementById("btn-testar-publicar").addEventListener("click", testarNoSite);

  document.getElementById("btn-limpar-rascunho").addEventListener("click", function () {
    localStorage.removeItem(CHAVE_RASCUNHO);
    arquivosPendentes.clear();
    estado = clonar(CONFIG);
    inicializarCampos();
    renderValores();
    renderCarrossel();
    renderGaleria();
    avisar("Rascunho descartado. Dados recarregados do js/config.js atual.");
  });

  /* -------------------------------------------------------------------
     CONTROLE DE ACESSO (SENHA) E INICIALIZAÇÃO
     ------------------------------------------------------------------- */
  const telaSenha = document.getElementById("tela-senha");
  const conteudoEditor = document.getElementById("conteudo-editor");
  const formSenha = document.getElementById("form-senha");
  const inputSenha = document.getElementById("input-senha");
  const erroSenha = document.getElementById("erro-senha");

  function desbloquearEditor() {
    telaSenha.hidden = true;
    conteudoEditor.hidden = false;
    if (!editorInicializado) {
      editorInicializado = true;
      inicializarCampos();
      renderValores();
      renderCarrossel();
      renderGaleria();
    }
  }

  function bloquearEditor() {
    sessionStorage.removeItem(CHAVE_SESSAO_EDITOR);
    conteudoEditor.hidden = true;
    telaSenha.hidden = false;
    inputSenha.value = "";
    erroSenha.hidden = true;
    inputSenha.focus();
  }

  formSenha.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (inputSenha.value.trim() === SENHA_EDITOR) {
      sessionStorage.setItem(CHAVE_SESSAO_EDITOR, "1");
      erroSenha.hidden = true;
      desbloquearEditor();
    } else {
      erroSenha.hidden = false;
      inputSenha.select();
    }
  });

  inputSenha.addEventListener("input", function () {
    if (!erroSenha.hidden) erroSenha.hidden = true;
  });

  document.getElementById("btn-bloquear").addEventListener("click", bloquearEditor);

  if (sessionStorage.getItem(CHAVE_SESSAO_EDITOR) === "1") {
    desbloquearEditor();
  } else {
    inputSenha.focus();
  }
})();
