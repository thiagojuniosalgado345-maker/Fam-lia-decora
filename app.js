/* Família Decora — catálogo público, disponibilidade sincronizada e orçamento.
   O site lê apenas catálogo e totais de disponibilidade; a agenda privada permanece criptografada no GitHub.
*/
const CONFIG = {
  // Preencher somente depois de a loja confirmar o número oficial com DDI e DDD.
  whatsapp: "",
  instagram: "https://www.instagram.com/familiadecora_oficial/"
};
const DEFAULT_PRODUCTS = [
  {id:"kit-pequeno",name:"Kit Pegue e Monte",category:"Kits",tag:"Kit para festa",description:"Uma seleção prática de peças para montar uma comemoração do seu jeito.",image:"https://images.unsplash.com/photo-1519225421980-888cb4c1e12c?auto=format&fit=crop&w=1000&q=85"},
  {id:"kit-mini-table",name:"Mini table",category:"Kits",tag:"Comemoração intimista",description:"Uma composição compacta para aniversários e encontros especiais.",image:"https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1000&q=85"},
  {id:"paineis",name:"Painéis decorativos",category:"Painéis",tag:"Cenário",description:"Painéis para dar destaque ao tema e criar o cenário da comemoração.",image:"https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1000&q=85"},
  {id:"cilindros",name:"Cilindros decorativos",category:"Móveis",tag:"Peças avulsas",description:"Peças de diferentes alturas para montar uma composição personalizada.",image:"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=85"},
  {id:"mesa",name:"Mesas para decoração",category:"Móveis",tag:"Peças avulsas",description:"Móveis de apoio para destacar bolo, doces e outros elementos decorativos.",image:"https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85"},
  {id:"pecas",name:"Bandejas e acessórios",category:"Peças",tag:"Complemente sua festa",description:"Detalhes para completar kits ou criar uma decoração com a sua identidade.",image:"https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1000&q=85"}
];
const PRODUCTS_KEY = "familia-decora-products-v2";
const PUBLIC_DATA_URL = "data/agenda.json";
let publicAvailability = null;
let publicDataUpdatedAt = null;
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeRead = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const safeWrite = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
function safeImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
function normalizeProducts(list) {
  if (!Array.isArray(list)) return DEFAULT_PRODUCTS.slice();
  const ids = new Set();
  return list.filter(product => {
    if (!product || typeof product !== "object") return false;
    const id = String(product.id || "").trim();
    const name = String(product.name || "").trim();
    const category = String(product.category || "").trim();
    const description = String(product.description || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || ids.has(id) || !name || !category || !description) return false;
    ids.add(id);
    return true;
  }).map(product => ({
    id: String(product.id),
    name: String(product.name).trim().slice(0, 80),
    category: String(product.category).trim().slice(0, 40),
    tag: String(product.tag || product.category).trim().slice(0, 35),
    description: String(product.description).trim().slice(0, 180),
    image: safeImageUrl(product.image) || DEFAULT_PRODUCTS[0].image,
    stock: Number.isInteger(Number(product.stock)) && Number(product.stock) >= 0 ? Number(product.stock) : 1
  }));
}
let products = DEFAULT_PRODUCTS.slice();
let selected = Object.create(null);
let category = "Todos";
let query = "";
let returnFocus = null;

function localToday() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function getSelectedEventDate() {
  return $("quoteForm").elements.date.value || "";
}
function availabilityFor(product, date) {
  if (!product || !date || !publicAvailability || publicAvailability.enabled !== true || date < publicAvailability.from || date > publicAvailability.through) return null;
  const day = publicAvailability.days && publicAvailability.days[date];
  if (day && Object.prototype.hasOwnProperty.call(day,product.id)) {
    return Math.max(0,Number(day[product.id]) || 0);
  }
  return Math.max(0,Number(product.stock) || 0);
}
async function loadPublicData() {
  try {
    const response = await fetch(PUBLIC_DATA_URL + "?v=" + Date.now(),{cache:"no-store"});
    if (!response.ok) throw new Error("Falha ao consultar catálogo atualizado.");
    const documentData = await response.json();
    if (documentData.schemaVersion !== 1 || !Array.isArray(documentData.products)) {
      throw new Error("Arquivo de catálogo em formato inválido.");
    }
    const remoteProducts = normalizeProducts(documentData.products);
    products = remoteProducts;
    publicAvailability = documentData.availability && typeof documentData.availability === "object"
      ? documentData.availability
      : null;
    publicDataUpdatedAt = documentData.updatedAt || null;
    selected = Object.fromEntries(Object.entries(selected).filter(([id]) => products.some(product => product.id === id)));
    if (!categories().includes(category)) category = "Todos";
    renderFilters();
    renderProducts();
    renderQuote();
  } catch (error) {
    console.warn("Não foi possível atualizar os dados da loja:",error);
  }
}
function categories() {
  return ["Todos", ...new Set(products.map(product => product.category).filter(Boolean))];
}
function renderFilters() {
  if (!categories().includes(category)) category = "Todos";
  $("filters").innerHTML = categories().map(item =>
    '<button type="button" class="filter-chip ' + (category === item ? "active" : "") +
    '" data-filter="' + escapeHtml(item) + '" aria-pressed="' + (category === item) + '">' +
    escapeHtml(item) + '</button>'
  ).join("");
  $("filters").querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      category = button.dataset.filter;
      renderFilters();
      renderProducts();
    });
  });
}
function renderProducts() {
  const filtered = products.filter(product =>
    (category === "Todos" || product.category === category) &&
    [product.name, product.category, product.description, product.tag].join(" ").toLocaleLowerCase("pt-BR").includes(query)
  );
  const date = getSelectedEventDate();
  $("productGrid").innerHTML = filtered.length ? filtered.map(product => {
    const available = availabilityFor(product,date);
    const availabilityLabel = !date
      ? "Informe a data para consultar"
      : available === null
        ? "Consulte a equipe para esta data"
        : available > 0
          ? available + (available === 1 ? " unidade livre" : " unidades livres") + " na data"
          : "Sem unidades livres na data";
    const disabled = available === 0;
    return '<article class="product-card">' +
      '<div class="product-photo"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) +
      '" loading="lazy"><span class="photo-label">' + escapeHtml(product.tag || product.category) + '</span></div>' +
      '<div class="product-info"><div class="product-category">' + escapeHtml(product.category) + '</div>' +
      '<h3>' + escapeHtml(product.name) + '</h3><p>' + escapeHtml(product.description) + '</p>' +
      '<div class="product-bottom"><span class="price-hint">' + escapeHtml(availabilityLabel) + '</span>' +
      '<button type="button" class="add-button" data-add="' + escapeHtml(product.id) + '"' +
      (disabled ? ' disabled aria-disabled="true"' : '') + '>' +
      (disabled ? "Indisponível nesta data" : "Adicionar ao orçamento +") + '</button></div></div>' +
    '</article>';
  }).join("") : '<div class="no-results">Não encontramos itens com essa busca. Tente outro termo ou categoria.</div>';
  $("productGrid").querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => addItem(button.dataset.add));
  });
}
function addItem(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const available = availabilityFor(product,getSelectedEventDate());
  if (available === 0) {
    notify("Este item não tem unidades livres para a data escolhida.");
    return;
  }
  if (available !== null && (selected[id] || 0) >= available) {
    notify("Você já selecionou todas as unidades livres para esta data.");
    return;
  }
  selected[id] = Math.min(99, (selected[id] || 0) + 1);
  renderQuote();
  openQuote();
  notify("Item adicionado ao seu orçamento.");
}
function quoteEntries() {
  return Object.entries(selected).map(([id, quantity]) => ({
    product: products.find(product => product.id === id),
    quantity: Number(quantity)
  })).filter(item => item.product && Number.isFinite(item.quantity) && item.quantity > 0);
}
function renderQuote() {
  const entries = quoteEntries();
  const total = entries.reduce((sum, item) => sum + item.quantity, 0);
  $("quoteCount").textContent = total;
  const date = getSelectedEventDate();
  $("quoteItems").innerHTML = entries.length
    ? '<div class="quote-lines">' + entries.map(({product, quantity}) => {
      const available = availabilityFor(product,date);
      const availabilityText = !date
        ? "Informe a data para consultar disponibilidade."
        : available === null
          ? "Confirme a disponibilidade com a equipe."
          : available > 0
            ? available + (available === 1 ? " unidade livre na data." : " unidades livres na data.")
            : "Sem unidades livres nesta data.";
      const plusDisabled = available !== null && quantity >= available;
      return '<div class="quote-line"><img src="' + escapeHtml(product.image) + '" alt=""><div><strong>' +
        escapeHtml(product.name) + '</strong><small>' + escapeHtml(product.category) + '</small>' +
        '<div class="quantity"><button type="button" data-qty="' + escapeHtml(product.id) +
        '" data-step="-1" aria-label="Diminuir quantidade">−</button><span>' + quantity +
        '</span><button type="button" data-qty="' + escapeHtml(product.id) +
        '" data-step="1" aria-label="Aumentar quantidade"' + (plusDisabled ? ' disabled' : '') + '>+</button></div></div>' +
        '<button type="button" class="remove-button" data-remove="' + escapeHtml(product.id) +
        '" aria-label="Remover item">×</button><small class="quote-availability">' + escapeHtml(availabilityText) + '</small></div>';
    }).join("") + '</div>'
    : '<div class="empty-quote">Seu orçamento ainda está vazio.<br>Escolha as peças que deseja consultar no catálogo. ♡</div>';
  $("quoteItems").querySelectorAll("[data-qty]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.qty;
      selected[id] = Math.max(0, (selected[id] || 0) + Number(button.dataset.step));
      if (!selected[id]) delete selected[id];
      renderQuote();
      renderProducts();
    });
  });
  $("quoteItems").querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      delete selected[button.dataset.remove];
      renderQuote();
      renderProducts();
    });
  });
  $("sendQuote").disabled = !entries.length;
  $("sendQuote").setAttribute("aria-disabled", String(!entries.length));
  $("openQuote").setAttribute("aria-expanded", String($("quoteDrawer").classList.contains("open")));
}
function openQuote() {
  const drawer = $("quoteDrawer");
  if (drawer.classList.contains("open")) return;
  returnFocus = document.activeElement;
  drawer.inert = false;
  $("overlay").classList.add("open");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  $("openQuote").setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  $("closeQuote").focus();
}
function closeQuote(restoreFocus = true) {
  const drawer = $("quoteDrawer");
  if (!drawer.classList.contains("open")) return;
  $("overlay").classList.remove("open");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  $("openQuote").setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
  if (restoreFocus && returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
}
async function copyMessage(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Tenta o método compatível com navegadores mais antigos.
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}
async function sendQuote() {
  const form = $("quoteForm");
  if (!quoteEntries().length) {
    notify("Adicione ao menos um item ao orçamento.");
    return;
  }
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const date = String(data.get("date") || "");
  if (date < localToday()) {
    notify("Escolha hoje ou uma data futura para o evento.");
    return;
  }
  const phone = String(data.get("phone") || "");
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    notify("Confira o número de WhatsApp informado.");
    form.elements.phone.focus();
    return;
  }
  for (const item of quoteEntries()) {
    const available = availabilityFor(item.product,date);
    if (available === 0 || (available !== null && item.quantity > available)) {
      notify("A quantidade de " + item.product.name + " não está disponível para a data escolhida. Revise seu orçamento.");
      renderProducts();
      renderQuote();
      return;
    }
  }
  const lines = quoteEntries().map(item => "• " + item.quantity + "x " + item.product.name);
  const message = [
    "Olá, Família Decora! Gostaria de solicitar um orçamento.",
    "",
    "Nome: " + data.get("name"),
    "WhatsApp para retorno: " + phone,
    "Data do evento: " + new Date(date + "T12:00:00").toLocaleDateString("pt-BR"),
    "Tipo de evento: " + data.get("event"),
    "Preferência: " + data.get("delivery"),
    data.get("neighborhood") ? "Bairro/região: " + data.get("neighborhood") : null,
    "",
    "Itens selecionados:",
    ...lines,
    data.get("notes") ? "Detalhes: " + data.get("notes") : null,
    "",
    "Podem confirmar disponibilidade, valores e condições?"
  ].filter(Boolean).join("\n");
  if (!/^\d{12,13}$/.test(CONFIG.whatsapp)) {
    window.open(CONFIG.instagram, "_blank", "noopener,noreferrer");
    const copied = await copyMessage(message);
    if (copied) {
      notify("Pedido copiado. Cole a mensagem na conversa do Instagram; se ele não abrir, acesse o perfil da loja.");
    } else {
      window.prompt("Não foi possível copiar automaticamente. Copie sua solicitação abaixo:", message);
      notify("Acesse o Instagram da loja para enviar sua solicitação.");
    }
    return;
  }
  const whatsappUrl = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(message);
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  notify("Mensagem preparada. Conclua o envio na conversa do WhatsApp.");
}
function init() {
  $("year").textContent = new Date().getFullYear();
  $("quoteForm").elements.date.min = localToday();
  $("quoteForm").elements.date.addEventListener("change", () => {
    renderProducts();
    renderQuote();
  });
  $("openQuote").addEventListener("click", openQuote);
  $("faqOpenQuote").addEventListener("click", openQuote);
  $("closeQuote").addEventListener("click", () => closeQuote());
  $("overlay").addEventListener("click", () => closeQuote());
  $("sendQuote").addEventListener("click", sendQuote);
  $("productSearch").addEventListener("input", event => {
    query = event.target.value.toLocaleLowerCase("pt-BR").trim();
    renderProducts();
  });
  $("menuToggle").addEventListener("click", () => {
    const open = $("mainNav").classList.toggle("open");
    $("menuToggle").setAttribute("aria-expanded", String(open));
    $("menuToggle").setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    $("menuToggle").textContent = open ? "×" : "☰";
  });
  $("mainNav").querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    $("mainNav").classList.remove("open");
    $("menuToggle").setAttribute("aria-expanded", "false");
    $("menuToggle").setAttribute("aria-label", "Abrir menu");
    $("menuToggle").textContent = "☰";
  }));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeQuote();
    if (event.key !== "Tab" || !$("quoteDrawer").classList.contains("open")) return;
    const focusable = Array.from($("quoteDrawer").querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])'
    )).filter(element => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  $("quoteDrawer").inert = true;
  renderFilters();
  renderProducts();
  renderQuote();
  void loadPublicData();
  window.setInterval(() => {
    if (document.visibilityState === "visible") void loadPublicData();
  },60000);
}
init();
