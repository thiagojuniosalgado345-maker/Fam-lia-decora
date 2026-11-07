/* Família Decora — catálogo público e solicitação de orçamento.
   Dados do evento são enviados ao WhatsApp e não são salvos pelo site.
   O catálogo local é apenas uma solução provisória; não sincroniza aparelhos.
*/
const CONFIG = {
  whatsapp: "5538991234590",
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
    image: safeImageUrl(product.image) || DEFAULT_PRODUCTS[0].image
  }));
}
let products = normalizeProducts(safeRead(PRODUCTS_KEY, DEFAULT_PRODUCTS));
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
  $("productGrid").innerHTML = filtered.length ? filtered.map(product =>
    '<article class="product-card">' +
      '<div class="product-photo"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) +
      '" loading="lazy"><span class="photo-label">' + escapeHtml(product.tag || product.category) + '</span></div>' +
      '<div class="product-info"><div class="product-category">' + escapeHtml(product.category) + '</div>' +
      '<h3>' + escapeHtml(product.name) + '</h3><p>' + escapeHtml(product.description) + '</p>' +
      '<div class="product-bottom"><span class="price-hint">Consulte disponibilidade</span>' +
      '<button type="button" class="add-button" data-add="' + escapeHtml(product.id) + '">Adicionar ao orçamento +</button></div></div>' +
    '</article>'
  ).join("") : '<div class="no-results">Não encontramos itens com essa busca. Tente outro termo ou categoria.</div>';
  $("productGrid").querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => addItem(button.dataset.add));
  });
}
function addItem(id) {
  if (!products.some(product => product.id === id)) return;
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
  $("quoteItems").innerHTML = entries.length ? '<div class="quote-lines">' + entries.map(({product, quantity}) =>
    '<div class="quote-line"><img src="' + escapeHtml(product.image) + '" alt=""><div><strong>' +
    escapeHtml(product.name) + '</strong><small>' + escapeHtml(product.category) + '</small>' +
    '<div class="quantity"><button type="button" data-qty="' + escapeHtml(product.id) +
    '" data-step="-1" aria-label="Diminuir quantidade">−</button><span>' + quantity +
    '</span><button type="button" data-qty="' + escapeHtml(product.id) +
    '" data-step="1" aria-label="Aumentar quantidade">+</button></div></div>' +
    '<button type="button" class="remove-button" data-remove="' + escapeHtml(product.id) +
    '" aria-label="Remover item">×</button></div>'
  ).join("") + '</div>' : '<div class="empty-quote">Seu orçamento ainda está vazio.<br>Escolha as peças que deseja consultar no catálogo. ♡</div>';
  $("quoteItems").querySelectorAll("[data-qty]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.qty;
      selected[id] = Math.max(0, (selected[id] || 0) + Number(button.dataset.step));
      if (!selected[id]) delete selected[id];
      renderQuote();
    });
  });
  $("quoteItems").querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      delete selected[button.dataset.remove];
      renderQuote();
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
function sendQuote() {
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
  if (!/^\d{12,13}$/.test(CONFIG.whatsapp)) {
    notify("O WhatsApp da loja ainda não foi configurado. Entre em contato pelo Instagram.");
    return;
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
  const whatsappUrl = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(message);
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  notify("Mensagem preparada. Conclua o envio na conversa do WhatsApp.");
}
function init() {
  $("year").textContent = new Date().getFullYear();
  $("quoteForm").elements.date.min = localToday();
  $("openQuote").addEventListener("click", openQuote);
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
  window.addEventListener("storage", event => {
    if (event.key !== PRODUCTS_KEY) return;
    products = normalizeProducts(safeRead(PRODUCTS_KEY, DEFAULT_PRODUCTS));
    selected = Object.fromEntries(Object.entries(selected).filter(([id]) => products.some(product => product.id === id)));
    renderFilters();
    renderProducts();
    renderQuote();
  });
  $("quoteDrawer").inert = true;
  renderFilters();
  renderProducts();
  renderQuote();
}
init();
