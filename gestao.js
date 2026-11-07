/* Área local de demonstração. Não oferece autenticação nem sincronização entre aparelhos. */
const PRODUCT_KEY = "familia-decora-products-v2";
const BLOCK_KEY = "familia-decora-blocked-dates-v1";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1519225421980-888cb4c1e12c?auto=format&fit=crop&w=900&q=80";
const DEFAULT = [
  {id:"kit-pequeno",name:"Kit Pegue e Monte",category:"Kits",tag:"Kit para festa",description:"Uma seleção prática de peças para montar uma comemoração do seu jeito.",image:"https://images.unsplash.com/photo-1519225421980-888cb4c1e12c?auto=format&fit=crop&w=1000&q=85"},
  {id:"kit-mini-table",name:"Mini table",category:"Kits",tag:"Comemoração intimista",description:"Uma composição compacta para aniversários e encontros especiais.",image:"https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1000&q=85"},
  {id:"paineis",name:"Painéis decorativos",category:"Painéis",tag:"Cenário",description:"Painéis para dar destaque ao tema e criar o cenário da comemoração.",image:"https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1000&q=85"},
  {id:"cilindros",name:"Cilindros decorativos",category:"Móveis",tag:"Peças avulsas",description:"Peças de diferentes alturas para montar uma composição personalizada.",image:"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=85"},
  {id:"mesa",name:"Mesas para decoração",category:"Móveis",tag:"Peças avulsas",description:"Móveis de apoio para destacar bolo, doces e outros elementos decorativos.",image:"https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85"},
  {id:"pecas",name:"Bandejas e acessórios",category:"Peças",tag:"Complemente sua festa",description:"Detalhes para completar kits ou criar uma decoração com a sua identidade.",image:"https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1000&q=85"}
];
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    alert("O navegador não conseguiu salvar. Verifique o espaço disponível e as permissões.");
    return false;
  }
}
function safeImage(value) {
  if (!value) return FALLBACK_IMAGE;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
function normalizeProduct(product) {
  if (!product || typeof product !== "object") return null;
  const id = String(product.id || "").trim();
  const name = String(product.name || "").trim().slice(0, 80);
  const category = String(product.category || "").trim().slice(0, 40);
  const description = String(product.description || "").trim().slice(0, 180);
  const image = safeImage(product.image);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !name || !category || !description || !image) return null;
  return {
    id,
    name,
    category,
    tag: String(product.tag || "Consulte").trim().slice(0, 35),
    description,
    image
  };
}
function normalizeCatalog(value) {
  if (!Array.isArray(value) || value.length > 300) return null;
  const normalized = value.map(normalizeProduct);
  if (normalized.some(product => !product)) return null;
  const ids = normalized.map(product => product.id);
  if (new Set(ids).size !== ids.length) return null;
  return normalized;
}
function localDateISO() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
let storedProducts = readStorage(PRODUCT_KEY, DEFAULT);
let products = normalizeCatalog(storedProducts) ?? DEFAULT.slice();
let blocked = readStorage(BLOCK_KEY, []);
if (!Array.isArray(blocked)) blocked = [];
blocked = blocked.filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date)).map(item => ({
  date: item.date,
  note: String(item.note || "").slice(0, 100)
}));
let editingId = null;

function renderProducts() {
  $("productTotal").textContent = products.length + (products.length === 1 ? " item" : " itens");
  $("productRows").innerHTML = products.map(product =>
    '<tr><td>' + escapeHtml(product.name) + '</td><td>' + escapeHtml(product.category) +
    '</td><td class="row-actions"><button type="button" data-edit="' + escapeHtml(product.id) +
    '">Editar</button> <button type="button" data-delete="' + escapeHtml(product.id) + '">Excluir</button></td></tr>'
  ).join("") || '<tr><td colspan="3">Nenhum produto cadastrado.</td></tr>';

  $("productRows").querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => editProduct(button.dataset.edit));
  });
  $("productRows").querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("Excluir este produto do catálogo?")) return;
      products = products.filter(product => product.id !== button.dataset.delete);
      if (!writeStorage(PRODUCT_KEY, products)) return;
      if (editingId === button.dataset.delete) resetProductForm();
      renderProducts();
    });
  });
}
function editProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  editingId = id;
  const form = $("productForm");
  form.elements.name.value = product.name;
  form.elements.category.value = product.category;
  form.elements.tag.value = product.tag;
  form.elements.image.value = product.image;
  form.elements.description.value = product.description;
  $("saveProduct").textContent = "Salvar alterações";
  $("cancelEdit").hidden = false;
  form.scrollIntoView({behavior:"smooth", block:"center"});
  form.elements.name.focus();
}
function resetProductForm() {
  editingId = null;
  $("productForm").reset();
  $("saveProduct").textContent = "Salvar produto +";
  $("cancelEdit").hidden = true;
}
function renderBlocked() {
  blocked.sort((a, b) => a.date.localeCompare(b.date));
  $("blockedRows").innerHTML = blocked.map(item =>
    '<tr><td>' + new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR") +
    '</td><td>' + escapeHtml(item.note || "Data bloqueada") +
    '</td><td><button type="button" data-unblock="' + escapeHtml(item.date) + '">Desbloquear</button></td></tr>'
  ).join("") || '<tr><td colspan="3">Nenhuma data anotada.</td></tr>';
  $("blockedRows").querySelectorAll("[data-unblock]").forEach(button => {
    button.addEventListener("click", () => {
      blocked = blocked.filter(item => item.date !== button.dataset.unblock);
      if (writeStorage(BLOCK_KEY, blocked)) renderBlocked();
    });
  });
}

$("productForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const rawImage = String(data.get("image") || "").trim();
  const image = rawImage ? safeImage(rawImage) : FALLBACK_IMAGE;
  if (!image) {
    alert("Informe uma URL de imagem HTTPS válida.");
    return;
  }
  const id = editingId || ("produto-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now()));
  const product = normalizeProduct({
    id,
    name: data.get("name"),
    category: data.get("category"),
    tag: data.get("tag"),
    description: data.get("description"),
    image
  });
  if (!product) {
    alert("Confira os campos do produto. Nome, categoria e descrição são obrigatórios.");
    return;
  }
  const wasEditing = Boolean(editingId);
  const nextProducts = wasEditing
    ? products.map(item => item.id === editingId ? product : item)
    : [...products, product];
  if (!writeStorage(PRODUCT_KEY, nextProducts)) return;
  products = nextProducts;
  resetProductForm();
  renderProducts();
  alert(wasEditing ? "Produto atualizado neste navegador." : "Produto salvo neste navegador.");
});
$("cancelEdit").addEventListener("click", resetProductForm);
$("restoreProducts").addEventListener("click", () => {
  if (!confirm("Restaurar os produtos de exemplo? Isso substituirá o catálogo salvo neste navegador.")) return;
  if (!writeStorage(PRODUCT_KEY, DEFAULT)) return;
  products = DEFAULT.slice();
  resetProductForm();
  renderProducts();
});
$("exportCatalog").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(products, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "familia-decora-catalogo.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("importCatalog").addEventListener("change", async event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("Arquivo muito grande.");
    const parsed = JSON.parse(await file.text());
    const validated = normalizeCatalog(parsed);
    if (!validated) throw new Error("Catálogo inválido.");
    if (!writeStorage(PRODUCT_KEY, validated)) return;
    products = validated;
    resetProductForm();
    renderProducts();
    alert("Catálogo importado neste navegador.");
  } catch {
    alert("Não foi possível importar. Use um JSON exportado por esta ferramenta, com até 300 itens e imagens HTTPS.");
  } finally {
    event.target.value = "";
  }
});
$("blockForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const date = String(data.get("date") || "");
  const note = String(data.get("note") || "").trim().slice(0, 100);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < localDateISO()) {
    alert("Escolha uma data válida de hoje em diante.");
    return;
  }
  if (blocked.some(item => item.date === date)) {
    alert("Esta data já está anotada.");
    return;
  }
  const nextBlocked = [...blocked, {date, note}];
  if (!writeStorage(BLOCK_KEY, nextBlocked)) return;
  blocked = nextBlocked;
  event.currentTarget.reset();
  renderBlocked();
});
$("blockForm").elements.date.min = localDateISO();
$("cancelEdit").hidden = true;
renderProducts();
renderBlocked();
