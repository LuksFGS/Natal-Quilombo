/* =====================================================================
   EDITOR VISUAL DO SITE — editor.js
   Permite editar textos, links, Pix, fotos e vídeos sem tocar em código,
   salvando tanto no servidor/nuvem (para todos os aparelhos) quanto local.
   ===================================================================== */

(function () {
  const SENHA_EDITOR = "0000";
  const CHAVE_SESSAO_EDITOR = "natalQuilomboEditorAutenticado";
  const CHAVE_RASCUNHO = "natalQuilomboRascunho";
  const NOME_BANCO = "natalQuilomboMidiaDB";
  const STORE_MIDIA = "arquivos";

  let pastaRaiz = null;
  let abaGaleriaAtual = "entrega";
  let editorInicializado = false;
  const arquivosPendentes = new Map(); // "imagens/nome.jpg" -> Blob
  const previewsLocais = new Map();    // "imagens/nome.jpg" -> blob URL

  function clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mesclarConfig(base, novo) {
    if (!novo || typeof novo !== "object") return clonar(base);
    const merged = Object.assign({}, clonar(base), clonar(novo));
    merged.pix = Object.assign({}, base.pix, novo.pix || {});
    merged.numeros = Object.assign({}, base.numeros, novo.numeros || {});
    merged.redes = Object.assign({}, base.redes, novo.redes || {});
    merged.textos = Object.assign({}, base.textos, novo.textos || {});
    merged.galeria = Object.assign({}, base.galeria, novo.galeria || {});
    return merged;
  }

  function carregarEstadoInicial() {
    const base = clonar(CONFIG);
    try {
      const salvo = localStorage.getItem(CHAVE_RASCUNHO);
      if (salvo) {
        return mesclarConfig(base, JSON.parse(salvo));
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
  function avisar(msg, duracaoMs) {
    toastEl.textContent = msg;
    toastEl.classList.add("toast--visivel");
    clearTimeout(timerToast);
    timerToast = setTimeout(function () {
      toastEl.classList.remove("toast--visivel");
    }, duracaoMs || 3400);
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

  /* -------------------------------------------------------------------
     BANCO DE MÍDIA NO NAVEGADOR (IndexedDB) + OTIMIZAÇÃO
     ------------------------------------------------------------------- */
  function abrirBancoMidia() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("IndexedDB indisponível"));
      const req = indexedDB.open(NOME_BANCO, 1);
      req.onupgradeneeded = function (ev) {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_MIDIA)) {
          db.createObjectStore(STORE_MIDIA);
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function salvarMidiaNoBanco(caminho, blob) {
    try {
      const db = await abrirBancoMidia();
      await new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_MIDIA, "readwrite");
        tx.objectStore(STORE_MIDIA).put(blob, caminho);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
      db.close();
    } catch (err) {
      console.warn("Não foi possível salvar mídia no IndexedDB:", err);
    }
  }

  async function removerMidiaDoBanco(caminho) {
    try {
      const db = await abrirBancoMidia();
      await new Promise(function (resolve) {
        const tx = db.transaction(STORE_MIDIA, "readwrite");
        tx.objectStore(STORE_MIDIA).delete(caminho);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
      db.close();
    } catch (_) {}
  }

  async function carregarMidiasDoBanco() {
    try {
      const db = await abrirBancoMidia();
      await new Promise(function (resolve) {
        const tx = db.transaction(STORE_MIDIA, "readonly");
        const store = tx.objectStore(STORE_MIDIA);
        const reqCursor = store.openCursor();
        reqCursor.onsuccess = function (ev) {
          const cursor = ev.target.result;
          if (cursor) {
            const caminho = cursor.key;
            const valor = cursor.value;
            let blob = null;
            if (valor instanceof Blob) {
              blob = valor;
            } else if (valor && valor.buffer instanceof ArrayBuffer) {
              blob = new Blob([valor.buffer], { type: valor.type || "application/octet-stream" });
            }
            if (blob) {
              arquivosPendentes.set(caminho, blob);
              if (!previewsLocais.has(caminho)) {
                previewsLocais.set(caminho, URL.createObjectURL(blob));
              }
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        reqCursor.onerror = function () { resolve(); };
      });
      db.close();
    } catch (_) {}
  }

  async function limparBancoMidia() {
    try {
      const db = await abrirBancoMidia();
      await new Promise(function (resolve) {
        const tx = db.transaction(STORE_MIDIA, "readwrite");
        tx.objectStore(STORE_MIDIA).clear();
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
      db.close();
    } catch (_) {}
  }

  function otimizarImagem(file) {
    return new Promise(function (resolve) {
      if (!file || !file.type || !file.type.startsWith("image/")) {
        return resolve(file);
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        const maxDim = 1600;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) return resolve(file);
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          resolve(blob || file);
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  async function lerArquivoParaBlobMemoria(file, tipoPadrao) {
    const buffer = await file.arrayBuffer();
    return new Blob([buffer], { type: file.type || tipoPadrao });
  }

  /* -------------------------------------------------------------------
     ENVIO DE ARQUIVO PARA NUVEM (Vercel Blob) OU SERVIDOR LOCAL
     ------------------------------------------------------------------- */
  async function enviarArquivoParaServidorOuNuvem(caminhoDestino, blob) {
    // 1. Tenta obter token de upload direto para Vercel Blob (/api/upload POST)
    try {
      const tokenRes = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-editor-senha": SENHA_EDITOR
        },
        body: JSON.stringify({ pathname: caminhoDestino })
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData && tokenData.clientToken) {
          const partesToken = tokenData.clientToken.split("_");
          const storeId = partesToken[3] || "";
          const reqId = storeId + ":" + Date.now() + ":" + Math.random().toString(16).slice(2);
          const putRes = await fetch(
            "https://vercel.com/api/blob/?pathname=" + encodeURIComponent(caminhoDestino),
            {
              method: "PUT",
              headers: {
                "authorization": "Bearer " + tokenData.clientToken,
                "x-api-version": "13",
                "x-api-blob-request-id": reqId,
                "x-api-blob-request-attempt": "0",
                "x-vercel-blob-store-id": storeId,
                "x-vercel-blob-access": "public",
                "x-content-type": blob.type || "application/octet-stream",
                "x-content-length": String(blob.size)
              },
              body: blob
            }
          );
          if (putRes.ok) {
            const blobInfo = await putRes.json();
            if (blobInfo && blobInfo.url) {
              return blobInfo.url;
            }
          }
        } else if (tokenData && tokenData.localUpload) {
          // Servidor local (localhost): envia via PUT /api/upload?pathname=...
          const localPut = await fetch(
            "/api/upload?pathname=" + encodeURIComponent(caminhoDestino),
            {
              method: "PUT",
              headers: {
                "content-type": blob.type || "application/octet-stream",
                "x-editor-senha": SENHA_EDITOR
              },
              body: blob
            }
          );
          if (localPut.ok) {
            const localInfo = await localPut.json();
            if (localInfo && localInfo.url) return localInfo.url;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function substituirCaminhoNoEstado(caminhoAntigo, urlNova) {
    if (!caminhoAntigo || !urlNova || caminhoAntigo === urlNova) return;
    if (estado.capa === caminhoAntigo) {
      estado.capa = urlNova;
      const inpCapa = document.getElementById("cfg-capa");
      if (inpCapa) inpCapa.value = urlNova;
    }
    if (estado.pix && estado.pix.imagemQrCode === caminhoAntigo) {
      estado.pix.imagemQrCode = urlNova;
    }
    (estado.carrossel || []).forEach(function (item) {
      if (item && item.src === caminhoAntigo) item.src = urlNova;
    });
    if (estado.galeria) {
      ["entrega", "montagem", "videos"].forEach(function (aba) {
        (estado.galeria[aba] || []).forEach(function (item) {
          if (item && item.src === caminhoAntigo) item.src = urlNova;
        });
      });
    }
  }

  async function registrarArquivoLocal(file, pasta) {
    let nomeLimpo = limparNomeArquivo(file.name);
    let blobFinal;
    if (pasta === "imagens" && file.type && file.type.startsWith("image/")) {
      blobFinal = await otimizarImagem(file);
      nomeLimpo = nomeLimpo.replace(/\.(png|webp|heic|jpeg)$/i, ".jpg");
      if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(nomeLimpo)) nomeLimpo += ".jpg";
    } else {
      blobFinal = await lerArquivoParaBlobMemoria(file, pasta === "videos" ? "video/mp4" : "application/octet-stream");
      if (pasta === "videos" && !/\.(mp4|webm|mov|m4v)$/i.test(nomeLimpo)) {
        nomeLimpo += ".mp4";
      }
    }

    const destino = pasta + "/" + nomeLimpo;
    arquivosPendentes.set(destino, blobFinal);
    if (previewsLocais.has(destino)) {
      URL.revokeObjectURL(previewsLocais.get(destino));
    }
    previewsLocais.set(destino, URL.createObjectURL(blobFinal));
    await salvarMidiaNoBanco(destino, blobFinal);
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
      const urlVid = srcParaPreview(item.src);
      vid.dataset.src = urlVid.startsWith("blob:") ? urlVid : (urlVid + "#t=0.5");
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "metadata";
      vid.addEventListener("loadeddata", function () {
        try { if (vid.currentTime === 0) vid.currentTime = 0.5; } catch (_) {}
      });
      thumb.appendChild(vid);
      observadorVideosEditor.observe(vid);
    } else {
      const img = document.createElement("img");
      img.src = srcParaPreview(item.src);
      img.alt = item.legenda || "Foto";
      thumb.appendChild(img);
    }

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
     Coloca itens novos no TOPO da lista (unshift) para aparecerem
     imediatamente no site sem ficar escondidos atrás do "Ver mais".
     ------------------------------------------------------------------- */
  function configurarAdicaoMidia(btnFoto, inputFoto, btnVideo, inputVideo, btnYt, obterLista, rerender, ehGaleria) {
    document.getElementById(btnFoto).addEventListener("click", function () {
      document.getElementById(inputFoto).click();
    });
    document.getElementById(inputFoto).addEventListener("change", async function (ev) {
      const arquivos = Array.from(ev.target.files || []);
      ev.target.value = "";
      if (!arquivos.length) return;
      avisar("Carregando foto...");
      for (const file of arquivos) {
        const destino = await registrarArquivoLocal(file, "imagens");
        obterLista().unshift({ tipo: "foto", src: destino, legenda: "" });
      }
      rerender();
      try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado)); } catch (_) {}
      avisar("Foto adicionada no topo! Clique em 'Salvar' para publicar.");
    });

    document.getElementById(btnVideo).addEventListener("click", function () {
      document.getElementById(inputVideo).click();
    });
    document.getElementById(inputVideo).addEventListener("change", async function (ev) {
      const arquivos = Array.from(ev.target.files || []);
      ev.target.value = "";
      if (!arquivos.length) return;
      avisar("Carregando vídeo...");
      for (const file of arquivos) {
        const destino = await registrarArquivoLocal(file, "videos");
        const novoItem = { tipo: "video", src: destino, legenda: "" };
        obterLista().unshift(novoItem);
        if (ehGaleria && abaGaleriaAtual !== "videos") {
          estado.galeria.videos = estado.galeria.videos || [];
          estado.galeria.videos.unshift({ tipo: "video", src: destino, legenda: "" });
        }
      }
      rerender();
      try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado)); } catch (_) {}
      avisar("Vídeo adicionado no topo! Clique em 'Salvar' para publicar.");
    });

    document.getElementById(btnYt).addEventListener("click", function () {
      const link = window.prompt("Cole o link do vídeo no YouTube (ou apenas o código de 11 letras):");
      if (!link) return;
      const ytId = extrairIdYouTube(link);
      if (!ytId) {
        avisar("Link do YouTube inválido. Tente copiar a URL completa do vídeo.");
        return;
      }
      obterLista().unshift({ tipo: "youtube", id: ytId, legenda: "" });
      if (ehGaleria && abaGaleriaAtual !== "videos") {
        estado.galeria.videos = estado.galeria.videos || [];
        estado.galeria.videos.unshift({ tipo: "youtube", id: ytId, legenda: "" });
      }
      rerender();
      try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado)); } catch (_) {}
      avisar("Vídeo do YouTube adicionado!");
    });
  }

  configurarAdicaoMidia(
    "carrossel-add-foto", "input-carrossel-foto",
    "carrossel-add-video", "input-carrossel-video",
    "carrossel-add-yt",
    () => estado.carrossel,
    renderCarrossel,
    false
  );

  configurarAdicaoMidia(
    "galeria-add-foto", "input-galeria-foto",
    "galeria-add-video", "input-galeria-video",
    "galeria-add-yt",
    () => estado.galeria[abaGaleriaAtual],
    renderGaleria,
    true
  );

  // Trocar foto da capa
  document.getElementById("btn-trocar-capa").addEventListener("click", function () {
    document.getElementById("input-capa").click();
  });
  document.getElementById("input-capa").addEventListener("change", async function (ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    avisar("Carregando nova capa...");
    const destino = await registrarArquivoLocal(file, "imagens");
    estado.capa = destino;
    document.getElementById("cfg-capa").value = destino;
    document.getElementById("preview-capa").src = srcParaPreview(destino);
    try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado)); } catch (_) {}
    avisar("Nova capa selecionada! Clique em 'Salvar' para publicar.");
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
      avisar("Seu navegador não suporta conectar pasta local. Use o botão 'Salvar' no topo.");
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
    if (/^https?:\/\//i.test(caminhoRelativo)) return;
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
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado));
      avisar("Alterações Salvas!");
      return true;
    } catch (err) {
      avisar("Erro ao salvar na pasta: " + err.message);
      return false;
    } finally {
      btnSalvarPasta.disabled = false;
    }
  }

  async function salvarGeral() {
    const botoesSalvar = [
      document.getElementById("btn-salvar-topo"),
      document.getElementById("btn-salvar-publicar")
    ];
    botoesSalvar.forEach(b => { if (b) b.disabled = true; });

    try {
      // 1. Garante persistência no IndexedDB local
      for (const [destino, blob] of arquivosPendentes.entries()) {
        await salvarMidiaNoBanco(destino, blob);
      }

      // 2. Envia fotos e vídeos novos para o servidor/nuvem (Vercel Blob ou servidor local)
      if (arquivosPendentes.size > 0) {
        avisar("Enviando fotos/vídeos...", 15000);
        for (const [destino, blob] of Array.from(arquivosPendentes.entries())) {
          const urlRemota = await enviarArquivoParaServidorOuNuvem(destino, blob);
          if (urlRemota) {
            substituirCaminhoNoEstado(destino, urlRemota);
            if (urlRemota !== destino) {
              arquivosPendentes.delete(destino);
              await removerMidiaDoBanco(destino);
            }
          }
        }
        renderCarrossel();
        renderGaleria();
      }

      // 3. Salva configuração global no servidor/nuvem (/api/config) para todos os aparelhos
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-editor-senha": SENHA_EDITOR
          },
          body: JSON.stringify({ config: estado })
        });
      } catch (_) {}

      // 4. Se pasta local estiver conectada, grava também na pasta
      if (pastaRaiz) {
        await salvarNaPastaConectada();
      }

      // 5. Atualiza cache local
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado));
      avisar("Alterações Salvas!");
    } catch (_) {
      avisar("Não foi possível salvar.");
    } finally {
      botoesSalvar.forEach(b => { if (b) b.disabled = false; });
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
    avisar("✓ config.js baixado!");
  });

  /* -------------------------------------------------------------------
     TESTAR NO SITE
     ------------------------------------------------------------------- */
  async function testarNoSite() {
    await salvarGeral();
    window.open("index.html?rascunho=1", "_blank", "noopener");
  }

  document.getElementById("btn-testar").addEventListener("click", testarNoSite);
  document.getElementById("btn-testar-publicar").addEventListener("click", testarNoSite);

  document.getElementById("btn-limpar-rascunho").addEventListener("click", async function () {
    localStorage.removeItem(CHAVE_RASCUNHO);
    arquivosPendentes.clear();
    previewsLocais.forEach(function (url) { URL.revokeObjectURL(url); });
    previewsLocais.clear();
    await limparBancoMidia();
    estado = clonar(CONFIG);
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-editor-senha": SENHA_EDITOR
        },
        body: JSON.stringify({ config: estado })
      });
    } catch (_) {}
    inicializarCampos();
    renderValores();
    renderCarrossel();
    renderGaleria();
    avisar("Restaurado para o original!");
  });

  /* -------------------------------------------------------------------
     CONTROLE DE ACESSO (SENHA) E INICIALIZAÇÃO
     ------------------------------------------------------------------- */
  const telaSenha = document.getElementById("tela-senha");
  const conteudoEditor = document.getElementById("conteudo-editor");
  const formSenha = document.getElementById("form-senha");
  const inputSenha = document.getElementById("input-senha");
  const erroSenha = document.getElementById("erro-senha");

  function obterArquivosOriginais() {
    const orig = new Set();
    if (CONFIG.capa) orig.add(CONFIG.capa);
    if (CONFIG.pix && CONFIG.pix.imagemQrCode) orig.add(CONFIG.pix.imagemQrCode);
    (CONFIG.carrossel || []).forEach(i => { if (i && i.src) orig.add(i.src); });
    if (CONFIG.galeria) {
      ["entrega", "montagem", "videos"].forEach(aba => {
        (CONFIG.galeria[aba] || []).forEach(i => { if (i && i.src) orig.add(i.src); });
      });
    }
    return orig;
  }

  function limparMidiasOrfasEditor() {
    const orig = obterArquivosOriginais();
    let mudou = false;
    function valido(src) {
      if (!src) return false;
      if (/^(https?:|data:|blob:)/i.test(src)) return true;
      return orig.has(src) || previewsLocais.has(src);
    }
    if (estado.capa && !valido(estado.capa)) {
      estado.capa = CONFIG.capa;
      mudou = true;
    }
    if (Array.isArray(estado.carrossel)) {
      const antes = estado.carrossel.length;
      estado.carrossel = estado.carrossel.filter(i => i && (i.tipo === "youtube" || valido(i.src)));
      if (estado.carrossel.length !== antes) mudou = true;
    }
    if (estado.galeria) {
      ["entrega", "montagem", "videos"].forEach(aba => {
        if (!Array.isArray(estado.galeria[aba])) return;
        const antes = estado.galeria[aba].length;
        estado.galeria[aba] = estado.galeria[aba].filter(i => i && (i.tipo === "youtube" || valido(i.src)));
        if (estado.galeria[aba].length !== antes) mudou = true;
      });
    }
    if (mudou) {
      try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado)); } catch (_) {}
    }
  }

  async function sincronizarEstadoRemoto() {
    try {
      const res = await fetch("/api/config?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.config) {
          estado = mesclarConfig(CONFIG, data.config);
          try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado)); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  async function desbloquearEditor() {
    telaSenha.hidden = true;
    conteudoEditor.hidden = false;
    if (!editorInicializado) {
      editorInicializado = true;
      await Promise.all([carregarMidiasDoBanco(), sincronizarEstadoRemoto()]);
      limparMidiasOrfasEditor();
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
