/* =====================================================================
   CONFIGURAÇÕES DO SITE  ✏️  (EDITE AQUI OU USE O editor.html!)
   ---------------------------------------------------------------------
   DICA MAIS FÁCIL: abra o arquivo editor.html no seu navegador (Chrome ou
   Edge) para trocar links, textos, fotos e vídeos visualmente, sem mexer
   neste código!

   Se preferir editar manualmente:
   - Troque apenas o que está entre aspas "assim".
   - Não apague as vírgulas no final das linhas.
   - Se não quiser um botão (rede social, vakinha), deixe vazio: ""
   ===================================================================== */

const CONFIG = {

  /* ---------------------------------------------------------------
     1. NOME DA AÇÃO E INÍCIO
     Aparece no topo do site, no rodapé e na aba do navegador.
     --------------------------------------------------------------- */
  nomeDaAcao: "Natal Quilombo",
  anoDeInicio: 2007,

  /* ---------------------------------------------------------------
     2. PIX
     O QR Code e o "Pix Copia e Cola" são GERADOS AUTOMATICAMENTE
     a partir destes dados.
     - Celular: pode usar "+5511976226299" ou "11976226299"
     - recebedor: nome do titular da conta (até 25 letras, sem acento)
     - cidade: cidade do recebedor (até 15 letras, sem acento)

     ⚠️ Confira se "recebedor" e "cidade" conferem com a conta titular
     da chave Pix e faça um teste de R$ 1,00 antes de divulgar.
     --------------------------------------------------------------- */
  pix: {
    chave: "+5511976226299",
    recebedor: "NATAL QUILOMBO",
    cidade: "SAO PAULO",
    imagemQrCode: ""
  },

  /* ---------------------------------------------------------------
     3. VAKINHA
     Link da sua vaquinha online. Deixe "" para esconder o botão.
     --------------------------------------------------------------- */
  vakinha: "https://www.vakinha.com.br/6439280?utm_source=site-vakinha&utm_medium=share&utm_campaign=pagina-divulgacao",

  /* ---------------------------------------------------------------
     4. NÚMEROS DE IMPACTO (faixa verde abaixo da capa)
     Escreva só números inteiros, sem pontos. Ex: 1000 (e não 1.000)
     --------------------------------------------------------------- */
  numeros: {
    criancas: 1000,
    itens: 1000,
    voluntarios: 10
  },

  /* ---------------------------------------------------------------
     5. REDES SOCIAIS (seção "Contato")
     Cole o link completo. Deixe "" para esconder o botão.
     --------------------------------------------------------------- */
  redes: {
    instagram: "https://www.instagram.com/natalquilombo?mdxt=ZWFtZTloMGc1aGZ2&utm_source=qr",
    youtube: "",
    tiktok: "",
    whatsapp: ""
  },

  /* ---------------------------------------------------------------
     6. FOTO DE CAPA E TEXTOS PRINCIPAIS
     --------------------------------------------------------------- */
  capa: "imagens/capa.jpg",

  textos: {
    tituloSite: "Natal Quilombo — Vale do Ribeira | Ação social desde 2007",
    descricaoSite: "Vamos juntos fazer um Natal mais feliz para 1.000 crianças quilombolas do Vale do Ribeira. Contribua pela vaquinha, Pix ou doando brinquedos, doces, roupas e produtos de higiene.",
    chamada: "Há {anos} anos levando o Natal para crianças quilombolas do Vale do Ribeira",
    tituloInicio: "Um Natal mais feliz para 1.000 crianças quilombolas.",
    subtituloInicio: "Desde 2007 levamos brinquedos, doces, roupas, produtos de higiene e muito carinho para comunidades quilombolas do Vale do Ribeira. Sua ajuda transforma o Natal de uma criança.",
    tituloDoar: "Doe pelo Pix ou Vakinha e faça parte deste Natal",
    textoDoar: "Contribua com qualquer valor pela vaquinha ou pelo Pix. Todo o valor arrecadado é destinado ao projeto, com prestação de contas e comprovantes dos gastos.",
    valoresDoacao: [
      { valor: "R$ 20", descricao: "ajuda com doces e produtos de higiene" },
      { valor: "R$ 50", descricao: "contribui com brinquedos e roupas" },
      { valor: "R$ 100", descricao: "fortalece o kit completo de uma criança" }
    ],
    obsDoar: "Quer doar brinquedos, doces, roupas ou produtos de higiene?",
    tituloSobre: "Uma tradição feita de gente que se importa",
    sobreParagrafo1: "Tudo começou em 2007, quando um pequeno grupo de amigos decidiu levar brinquedos e alegria para as crianças das comunidades quilombolas do Vale do Ribeira no Natal. A emoção daquele dia foi tão grande que virou compromisso.",
    sobreParagrafo2: "Todos os anos arrecadamos, organizamos e entregamos brinquedos, doces, roupas e produtos de higiene — sempre com prestação de contas, transparência e respeito à história, à cultura e às famílias da comunidade.",
    etapas: [
      {
        titulo: "Arrecadação",
        texto: "Recebemos doações em dinheiro (Pix e Vakinha), brinquedos, doces, roupas e produtos de higiene."
      },
      {
        titulo: "Montagem",
        texto: "Voluntários separam, conferem e montam os kits com todo cuidado para cada faixa etária."
      },
      {
        titulo: "Entrega e Transparência",
        texto: "Entregamos nas comunidades quilombolas do Vale do Ribeira com prestação de contas e comprovantes."
      }
    ],
    tituloContato: "Vamos conversar?",
    textoContato: "Quer ser voluntário, doar brinquedos, doces, roupas ou produtos de higiene, ou acompanhar a prestação de contas? Fale com a gente nas nossas redes."
  },

  /* ---------------------------------------------------------------
     7. CARROSSEL (seção "Sobre nós")
     Cada item pode ser:
       { tipo: "foto",  src: "imagens/arquivo.jpg", legenda: "..." }
       { tipo: "video", src: "videos/arquivo.mp4",  legenda: "..." }
       { tipo: "youtube", id: "CODIGO_OU_LINK",     legenda: "..." }
     --------------------------------------------------------------- */
  carrossel: [
    {
      tipo: "foto",
      src: "imagens/sobre.jpg",
      legenda: "Papai Noel, Mamãe Noel e equipe levando doações até a comunidade no Vale do Ribeira"
    },
    {
      tipo: "foto",
      src: "imagens/capa.jpg",
      legenda: "Papai Noel reunido com crianças e famílias mostrando os presentes recebidos"
    },
    {
      tipo: "foto",
      src: "imagens/entrega-1.jpg",
      legenda: "Voluntários entregando bolas e kits para dezenas de crianças e moradores"
    },
    {
      tipo: "foto",
      src: "imagens/entrega-2.jpg",
      legenda: "Crianças comemorando com bolas, pipas, bambolês e sacolas de Natal"
    },
    {
      tipo: "foto",
      src: "imagens/entrega-3.jpg",
      legenda: "Distribuição de brinquedos e kits para as famílias ao ar livre"
    },
    {
      tipo: "video",
      src: "videos/depoimento-comunidade.mp4",
      legenda: "Depoimento da comunidade sobre a importância do Natal Quilombo"
    }
  ],

  /* ---------------------------------------------------------------
     8. GALERIA DE FOTOS E VÍDEOS (seção "Fotos")
     Dividida nas 3 abas: entrega, montagem e videos.
     --------------------------------------------------------------- */
  galeria: {
    entrega: [
      { tipo: "foto",  src: "imagens/capa.jpg",                          legenda: "Papai Noel reunido com as crianças e famílias da comunidade" },
      { tipo: "foto",  src: "imagens/sobre.jpg",                         legenda: "Equipe e Papai Noel com bebê e família na entrega das doações" },
      { tipo: "foto",  src: "imagens/entrega-1.jpg",                     legenda: "Distribuição de bolas e presentes para as crianças na comunidade" },
      { tipo: "foto",  src: "imagens/entrega-2.jpg",                     legenda: "Crianças sorrindo com bolas, pipas, bambolês e sacolinhas" },
      { tipo: "foto",  src: "imagens/entrega-3.jpg",                     legenda: "Voluntários entregando brinquedos e doces ao ar livre" },
      { tipo: "video", src: "videos/entrega-kombi-van.mp4",              legenda: "Papai Noel e voluntários entregando kits junto aos veículos" },
      { tipo: "video", src: "videos/entrega-galpao-bamboles.mp4",        legenda: "Distribuição de bambolês, bolas e kits no galpão comunitário" },
      { tipo: "video", src: "videos/entrega-pipas-bolas.mp4",            legenda: "Entrega de pipas, bolas e doces para as crianças" },
      { tipo: "video", src: "videos/entrega-ar-livre-bolas.mp4",         legenda: "Entrega de brinquedos e doces para mães e crianças" },
      { tipo: "video", src: "videos/entrega-salao-comunitario.mp4",      legenda: "Ação no salão comunitário com moradores e equipe" },
      { tipo: "video", src: "videos/comunidade-reunida.mp4",             legenda: "Famílias e crianças reunidas aguardando a entrega" },
      { tipo: "video", src: "videos/papai-noel-conversando-criancas.mp4",legenda: "Papai Noel conversando com as crianças da comunidade" },
      { tipo: "video", src: "videos/registro-papai-noel-criancas.mp4",   legenda: "Registro com Papai Noel, equipe e crianças" }
    ],
    montagem: [
      { tipo: "video", src: "videos/chegada-van-doacoes.mp4",            legenda: "Chegada da van carregada e organização das caixas de doações" },
      { tipo: "video", src: "videos/separacao-kits-papai-noel.mp4",      legenda: "Voluntários e Papai Noel separando os kits antes da entrega" }
    ],
    videos: [
      { tipo: "video", src: "videos/depoimento-comunidade.mp4",          legenda: "Depoimento da comunidade no Circuito Quilombola" },
      { tipo: "video", src: "videos/chegada-van-doacoes.mp4",            legenda: "Chegada da van com as doações na comunidade" },
      { tipo: "video", src: "videos/separacao-kits-papai-noel.mp4",      legenda: "Separação e organização dos kits de Natal" },
      { tipo: "video", src: "videos/entrega-kombi-van.mp4",              legenda: "Entrega das sacolas com Papai Noel e equipe" },
      { tipo: "video", src: "videos/entrega-galpao-bamboles.mp4",        legenda: "Distribuição no galpão comunitário" },
      { tipo: "video", src: "videos/entrega-pipas-bolas.mp4",            legenda: "Entrega de pipas, bolas e kits ao ar livre" },
      { tipo: "video", src: "videos/entrega-ar-livre-bolas.mp4",         legenda: "Entrega de bolas e doces para famílias" },
      { tipo: "video", src: "videos/entrega-salao-comunitario.mp4",      legenda: "Distribuição dentro do salão comunitário" },
      { tipo: "video", src: "videos/comunidade-reunida.mp4",             legenda: "Moradores e crianças reunidos na chegada" },
      { tipo: "video", src: "videos/papai-noel-conversando-criancas.mp4",legenda: "Papai Noel conversando com a criançada" },
      { tipo: "video", src: "videos/registro-papai-noel-criancas.mp4",   legenda: "Registro final com Papai Noel, equipe e crianças" }
    ]
  }
};
