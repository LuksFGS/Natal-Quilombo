/* =====================================================================
   FUNCIONAMENTO DO SITE — script.js
   ---------------------------------------------------------------------
   Lê tudo do js/config.js (e alterações salvas pelo editor.html, incluindo
   fotos e vídeos guardados no IndexedDB do navegador) e monta a página.
   ===================================================================== */

document.documentElement.classList.add("js");

const CHAVE_RASCUNHO = "natalQuilomboRascunho";
const NOME_BANCO = "natalQuilomboMidiaDB_v2";
const STORE_MIDIA = "arquivos";

try {
  if (window.indexedDB) {
    window.indexedDB.deleteDatabase("natalQuilomboMidiaDB");
  }
} catch (_) {}
const parametrosUrl = new URLSearchParams(window.location.search);

let cfg = CONFIG;
let temAlteracoesLocais = false;
let emModoRascunho = false;

try {
  const salvo = localStorage.getItem(CHAVE_RASCUNHO);
  if (salvo) {
    const parsed = JSON.parse(salvo);
    if (parsed && typeof parsed === "object") {
      cfg = Object.assign({}, CONFIG, parsed);
      cfg.pix = Object.assign({}, CONFIG.pix, parsed.pix || {});
      cfg.numeros = Object.assign({}, CONFIG.numeros, parsed.numeros || {});
      cfg.redes = Object.assign({}, CONFIG.redes, parsed.redes || {});
      cfg.textos = Object.assign({}, CONFIG.textos, parsed.textos || {});
      cfg.galeria = Object.assign({}, CONFIG.galeria, parsed.galeria || {});
      temAlteracoesLocais = true;
      emModoRascunho = parametrosUrl.get("rascunho") === "1";
    }
  }
} catch (erro) {
  console.warn("Não foi possível carregar alterações salvas:", erro);
}

if (emModoRascunho) {
  const barra = document.createElement("div");
  barra.className = "aviso-rascunho";
  const msg = document.createElement("span");
  msg.textContent = "Pré-visualização do Editor.";
  const acoes = document.createElement("div");
  acoes.className = "aviso-rascunho__acoes";

  const voltar = document.createElement("a");
  voltar.href = "editor.html";
  voltar.className = "botao botao--primario";
  voltar.textContent = "Voltar ao Editor";

  const sair = document.createElement("a");
  sair.href = "index.html";
  sair.className = "botao botao--claro";
  sair.textContent = "Fechar aviso";

  acoes.appendChild(voltar);
  acoes.appendChild(sair);
  barra.appendChild(msg);
  barra.appendChild(acoes);
  document.body.appendChild(barra);
}

/* =====================================================================
   BANCO DE MÍDIA DO NAVEGADOR (IndexedDB)
   ===================================================================== */
function carregarMidiasSalvas() {
  return new Promise(function (resolve) {
    const mapa = new Map();
    if (!window.indexedDB) return resolve(mapa);
    try {
      const req = indexedDB.open(NOME_BANCO, 1);
      req.onupgradeneeded = function (ev) {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_MIDIA)) {
          db.createObjectStore(STORE_MIDIA);
        }
      };
      req.onsuccess = function () {
        const db = req.result;
        try {
          const tx = db.transaction(STORE_MIDIA, "readonly");
          const store = tx.objectStore(STORE_MIDIA);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = function (ev) {
            const cursor = ev.target.result;
            if (cursor) {
              if (cursor.value instanceof Blob) {
                mapa.set(cursor.key, URL.createObjectURL(cursor.value));
              }
              cursor.continue();
            } else {
              db.close();
              resolve(mapa);
            }
          };
          cursorReq.onerror = function () { db.close(); resolve(mapa); };
        } catch (_) {
          db.close();
          resolve(mapa);
        }
      };
      req.onerror = function () { resolve(mapa); };
    } catch (_) {
      resolve(mapa);
    }
  });
}

function obterArquivosOriginais(baseCfg) {
  const orig = new Set();
  if (baseCfg.capa) orig.add(baseCfg.capa);
  if (baseCfg.pix && baseCfg.pix.imagemQrCode) orig.add(baseCfg.pix.imagemQrCode);
  (baseCfg.carrossel || []).forEach(function (i) { if (i && i.src) orig.add(i.src); });
  if (baseCfg.galeria) {
    ["entrega", "montagem", "videos"].forEach(function (aba) {
      (baseCfg.galeria[aba] || []).forEach(function (i) { if (i && i.src) orig.add(i.src); });
    });
  }
  return orig;
}

function limparMidiasOrfas(cfgAlvo, midiasLocais, baseCfg) {
  const orig = obterArquivosOriginais(baseCfg);
  let mudou = false;
  function valido(src) {
    if (!src) return false;
    if (/^(https?:|data:|blob:)/i.test(src)) return true;
    return orig.has(src) || midiasLocais.has(src);
  }
  if (cfgAlvo.capa && !valido(cfgAlvo.capa)) {
    cfgAlvo.capa = baseCfg.capa;
    mudou = true;
  }
  if (Array.isArray(cfgAlvo.carrossel)) {
    const antes = cfgAlvo.carrossel.length;
    cfgAlvo.carrossel = cfgAlvo.carrossel.filter(function (i) {
      return i && (i.tipo === "youtube" || valido(i.src));
    });
    if (cfgAlvo.carrossel.length !== antes) mudou = true;
  }
  if (cfgAlvo.galeria) {
    ["entrega", "montagem", "videos"].forEach(function (aba) {
      if (!Array.isArray(cfgAlvo.galeria[aba])) return;
      const antes = cfgAlvo.galeria[aba].length;
      cfgAlvo.galeria[aba] = cfgAlvo.galeria[aba].filter(function (i) {
        return i && (i.tipo === "youtube" || valido(i.src));
      });
      if (cfgAlvo.galeria[aba].length !== antes) mudou = true;
    });
  }
  if (mudou) {
    try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(cfgAlvo)); } catch (_) {}
  }
}

/* =====================================================================
   HELPERS SEGUROS
   ===================================================================== */
function extrairIdYouTube(entrada) {
  if (!entrada || typeof entrada !== "string") return "";
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
  return texto;
}

function sanitizarUrlExterna(url) {
  if (!url || typeof url !== "string") return "";
  const limpa = url.trim();
  if (!limpa) return "";
  if (/^https?:\/\//i.test(limpa)) return limpa;
  return "";
}

/* =====================================================================
   INICIALIZAÇÃO PRINCIPAL DO SITE
   ===================================================================== */
function iniciarSite(midiasLocais) {
  function resolverMidia(caminho) {
    return midiasLocais.get(caminho) || caminho;
  }

  /* -------------------------------------------------------------------
     1. PREENCHE O SITE COM OS DADOS DO config.js
     ------------------------------------------------------------------- */
  const anoAtual = new Date().getFullYear();
  const anosDeAcao = Math.max(1, anoAtual - (Number(cfg.anoDeInicio) || 2007));

  document.querySelectorAll('[data-config="nomeDaAcao"]').forEach(function (el) {
    el.textContent = cfg.nomeDaAcao || "Natal Quilombo";
  });

  document.getElementById("ano-atual").textContent = anoAtual;
  const seloAno = document.getElementById("selo-ano");
  if (seloAno && cfg.anoDeInicio) seloAno.textContent = cfg.anoDeInicio;

  const t = cfg.textos || {};
  if (t.tituloSite) document.title = t.tituloSite;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && t.descricaoSite) metaDesc.setAttribute("content", t.descricaoSite);

  const imgCapa = document.getElementById("inicio-fundo");
  if (imgCapa && cfg.capa) {
    imgCapa.src = resolverMidia(cfg.capa);
    imgCapa.onerror = function () {
      if (imgCapa.src !== CONFIG.capa) imgCapa.src = CONFIG.capa;
    };
  }

  const elChamada = document.getElementById("texto-chamada");
  if (elChamada && t.chamada) {
    elChamada.textContent = "";
    const partes = t.chamada.split("{anos}");
    partes.forEach(function (parte, idx) {
      if (parte) elChamada.appendChild(document.createTextNode(parte));
      if (idx < partes.length - 1) {
        const strong = document.createElement("strong");
        strong.setAttribute("data-anos", "");
        strong.textContent = anosDeAcao;
        elChamada.appendChild(strong);
      }
    });
  }

  document.querySelectorAll("[data-anos]").forEach(function (el) {
    el.textContent = anosDeAcao;
  });

  function definirTexto(id, valor) {
    const el = document.getElementById(id);
    if (el && typeof valor === "string" && valor.trim()) {
      el.textContent = valor;
    }
  }

  definirTexto("texto-titulo-inicio", t.tituloInicio);
  definirTexto("texto-subtitulo-inicio", t.subtituloInicio);
  definirTexto("texto-titulo-doar", t.tituloDoar);
  definirTexto("texto-doar", t.textoDoar);
  definirTexto("texto-obs-doar", t.obsDoar);
  definirTexto("texto-titulo-sobre", t.tituloSobre);
  definirTexto("texto-sobre-1", t.sobreParagrafo1);
  definirTexto("texto-sobre-2", t.sobreParagrafo2);
  definirTexto("texto-titulo-contato", t.tituloContato);
  definirTexto("texto-contato", t.textoContato);

  if (Array.isArray(t.etapas)) {
    [0, 1, 2].forEach(function (idx) {
      const etapa = t.etapas[idx];
      if (!etapa) return;
      definirTexto("etapa-" + (idx + 1) + "-titulo", etapa.titulo);
      definirTexto("etapa-" + (idx + 1) + "-texto", etapa.texto);
    });
  }

  const listaValores = document.getElementById("lista-valores");
  if (listaValores && Array.isArray(t.valoresDoacao) && t.valoresDoacao.length > 0) {
    listaValores.textContent = "";
    t.valoresDoacao.forEach(function (item) {
      if (!item || (!item.valor && !item.descricao)) return;
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = item.valor || "";
      li.appendChild(strong);
      li.appendChild(document.createTextNode(" " + (item.descricao || "")));
      listaValores.appendChild(li);
    });
  }

  document.querySelectorAll("[data-rede]").forEach(function (botao) {
    const link = sanitizarUrlExterna(cfg.redes && cfg.redes[botao.dataset.rede]);
    if (link) {
      botao.href = link;
      botao.hidden = false;
    } else {
      botao.removeAttribute("href");
      botao.hidden = true;
    }
  });

  const linkVakinha = sanitizarUrlExterna(cfg.vakinha);
  if (linkVakinha) {
    document.getElementById("botao-vakinha").href = linkVakinha;
    document.getElementById("bloco-vakinha").hidden = false;
  } else {
    document.getElementById("bloco-vakinha").hidden = true;
  }

  /* -------------------------------------------------------------------
     2. CARROSSEL E GALERIA RENDERIZADOS A PARTIR DO config.js
     ------------------------------------------------------------------- */
  const trilho = document.getElementById("carrossel-trilho");
  if (trilho && Array.isArray(cfg.carrossel)) {
    trilho.textContent = "";
    cfg.carrossel.forEach(function (item) {
      if (!item || !item.tipo) return;
      const slide = document.createElement("div");
      slide.className = "carrossel__slide";

      if (item.tipo === "video" && item.src) {
        const video = document.createElement("video");
        video.src = resolverMidia(item.src);
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        if (item.legenda) video.setAttribute("aria-label", item.legenda);
        slide.appendChild(video);
      } else if (item.tipo === "youtube" && (item.id || item.src)) {
        const ytId = extrairIdYouTube(item.id || item.src);
        if (ytId) {
          const iframe = document.createElement("iframe");
          iframe.src = "https://www.youtube.com/embed/" + encodeURIComponent(ytId) + "?rel=0";
          iframe.title = item.legenda || "Vídeo";
          iframe.allow = "encrypted-media; fullscreen";
          iframe.allowFullscreen = true;
          iframe.style.width = "100%";
          iframe.style.height = "100%";
          iframe.style.border = "0";
          slide.appendChild(iframe);
        }
      } else if (item.src) {
        const img = document.createElement("img");
        img.src = resolverMidia(item.src);
        img.alt = item.legenda || "Foto da ação Natal Quilombo";
        img.loading = "lazy";
        slide.appendChild(img);
      }

      if (slide.childElementCount > 0) trilho.appendChild(slide);
    });
  }

  ["entrega", "montagem", "videos"].forEach(function (abaNome) {
    const painel = document.querySelector('.galeria[data-aba="' + abaNome + '"]');
    const itens = cfg.galeria && Array.isArray(cfg.galeria[abaNome]) ? cfg.galeria[abaNome] : [];
    if (!painel) return;

    painel.textContent = "";
    itens.forEach(function (item) {
      if (!item) return;
      const btn = document.createElement("button");
      btn.className = "midia";
      btn.type = "button";
      if (item.legenda) btn.dataset.legenda = item.legenda;

      if (item.tipo === "youtube" && (item.id || item.src)) {
        const ytId = extrairIdYouTube(item.id || item.src);
        if (!ytId) return;
        btn.classList.add("midia--video");
        btn.dataset.youtube = ytId;
        btn.setAttribute("aria-label", item.legenda || "Reproduzir vídeo do YouTube");
      } else if (item.tipo === "video" && item.src) {
        const urlVideo = resolverMidia(item.src);
        btn.classList.add("midia--video");
        btn.dataset.video = urlVideo;
        btn.setAttribute("aria-label", item.legenda || "Reproduzir vídeo");
        const video = document.createElement("video");
        video.dataset.src = urlVideo.startsWith("blob:") ? urlVideo : (urlVideo + "#t=0.5");
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.addEventListener("loadeddata", function () {
          try { if (video.currentTime === 0) video.currentTime = 0.5; } catch (_) {}
        });
        btn.appendChild(video);
      } else if (item.src) {
        const img = document.createElement("img");
        img.src = resolverMidia(item.src);
        img.alt = item.legenda || "Registro da ação Natal Quilombo";
        img.loading = "lazy";
        img.addEventListener("error", function () {
          btn.remove();
          const aba = document.querySelector('.aba[data-aba="' + abaNome + '"]');
          if (aba) aba.querySelector(".aba__total").textContent = painel.querySelectorAll(".midia").length;
        });
        btn.appendChild(img);
      } else {
        return;
      }

      painel.appendChild(btn);
    });
  });

  /* -------------------------------------------------------------------
     3. CABEÇALHO E MENU DO CELULAR
     ------------------------------------------------------------------- */
  const cabecalho = document.getElementById("cabecalho");
  const menu = document.getElementById("menu");
  const botaoMenu = document.getElementById("botao-menu");

  function atualizarCabecalho() {
    cabecalho.classList.toggle("cabecalho--rolado", window.scrollY > 40);
  }
  window.addEventListener("scroll", atualizarCabecalho, { passive: true });
  atualizarCabecalho();

  function alternarMenu(abrir) {
    menu.classList.toggle("menu--aberto", abrir);
    botaoMenu.setAttribute("aria-expanded", abrir);
    botaoMenu.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
  }

  botaoMenu.addEventListener("click", function () {
    alternarMenu(!menu.classList.contains("menu--aberto"));
  });

  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      alternarMenu(false);
    });
  });

  /* -------------------------------------------------------------------
     4. DESTACA NO MENU A SEÇÃO QUE ESTÁ NA TELA
     ------------------------------------------------------------------- */
  const linksDoMenu = document.querySelectorAll(".menu__link");

  const observadorSecoes = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (!entrada.isIntersecting) return;
      const id = entrada.target.id === "doar" ? "inicio" : entrada.target.id;
      linksDoMenu.forEach(function (link) {
        link.classList.toggle("menu__link--ativo", link.getAttribute("href") === "#" + id);
      });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });

  ["inicio", "doar", "sobre", "fotos", "contato"].forEach(function (id) {
    observadorSecoes.observe(document.getElementById(id));
  });

  /* -------------------------------------------------------------------
     5. PIX: CÓDIGO "COPIA E COLA" + QR CODE
     ------------------------------------------------------------------- */
  function limparTexto(texto, tamanhoMaximo) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .toUpperCase()
      .substring(0, tamanhoMaximo);
  }

  function bloco(id, valor) {
    const tamanho = String(valor.length).padStart(2, "0");
    return id + tamanho + valor;
  }

  function calcularCRC16(texto) {
    let crc = 0xFFFF;
    for (let i = 0; i < texto.length; i++) {
      crc ^= texto.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function normalizarChaveBrCode(chave) {
    const limpa = String(chave || "").trim();
    const digitosTelefone = limpa.replace(/[\s()-]/g, "");
    if (/^\+55\d{10,11}$/.test(digitosTelefone)) return digitosTelefone;
    if (/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/.test(limpa)) {
      return "+55" + limpa.replace(/\D/g, "");
    }
    return limpa;
  }

  function formatarChaveVisivel(chave) {
    const brCode = normalizarChaveBrCode(chave);
    const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(brCode);
    if (m) return "(" + m[1] + ") " + m[2] + "-" + m[3];
    return String(chave || "").trim() || "—";
  }

  function obterChaveParaCopiar(chave) {
    const brCode = normalizarChaveBrCode(chave);
    if (/^\+55\d{10,11}$/.test(brCode)) return brCode.slice(3);
    return String(chave || "").trim();
  }

  function gerarCodigoPix(chave, recebedor, cidade) {
    const chaveFinal = normalizarChaveBrCode(chave);
    if (!chaveFinal) return "";
    const contaPix = bloco("00", "br.gov.bcb.pix") + bloco("01", chaveFinal);

    let codigo =
      bloco("00", "01") +
      bloco("26", contaPix) +
      bloco("52", "0000") +
      bloco("53", "986") +
      bloco("58", "BR") +
      bloco("59", limparTexto(recebedor || "NATAL QUILOMBO", 25)) +
      bloco("60", limparTexto(cidade || "SAO PAULO", 15)) +
      bloco("62", bloco("05", "***"));

    codigo += "6304";
    return codigo + calcularCRC16(codigo);
  }

  const codigoPix = gerarCodigoPix(cfg.pix.chave, cfg.pix.recebedor, cfg.pix.cidade);

  document.getElementById("pix-chave").textContent = formatarChaveVisivel(cfg.pix.chave);
  document.getElementById("pix-recebedor").textContent = cfg.pix.recebedor || "—";

  const areaQrCode = document.getElementById("pix-qrcode");
  if (cfg.pix.imagemQrCode) {
    const qrImg = document.createElement("img");
    qrImg.src = resolverMidia(cfg.pix.imagemQrCode);
    qrImg.alt = "QR Code do Pix";
    areaQrCode.textContent = "";
    areaQrCode.appendChild(qrImg);
  } else if (codigoPix && typeof qrcode === "function") {
    const qr = qrcode(0, "M");
    qr.addData(codigoPix);
    qr.make();
    areaQrCode.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  /* -------------------------------------------------------------------
     6. BOTÕES DE COPIAR + AVISO "COPIADO!"
     ------------------------------------------------------------------- */
  const aviso = document.getElementById("aviso");
  let temporizadorAviso;

  function mostrarAviso(mensagem) {
    aviso.textContent = mensagem;
    aviso.classList.add("aviso--visivel");
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () {
      aviso.classList.remove("aviso--visivel");
    }, 2600);
  }

  function copiarTexto(texto, mensagem) {
    if (!texto) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () {
        mostrarAviso(mensagem);
      });
    } else {
      const campo = document.createElement("textarea");
      campo.value = texto;
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      document.execCommand("copy");
      campo.remove();
      mostrarAviso(mensagem);
    }
  }

  document.getElementById("botao-copiar-chave").addEventListener("click", function () {
    copiarTexto(obterChaveParaCopiar(cfg.pix.chave), "✓ Chave Pix copiada!");
  });

  document.getElementById("botao-copiar-codigo").addEventListener("click", function () {
    copiarTexto(codigoPix, "✓ Código copiado! Cole no app do seu banco.");
  });

  /* -------------------------------------------------------------------
     7. CONTADORES ANIMADOS
     ------------------------------------------------------------------- */
  function animarContador(elemento) {
    const valorFinal = Number(cfg.numeros[elemento.dataset.contador]) || 0;
    const duracao = 1600;
    const inicio = performance.now();

    function passo(agora) {
      const progresso = Math.min((agora - inicio) / duracao, 1);
      const suavizado = 1 - Math.pow(1 - progresso, 3);
      elemento.textContent = Math.round(valorFinal * suavizado).toLocaleString("pt-BR");
      if (progresso < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  const observadorContadores = new IntersectionObserver(function (entradas, observador) {
    entradas.forEach(function (entrada) {
      if (entrada.isIntersecting) {
        animarContador(entrada.target);
        observador.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.6 });

  document.querySelectorAll("[data-contador]").forEach(function (elemento) {
    observadorContadores.observe(elemento);
  });

  /* -------------------------------------------------------------------
     8. ANIMAÇÃO DE "REVELAR" AO ROLAR
     ------------------------------------------------------------------- */
  const observadorRevelar = new IntersectionObserver(function (entradas, observador) {
    entradas.forEach(function (entrada) {
      if (entrada.isIntersecting) {
        entrada.target.classList.add("visivel");
        observador.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

  document.querySelectorAll(".revelar").forEach(function (elemento, indice) {
    elemento.style.transitionDelay = (indice % 3) * 90 + "ms";
    observadorRevelar.observe(elemento);
  });

  /* -------------------------------------------------------------------
     9. CARROSSEL DE FOTOS E VÍDEOS (seção Sobre nós)
     ------------------------------------------------------------------- */
  const slides = Array.from(trilho.querySelectorAll(".carrossel__slide"));
  const areaPontos = document.getElementById("carrossel-pontos");
  const TEMPO_POR_SLIDE = 5000;
  let slideAtual = 0;
  let carrosselPausado = false;

  areaPontos.textContent = "";
  const pontos = slides.map(function (slide, indice) {
    const ponto = document.createElement("button");
    ponto.type = "button";
    ponto.className = "carrossel__ponto";
    ponto.setAttribute("aria-label", "Ir para o slide " + (indice + 1));
    ponto.addEventListener("click", function () { irParaSlide(indice); });
    areaPontos.appendChild(ponto);
    return ponto;
  });

  function irParaSlide(indice) {
    if (slides.length === 0) return;
    slideAtual = (indice + slides.length) % slides.length;
    trilho.scrollTo({ left: slides[slideAtual].offsetLeft, behavior: "smooth" });
  }

  function atualizarCarrossel() {
    if (slides.length === 0 || trilho.clientWidth === 0) return;
    slideAtual = Math.round(trilho.scrollLeft / trilho.clientWidth);
    pontos.forEach(function (ponto, indice) {
      ponto.classList.toggle("carrossel__ponto--ativo", indice === slideAtual);
    });
    slides.forEach(function (slide, indice) {
      const video = slide.querySelector("video");
      if (video && indice !== slideAtual) video.pause();
    });
  }

  let esperaRolagem;
  trilho.addEventListener("scroll", function () {
    clearTimeout(esperaRolagem);
    esperaRolagem = setTimeout(atualizarCarrossel, 80);
  }, { passive: true });

  document.getElementById("carrossel-anterior").addEventListener("click", function () { irParaSlide(slideAtual - 1); });
  document.getElementById("carrossel-proximo").addEventListener("click", function () { irParaSlide(slideAtual + 1); });

  const carrossel = document.getElementById("carrossel");
  carrossel.addEventListener("mouseenter", function () { carrosselPausado = true; });
  carrossel.addEventListener("mouseleave", function () { carrosselPausado = false; });

  function algumVideoTocando() {
    return slides.some(function (slide) {
      const video = slide.querySelector("video");
      return video && !video.paused;
    });
  }

  slides.forEach(function (slide) {
    const video = slide.querySelector("video");
    if (!video) return;
    ["play", "pause", "ended"].forEach(function (evento) {
      video.addEventListener(evento, function () {
        carrossel.classList.toggle("carrossel--tocando", algumVideoTocando());
      });
    });
  });

  setInterval(function () {
    const naTela = carrossel.getBoundingClientRect().top < window.innerHeight;
    if (!carrosselPausado && !algumVideoTocando() && naTela && slides.length > 1) {
      irParaSlide(slideAtual + 1);
    }
  }, TEMPO_POR_SLIDE);

  atualizarCarrossel();

  /* -------------------------------------------------------------------
     10. GALERIA COM ABAS + "VER MAIS" (seção Fotos)
     ------------------------------------------------------------------- */
  const ITENS_POR_VEZ = 8;
  const abas = document.querySelectorAll(".aba");
  const paineis = document.querySelectorAll(".galeria");
  const botaoVerMais = document.getElementById("botao-ver-mais");
  let painelAtivo = document.querySelector(".galeria--ativa");

  paineis.forEach(function (painel) {
    const itens = painel.querySelectorAll(".midia");
    painel.dataset.mostrando = ITENS_POR_VEZ;

    const aba = document.querySelector('.aba[data-aba="' + painel.dataset.aba + '"]');
    aba.querySelector(".aba__total").textContent = itens.length;

    painel.querySelectorAll("[data-youtube]").forEach(function (item) {
      if (!item.querySelector("img")) {
        const thumb = document.createElement("img");
        thumb.src = "https://img.youtube.com/vi/" + encodeURIComponent(item.dataset.youtube) + "/hqdefault.jpg";
        thumb.alt = item.dataset.legenda || "Vídeo do YouTube";
        thumb.loading = "lazy";
        item.appendChild(thumb);
      }
    });

    if (itens.length === 0) {
      const vazio = document.createElement("p");
      vazio.className = "galeria__vazia";
      vazio.textContent = "✦ Em breve novos registros por aqui.";
      painel.appendChild(vazio);
    }
  });

  function atualizarVerMais() {
    const itens = painelAtivo.querySelectorAll(".midia");
    const limite = Number(painelAtivo.dataset.mostrando);

    itens.forEach(function (item, indice) {
      const esconder = indice >= limite;
      item.hidden = esconder;
      if (!esconder) {
        const video = item.querySelector("video[data-src]");
        if (video && !video.getAttribute("src")) {
          video.src = video.dataset.src;
        }
      }
    });

    const faltam = itens.length - limite;
    botaoVerMais.hidden = faltam <= 0;
    botaoVerMais.textContent = "Ver mais (" + faltam + ")";
  }

  botaoVerMais.addEventListener("click", function () {
    painelAtivo.dataset.mostrando = Number(painelAtivo.dataset.mostrando) + ITENS_POR_VEZ;
    atualizarVerMais();
  });

  abas.forEach(function (aba) {
    aba.addEventListener("click", function () {
      abas.forEach(function (outra) {
        const ativa = outra === aba;
        outra.classList.toggle("aba--ativa", ativa);
        outra.setAttribute("aria-selected", ativa);
      });

      paineis.forEach(function (painel) {
        const ativo = painel.dataset.aba === aba.dataset.aba;
        painel.hidden = !ativo;
        painel.classList.toggle("galeria--ativa", ativo);
        if (ativo) painelAtivo = painel;
      });

      atualizarVerMais();
    });
  });

  atualizarVerMais();

  /* -------------------------------------------------------------------
     11. VISUALIZADOR: FOTO OU VÍDEO EM TELA CHEIA
     ------------------------------------------------------------------- */
  const visualizador = document.getElementById("visualizador");
  const areaMidia = document.getElementById("visualizador-midia");
  const areaLegenda = document.getElementById("visualizador-legenda");
  let listaAtual = [];
  let itemAtual = 0;

  function abrirItem(indice) {
    if (listaAtual.length === 0) return;
    itemAtual = (indice + listaAtual.length) % listaAtual.length;
    const item = listaAtual[itemAtual];
    areaMidia.textContent = "";

    let legenda = item.dataset.legenda || "";

    if (item.dataset.youtube) {
      const iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube.com/embed/" + encodeURIComponent(item.dataset.youtube) + "?autoplay=1&rel=0";
      iframe.title = legenda || "Vídeo";
      iframe.allow = "autoplay; encrypted-media; fullscreen";
      iframe.allowFullscreen = true;
      areaMidia.appendChild(iframe);
    } else if (item.dataset.video) {
      const video = document.createElement("video");
      video.src = item.dataset.video;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      areaMidia.appendChild(video);
    } else {
      const foto = item.querySelector("img");
      if (foto) {
        const img = document.createElement("img");
        img.src = foto.src;
        img.alt = foto.alt || legenda;
        areaMidia.appendChild(img);
        if (!legenda) legenda = foto.alt || "";
      }
    }

    if (areaLegenda) areaLegenda.textContent = legenda;
    visualizador.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function fecharVisualizador() {
    visualizador.hidden = true;
    areaMidia.textContent = "";
    if (areaLegenda) areaLegenda.textContent = "";
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".galeria").forEach(function (painel) {
    painel.addEventListener("click", function (evento) {
      const item = evento.target.closest(".midia");
      if (!item) return;
      listaAtual = Array.from(painel.querySelectorAll(".midia:not([hidden])"));
      abrirItem(listaAtual.indexOf(item));
    });
  });

  document.getElementById("visualizador-fechar").addEventListener("click", fecharVisualizador);
  document.getElementById("visualizador-anterior").addEventListener("click", function () { abrirItem(itemAtual - 1); });
  document.getElementById("visualizador-proxima").addEventListener("click", function () { abrirItem(itemAtual + 1); });

  visualizador.addEventListener("click", function (evento) {
    if (evento.target === visualizador || evento.target === areaMidia) fecharVisualizador();
  });

  document.addEventListener("keydown", function (evento) {
    if (visualizador.hidden) return;
    if (evento.key === "Escape")     fecharVisualizador();
    if (evento.key === "ArrowLeft")  abrirItem(itemAtual - 1);
    if (evento.key === "ArrowRight") abrirItem(itemAtual + 1);
  });

  let toqueInicialX = 0;
  visualizador.addEventListener("touchstart", function (evento) {
    toqueInicialX = evento.touches[0].clientX;
  }, { passive: true });

  visualizador.addEventListener("touchend", function (evento) {
    const distancia = evento.changedTouches[0].clientX - toqueInicialX;
    if (Math.abs(distancia) > 50) abrirItem(itemAtual + (distancia < 0 ? 1 : -1));
  });
}

async function buscarConfigRemota() {
  const endpoints = ["/api/config?t=" + Date.now()];
  if (!window.location.hostname.includes("natal-quilombo.vercel.app") && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    endpoints.push("https://natal-quilombo.vercel.app/api/config?t=" + Date.now());
  }
  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 3500);
      const res = await fetch(url, {
        cache: "no-store",
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.config && typeof data.config === "object") {
          return data.config;
        }
        if (data && data.blobConfigured === true) {
          return null;
        }
      }
    } catch (_) {}
  }
  return null;
}

function aplicarMergeConfig(parsed) {
  if (!parsed || typeof parsed !== "object") return;
  cfg = Object.assign({}, CONFIG, parsed);
  cfg.pix = Object.assign({}, CONFIG.pix, parsed.pix || {});
  cfg.numeros = Object.assign({}, CONFIG.numeros, parsed.numeros || {});
  cfg.redes = Object.assign({}, CONFIG.redes, parsed.redes || {});
  cfg.textos = Object.assign({}, CONFIG.textos, parsed.textos || {});
  cfg.galeria = Object.assign({}, CONFIG.galeria, parsed.galeria || {});
}

Promise.all([
  buscarConfigRemota(),
  temAlteracoesLocais ? carregarMidiasSalvas() : Promise.resolve(new Map())
]).then(function (resultados) {
  const configRemota = resultados[0];
  const midiasLocais = resultados[1];
  if (configRemota && !emModoRascunho) {
    aplicarMergeConfig(configRemota);
    try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(cfg)); } catch (_) {}
  }
  limparMidiasOrfas(cfg, midiasLocais, CONFIG);
  iniciarSite(midiasLocais);
});
