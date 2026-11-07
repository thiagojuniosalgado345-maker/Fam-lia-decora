/* Agenda e estoque local de demonstração da Família Decora.
   Não substitui banco de dados, autenticação ou sincronização entre aparelhos. */
const PRODUCT_KEY = "familia-decora-products-v2";
const EVENT_KEY = "familia-decora-events-v1";
const UNAVAILABLE_KEY = "familia-decora-unavailable-items-v1";
const GITHUB_REPOSITORY = "thiagojuniosalgado345-maker/Fam-lia-decora";
const GITHUB_DATA_PATH = "data/agenda.json";
const GITHUB_API_URL = "https://api.github.com/repos/" + GITHUB_REPOSITORY + "/contents/" + GITHUB_DATA_PATH;
const CRYPTO_ITERATIONS = 310000;
let githubToken = "";
let agendaPassphrase = "";
let githubSha = "";
let githubReady = false;
let githubSaveInProgress = false;
let publicDocument = null;
let publishAvailability = false;
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1519225421980-888cb4c1e12c?auto=format&fit=crop&w=900&q=80";
const DEFAULT = [
  {id:"kit-pequeno",name:"Kit Pegue e Monte",category:"Kits",tag:"Kit para festa",description:"Uma seleção prática de peças para montar uma comemoração do seu jeito.",image:"https://images.unsplash.com/photo-1519225421980-888cb4c1e12c?auto=format&fit=crop&w=1000&q=85",stock:1},
  {id:"kit-mini-table",name:"Mini table",category:"Kits",tag:"Comemoração intimista",description:"Uma composição compacta para aniversários e encontros especiais.",image:"https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1000&q=85",stock:1},
  {id:"paineis",name:"Painéis decorativos",category:"Painéis",tag:"Cenário",description:"Painéis para dar destaque ao tema e criar o cenário da comemoração.",image:"https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1000&q=85",stock:1},
  {id:"cilindros",name:"Cilindros decorativos",category:"Móveis",tag:"Peças avulsas",description:"Peças de diferentes alturas para montar uma composição personalizada.",image:"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=85",stock:1},
  {id:"mesa",name:"Mesas para decoração",category:"Móveis",tag:"Peças avulsas",description:"Móveis de apoio para destacar bolo, doces e outros elementos decorativos.",image:"https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85",stock:1},
  {id:"pecas",name:"Bandejas e acessórios",category:"Peças",tag:"Complemente sua festa",description:"Detalhes para completar kits ou criar uma decoração com a sua identidade.",image:"https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1000&q=85",stock:1}
];
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const validId = value => /^[a-zA-Z0-9_-]{1,120}$/.test(String(value || ""));
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2];
};
function localDateISO(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function dateFromISO(value) {
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function shiftDate(value, amount) {
  const date = dateFromISO(value);
  date.setDate(date.getDate() + amount);
  return localDateISO(date);
}
function randomId(prefix) {
  const suffix = window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  return prefix + "-" + suffix;
}
function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function setGithubStatus(message, state = "") {
  const element = $("githubStatus");
  if (!element) return;
  element.textContent = message;
  element.className = "github-status" + (state ? " is-" + state : "");
  $("refreshGithub").disabled = !githubReady || githubSaveInProgress;
  $("disconnectGithub").disabled = !githubReady && !githubToken;
  $("connectGithub").disabled = githubSaveInProgress;
  $("publishAvailability").disabled = !githubReady || githubSaveInProgress;
}
function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
function base64ToUtf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
async function fetchGithubDocument() {
  const response = await fetch(GITHUB_API_URL, {
    method:"GET",
    cache:"no-store",
    headers:{
      "Accept":"application/vnd.github+json",
      "Authorization":"Bearer " + githubToken,
      "X-GitHub-Api-Version":"2022-11-28"
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("O GitHub recusou o token. Confira se ele é Fine-grained, pertence à sua conta e tem Contents: Read and write neste repositório.");
    }
    throw new Error("Não foi possível ler o arquivo da agenda no GitHub (HTTP " + response.status + ").");
  }
  if (!result.content || !result.sha) throw new Error("O arquivo data/agenda.json está vazio ou em formato inesperado.");
  const documentData = JSON.parse(base64ToUtf8(result.content));
  if (documentData.schemaVersion !== 1 || !Array.isArray(documentData.products)) {
    throw new Error("O arquivo de dados do GitHub não segue o formato esperado.");
  }
  return {document:documentData,sha:result.sha};
}
async function deriveAgendaKey(passphrase, salt) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {name:"PBKDF2",salt,iterations:CRYPTO_ITERATIONS,hash:"SHA-256"},
    material,
    {name:"AES-GCM",length:256},
    false,
    ["encrypt","decrypt"]
  );
}
async function encryptPrivateAgenda(snapshot) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAgendaKey(agendaPassphrase, salt);
  const privateData = {
    events:snapshot.events,
    unavailable:snapshot.unavailable
  };
  const encrypted = await crypto.subtle.encrypt(
    {name:"AES-GCM",iv},
    key,
    new TextEncoder().encode(JSON.stringify(privateData))
  );
  return {
    version:1,
    algorithm:"AES-256-GCM",
    kdf:"PBKDF2-SHA-256",
    iterations:CRYPTO_ITERATIONS,
    salt:utf8BytesToBase64(salt),
    iv:utf8BytesToBase64(iv),
    ciphertext:utf8BytesToBase64(new Uint8Array(encrypted))
  };
}
function utf8BytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
async function decryptPrivateAgenda(record) {
  if (!record || record.version !== 1 || record.algorithm !== "AES-256-GCM" ||
      record.kdf !== "PBKDF2-SHA-256" || record.iterations !== CRYPTO_ITERATIONS) {
    throw new Error("O conteúdo criptografado da agenda não é compatível.");
  }
  try {
    const key = await deriveAgendaKey(agendaPassphrase, base64ToBytes(record.salt));
    const plain = await crypto.subtle.decrypt(
      {name:"AES-GCM",iv:base64ToBytes(record.iv)},
      key,
      base64ToBytes(record.ciphertext)
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain));
    if (!Array.isArray(parsed.events) || !Array.isArray(parsed.unavailable)) {
      throw new Error("Formato da agenda inválido.");
    }
    return parsed;
  } catch {
    throw new Error("Não foi possível abrir a agenda. A senha está incorreta ou o arquivo foi alterado.");
  }
}
function datePlusDays(dateValue, amount) {
  const date = dateFromISO(dateValue);
  date.setDate(date.getDate() + amount);
  return localDateISO(date);
}
function buildPublicAvailability(snapshot) {
  if (!publishAvailability) return {enabled:false,from:null,through:null,days:{}};
  const used = new Map();
  function addUse(date, productId, quantity) {
    if (!used.has(date)) used.set(date, new Map());
    const day = used.get(date);
    day.set(productId, (day.get(productId) || 0) + quantity);
  }
  snapshot.events.filter(event => eventUsesInventory(event)).forEach(event => {
    event.items.forEach(item => addUse(event.date,item.productId,item.quantity));
  });
  snapshot.unavailable.forEach(block => {
    let date = block.startDate;
    let guard = 0;
    while (date <= block.endDate && guard < 740) {
      addUse(date,block.productId,block.quantity);
      date = datePlusDays(date,1);
      guard += 1;
    }
  });
  const from = localDateISO();
  const throughCandidates = [datePlusDays(from,365)];
  snapshot.events.forEach(event => throughCandidates.push(event.date));
  snapshot.unavailable.forEach(block => throughCandidates.push(block.endDate));
  const through = throughCandidates.sort().pop();
  const days = {};
  used.forEach((byProduct,date) => {
    const values = {};
    byProduct.forEach((quantity,productId) => {
      const product = snapshot.products.find(item => item.id === productId);
      if (product) values[productId] = Math.max(0,product.stock-quantity);
    });
    days[date] = values;
  });
  return {enabled:true,from,through,days};
}
function cleanSnapshot(snapshot) {
  return JSON.parse(JSON.stringify({
    products:snapshot.products,
    events:snapshot.events,
    unavailable:snapshot.unavailable
  }));
}
async function commitGithubSnapshot(snapshotValue, successMessage = "Alterações salvas no GitHub.") {
  if (!githubToken || !agendaPassphrase || !githubSha) {
    setGithubStatus("Conecte ao GitHub para salvar.");
    return false;
  }
  if (githubSaveInProgress) return false;
  githubSaveInProgress = true;
  setGithubStatus("Salvando no GitHub…","saving");
  const snapshot = cleanSnapshot(snapshotValue);
  try {
    const latest = await fetchGithubDocument();
    if (latest.sha !== githubSha) {
      throw new Error("O arquivo foi alterado no GitHub por outro acesso. Para evitar apagar dados, use Atualizar do GitHub; o painel não sobrescreveu a versão mais recente.");
    }
    const nextDocument = {
      schemaVersion:1,
      initialized:true,
      updatedAt:new Date().toISOString(),
      products:snapshot.products,
      availability:buildPublicAvailability(snapshot),
      privateAgenda:await encryptPrivateAgenda(snapshot)
    };
    const response = await fetch(GITHUB_API_URL,{
      method:"PUT",
      headers:{
        "Accept":"application/vnd.github+json",
        "Authorization":"Bearer " + githubToken,
        "X-GitHub-Api-Version":"2022-11-28",
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        message:"Atualizar agenda, estoque e disponibilidade da Família Decora",
        content:utf8ToBase64(JSON.stringify(nextDocument,null,2)),
        sha:githubSha
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.content || !result.content.sha) {
      throw new Error(response.status === 409 || response.status === 422
        ? "O GitHub identificou uma gravação concorrente. Atualize os dados antes de salvar novamente."
        : "O GitHub não aceitou a gravação (HTTP " + response.status + "). Confira a permissão Contents: Read and write do token.");
    }
    githubSha = result.content.sha;
    publicDocument = nextDocument;
    setGithubStatus("Conectado · salvo às " + new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),"connected");
    if (successMessage) $("githubStatus").title = successMessage;
    return true;
  } catch (error) {
    setGithubStatus(githubReady ? "Falha ao salvar" : "Atualize e conecte novamente.");
    alert(error.message || "Não foi possível salvar a agenda no GitHub.");
    return false;
  } finally {
    githubSaveInProgress = false;
    $("refreshGithub").disabled = !githubReady;
    $("disconnectGithub").disabled = !githubReady;
    $("connectGithub").disabled = false;
    $("publishAvailability").disabled = !githubReady;
  }
}
function writeStorage(key, value, successMessage = "") {
  if (!githubReady) {
    alert("Primeiro conecte a agenda ao GitHub na parte superior desta página.");
    return false;
  }
  if (githubSaveInProgress) {
    alert("Uma gravação está em andamento. Aguarde a confirmação antes de fazer outra alteração.");
    return false;
  }
  const snapshot = {
    products:key === PRODUCT_KEY ? value : products,
    events:key === EVENT_KEY ? value : events,
    unavailable:key === UNAVAILABLE_KEY ? value : unavailable
  };
  void commitGithubSnapshot(snapshot,successMessage);
  return true;
}
async function loadGithubIntoPanel(documentData, sha) {
  const remoteProducts = normalizeCatalog(documentData.products);
  if (!remoteProducts || remoteProducts.length !== documentData.products.length) {
    throw new Error("O catálogo publicado no arquivo de dados está inválido.");
  }
  products = remoteProducts;
  publishAvailability = Boolean(documentData.availability && documentData.availability.enabled === true);
  $("publishAvailability").checked = publishAvailability;
  githubSha = sha;
  publicDocument = documentData;
  if (!documentData.privateAgenda) {
    events = [];
    unavailable = [];
    githubReady = true;
    const legacyHasData = legacySnapshot.events.length || legacySnapshot.unavailable.length ||
      JSON.stringify(legacySnapshot.products) !== JSON.stringify(DEFAULT);
    let initial = {products,events:[],unavailable:[]};
    if (legacyHasData && confirm("Encontrei produtos, festas ou bloqueios salvos anteriormente neste navegador. Deseja migrar esses dados para o GitHub agora?")) {
      initial = legacySnapshot;
    }
    const saved = await commitGithubSnapshot(initial,"Agenda inicializada.");
    if (!saved) throw new Error("Não foi possível inicializar a agenda no GitHub.");
    products = initial.products;
    events = initial.events;
    unavailable = initial.unavailable;
    return;
  }
  const privateData = await decryptPrivateAgenda(documentData.privateAgenda);
  const normalizedEvents = normalizeEvents(privateData.events);
  const normalizedUnavailable = normalizeUnavailable(privateData.unavailable);
  if (normalizedEvents.length !== privateData.events.length ||
      normalizedUnavailable.length !== privateData.unavailable.length) {
    throw new Error("Há registros inválidos na agenda criptografada. Não carreguei os dados parcialmente.");
  }
  events = normalizedEvents;
  unavailable = normalizedUnavailable;
  githubReady = true;
}
async function connectGithub() {
  const tokenField = $("githubToken");
  const passField = $("agendaPassphrase");
  const token = tokenField.value.trim();
  const passphrase = passField.value;
  if (!token) {
    alert("Cole o token Fine-grained do GitHub.");
    tokenField.focus();
    return;
  }
  if (passphrase.length < 16) {
    alert("Use uma senha de agenda com pelo menos 16 caracteres. Guarde-a: sem ela não será possível descriptografar a agenda.");
    passField.focus();
    return;
  }
  githubToken = token;
  agendaPassphrase = passphrase;
  setGithubStatus("Conectando…","saving");
  try {
    const remote = await fetchGithubDocument();
    await loadGithubIntoPanel(remote.document,remote.sha);
    tokenField.value = "";
    passField.value = "";
    renderAll();
    setGithubStatus("Conectado ao GitHub","connected");
  } catch (error) {
    githubReady = false;
    githubToken = "";
    agendaPassphrase = "";
    setGithubStatus("Não conectado");
    alert(error.message || "Não foi possível conectar ao GitHub.");
  }
}
async function refreshGithubData() {
  if (!githubToken || !agendaPassphrase || !githubReady || githubSaveInProgress) return;
  try {
    const remote = await fetchGithubDocument();
    if (remote.sha === githubSha) {
      setGithubStatus("Agenda já está atualizada","connected");
      return;
    }
    if (!confirm("Há uma versão mais recente no GitHub. Recarregar agora? O que estiver aberto neste painel será substituído pelos dados do GitHub.")) return;
    await loadGithubIntoPanel(remote.document,remote.sha);
    renderAll();
    setGithubStatus("Agenda atualizada do GitHub","connected");
  } catch (error) {
    githubReady = false;
    setGithubStatus("Reconecte para continuar.");
    alert(error.message || "Não foi possível atualizar a agenda.");
  }
}
function disconnectGithub() {
  githubToken = "";
  agendaPassphrase = "";
  githubSha = "";
  githubReady = false;
  setGithubStatus("Desconectado");
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
  const stock = Number(product.stock ?? 1);
  if (!validId(id) || !name || !category || !description || !image || !Number.isInteger(stock) || stock < 1 || stock > 100) return null;
  return {
    id,
    name,
    category,
    tag: String(product.tag || "Consulte").trim().slice(0, 35),
    description,
    image,
    stock
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
let products = normalizeCatalog(readStorage(PRODUCT_KEY, DEFAULT)) ?? DEFAULT.slice();
function normalizeEvents(value) {
  if (!Array.isArray(value) || value.length > 3000) return [];
  const ids = new Set();
  return value.filter(event => {
    if (!event || typeof event !== "object") return false;
    const id = String(event.id || "");
    const client = String(event.client || "").trim();
    const status = ["confirmada", "orcamento", "cancelada", "concluida"].includes(event.status) ? event.status : "confirmada";
    const items = Array.isArray(event.items) ? event.items : [];
    if (!validId(id) || ids.has(id) || !client || !validDate(event.date) || items.length > 40) return false;
    const cleanItems = items.map(item => ({
      productId: String(item.productId || ""),
      quantity: Number(item.quantity)
    })).filter(item => validId(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100 && products.some(product => product.id === item.productId));
    if (cleanItems.length !== items.length) return false;
    ids.add(id);
    event._clean = {
      id,
      client: client.slice(0, 80),
      date: event.date,
      eventType: String(event.eventType || "Outro").slice(0, 50),
      neighborhood: String(event.neighborhood || "").trim().slice(0, 80),
      status,
      notes: String(event.notes || "").trim().slice(0, 400),
      items: cleanItems
    };
    return true;
  }).map(event => event._clean);
}
function normalizeUnavailable(value) {
  if (!Array.isArray(value) || value.length > 3000) return [];
  const ids = new Set();
  return value.filter(item => {
    if (!item || typeof item !== "object") return false;
    const id = String(item.id || "");
    const quantity = Number(item.quantity);
    if (!validId(id) || ids.has(id) || !products.some(product => product.id === item.productId) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 100 ||
        !validDate(item.startDate) || !validDate(item.endDate) || item.endDate < item.startDate) return false;
    ids.add(id);
    return true;
  }).map(item => ({
    id: String(item.id),
    productId: String(item.productId),
    quantity: Number(item.quantity),
    startDate: item.startDate,
    endDate: item.endDate,
    reason: String(item.reason || "Indisponível").trim().slice(0, 120)
  }));
}
let events = normalizeEvents(readStorage(EVENT_KEY, []));
let unavailable = normalizeUnavailable(readStorage(UNAVAILABLE_KEY, []));
const legacySnapshot = JSON.parse(JSON.stringify({products,events,unavailable}));
let editingProductId = null;
let editingEventId = null;
let eventItemsState = [];
let selectedDate = localDateISO();
let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function getProduct(id) {
  return products.find(product => product.id === id);
}
function eventUsesInventory(event) {
  return event.status !== "cancelada";
}
function bookedQuantity(productId, date, excludeEventId) {
  return events.reduce((total, event) => {
    if (event.id === excludeEventId || event.date !== date || !eventUsesInventory(event)) return total;
    return total + event.items.filter(item => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0);
  }, 0);
}
function blockedQuantity(productId, date, excludeBlockId) {
  return unavailable.reduce((total, item) => {
    if (item.id === excludeBlockId || item.productId !== productId || date < item.startDate || date > item.endDate) return total;
    return total + item.quantity;
  }, 0);
}
function availableQuantity(productId, date, excludeEventId) {
  const product = getProduct(productId);
  if (!product) return 0;
  return Math.max(0, product.stock - bookedQuantity(productId, date, excludeEventId) - blockedQuantity(productId, date));
}
function maximumUsedQuantity(productId) {
  const dates = new Set();
  const today = localDateISO();
  events.filter(event => event.date >= today && eventUsesInventory(event) && event.items.some(item => item.productId === productId)).forEach(event => dates.add(event.date));
  unavailable.filter(item => item.productId === productId && item.endDate >= today).forEach(item => {
    let date = item.startDate < today ? today : item.startDate;
    let count = 0;
    while (date <= item.endDate && count < 740) {
      dates.add(date);
      date = shiftDate(date, 1);
      count += 1;
    }
  });
  let maximum = 0;
  dates.forEach(date => {
    maximum = Math.max(maximum, bookedQuantity(productId, date, null) + blockedQuantity(productId, date, null));
  });
  return maximum;
}
function saveEvents() {
  return writeStorage(EVENT_KEY, events);
}
function saveUnavailable() {
  return writeStorage(UNAVAILABLE_KEY, unavailable);
}
function statusLabel(status) {
  return ({confirmada:"Confirmada",orcamento:"Em negociação",cancelada:"Cancelada",concluida:"Concluída"})[status] || "Confirmada";
}
function formatDate(value, options = {}) {
  if (!validDate(value)) return value;
  return dateFromISO(value).toLocaleDateString("pt-BR", options);
}
function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  $("calendarTitle").textContent = currentMonth.toLocaleDateString("pt-BR", {month:"long",year:"numeric"});
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - firstDay + 1;
    const date = localDateISO(new Date(year, month, dayNumber));
    const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    const count = events.filter(event => event.date === date && event.status !== "cancelada").length;
    const blockCount = unavailable.filter(item => item.startDate <= date && item.endDate >= date).length;
    const classes = ["calendar-day"];
    if (!isCurrentMonth) classes.push("outside-month");
    if (date === selectedDate) classes.push("selected");
    if (count) classes.push("has-events");
    if (blockCount) classes.push("has-blocks");
    if (date === localDateISO()) classes.push("today");
    cells.push(
      '<button type="button" class="' + classes.join(" ") + '" data-calendar-date="' + date +
      '" aria-pressed="' + String(date === selectedDate) + '" aria-label="' + formatDate(date) +
      (count ? ", " + count + (count === 1 ? " festa" : " festas") : ", sem festas") +
      (blockCount ? ", " + blockCount + (blockCount === 1 ? " bloqueio de peça" : " bloqueios de peças") : "") + '">' +
      '<span class="calendar-day-number">' + dayNumber + '</span>' +
      (count ? '<span class="calendar-day-count">' + count + '</span>' : '<span class="calendar-day-empty"></span>') +
      (blockCount ? '<span class="calendar-day-blocks">▣ ' + blockCount + '</span>' : '') +
      '</button>'
    );
  }
  $("calendarGrid").innerHTML = cells.join("");
  $("calendarGrid").querySelectorAll("[data-calendar-date]").forEach(button => {
    button.addEventListener("click", () => {
      selectedDate = button.dataset.calendarDate;
      renderCalendar();
      renderBookingsForDate();
      renderProducts();
      if (!editingEventId) $("eventForm").elements.date.value = selectedDate;
      renderEventItems();
    });
  });
  const count = events.filter(event => event.date.slice(0, 7) === localDateISO(currentMonth).slice(0, 7) && event.status !== "cancelada").length;
  $("monthEventTotal").textContent = count + (count === 1 ? " festa no mês" : " festas no mês");
}
function renderBookingsForDate() {
  $("selectedDateTitle").textContent = formatDate(selectedDate, {weekday:"long",day:"2-digit",month:"long",year:"numeric"});
  const list = events.filter(event => event.date === selectedDate).sort((a,b) => a.client.localeCompare(b.client, "pt-BR"));
  if (!list.length) {
    $("bookingsForDate").innerHTML = '<div class="empty-bookings">Nenhuma festa cadastrada para este dia. Você pode agendar mais de uma festa na mesma data.</div>';
  } else {
    $("bookingsForDate").innerHTML = list.map(event => {
      const itemText = event.items.map(item => {
        const product = getProduct(item.productId);
        return escapeHtml(product ? product.name : "Peça removida") + " × " + item.quantity;
      }).join(" · ");
      return '<article class="booking-card">' +
        '<div class="booking-card-main"><div class="booking-card-title"><strong>' + escapeHtml(event.client) +
        '</strong><span class="status-pill status-' + event.status + '">' + statusLabel(event.status) + '</span></div>' +
        '<p>' + escapeHtml(event.eventType) + (event.neighborhood ? " · " + escapeHtml(event.neighborhood) : "") + '</p>' +
        '<small>' + (itemText || "Nenhuma peça vinculada") + '</small>' +
        (event.notes ? '<small class="booking-notes">' + escapeHtml(event.notes) + '</small>' : '') +
        '</div><div class="booking-actions"><button type="button" data-edit-event="' + escapeHtml(event.id) + '">Editar</button>' +
        '<button type="button" class="danger-action" data-delete-event="' + escapeHtml(event.id) + '">Excluir</button></div></article>';
    }).join("");
    $("bookingsForDate").querySelectorAll("[data-edit-event]").forEach(button => {
      button.addEventListener("click", () => editEvent(button.dataset.editEvent));
    });
    $("bookingsForDate").querySelectorAll("[data-delete-event]").forEach(button => {
      button.addEventListener("click", () => {
        if (!confirm("Excluir esta festa da agenda?")) return;
        events = events.filter(event => event.id !== button.dataset.deleteEvent);
        if (saveEvents()) {
          if (editingEventId === button.dataset.deleteEvent) resetEventForm();
          renderAll();
        }
      });
    });
  }
  renderBlocksForDate();
}
function renderBlocksForDate() {
  const list = unavailable.filter(item => item.startDate <= selectedDate && item.endDate >= selectedDate);
  $("blockedForDate").innerHTML = list.length ? list.map(item => {
    const product = getProduct(item.productId);
    return '<article class="unavailable-card"><div><strong>' + escapeHtml(product ? product.name : "Peça removida") +
      ' · ' + item.quantity + ' un.</strong><small>' + escapeHtml(item.reason) + ' · ' +
      formatDate(item.startDate) + ' até ' + formatDate(item.endDate) + '</small></div>' +
      '<button type="button" class="danger-action" data-release-block="' + escapeHtml(item.id) + '">Liberar</button></article>';
  }).join("") : '<div class="empty-bookings">Nenhuma peça bloqueada manualmente nesta data.</div>';
  attachReleaseButtons($("blockedForDate"));
}
function attachReleaseButtons(container) {
  container.querySelectorAll("[data-release-block]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("Liberar esta peça para novos agendamentos?")) return;
      unavailable = unavailable.filter(item => item.id !== button.dataset.releaseBlock);
      if (saveUnavailable()) renderAll();
    });
  });
}
function renderEventItems() {
  const container = $("eventItems");
  if (!products.length) {
    container.innerHTML = '<p class="empty-bookings">Cadastre primeiro as peças e suas quantidades em estoque.</p>';
    return;
  }
  if (!eventItemsState.length) {
    container.innerHTML = '<p class="empty-bookings">Nenhuma peça selecionada. Clique em “Adicionar peça” para vincular objetos à festa.</p>';
    return;
  }
  container.innerHTML = eventItemsState.map((item, index) => {
    const selectedProduct = getProduct(item.productId);
    const options = products.map(product => {
      const available = availableQuantity(product.id, $("eventForm").elements.date.value || selectedDate, editingEventId);
      const isSelected = item.productId === product.id;
      const label = product.name + " — " + available + "/" + product.stock + " disponível(is)";
      return '<option value="' + escapeHtml(product.id) + '"' + (isSelected ? " selected" : "") +
        (available <= 0 && !isSelected ? " disabled" : "") + '>' + escapeHtml(label) + '</option>';
    }).join("");
    const max = selectedProduct ? Math.max(1, availableQuantity(selectedProduct.id, $("eventForm").elements.date.value || selectedDate, editingEventId)) : 100;
    return '<div class="event-item-row" data-item-row="' + index + '">' +
      '<label>Peça<select data-item-product="' + index + '"><option value="">Selecione uma peça</option>' + options + '</select></label>' +
      '<label>Qtd.<input data-item-quantity="' + index + '" type="number" min="1" max="' + max + '" value="' + item.quantity + '"></label>' +
      '<button type="button" class="remove-item-button" data-remove-event-item="' + index + '" aria-label="Remover peça">×</button>' +
      '</div>';
  }).join("");
  container.querySelectorAll("[data-item-product]").forEach(select => {
    select.addEventListener("change", () => {
      const index = Number(select.dataset.itemProduct);
      eventItemsState[index].productId = select.value;
      renderEventItems();
    });
  });
  container.querySelectorAll("[data-item-quantity]").forEach(input => {
    input.addEventListener("change", () => {
      const index = Number(input.dataset.itemQuantity);
      eventItemsState[index].quantity = Number(input.value);
    });
  });
  container.querySelectorAll("[data-remove-event-item]").forEach(button => {
    button.addEventListener("click", () => {
      eventItemsState.splice(Number(button.dataset.removeEventItem), 1);
      renderEventItems();
    });
  });
}
function renderProducts() {
  $("productTotal").textContent = products.length + (products.length === 1 ? " item" : " itens");
  $("productRows").innerHTML = products.map(product => {
    const reserved = bookedQuantity(product.id,selectedDate,null);
    const blocked = blockedQuantity(product.id,selectedDate,null);
    const free = availableQuantity(product.id,selectedDate,null);
    return '<tr><td>' + escapeHtml(product.name) + '</td><td>' + escapeHtml(product.category) +
      '</td><td>' + product.stock + '</td><td>' + reserved + '</td><td>' + blocked + '</td><td><strong>' + free +
      '</strong> livre(s) em ' + formatDate(selectedDate) + '</td><td class="row-actions"><button type="button" data-edit-product="' + escapeHtml(product.id) +
      '">Editar</button> <button type="button" data-delete-product="' + escapeHtml(product.id) +
      '">Excluir</button></td></tr>';
  }).join("") || '<tr><td colspan="7">Nenhum produto cadastrado.</td></tr>';
  $("productRows").querySelectorAll("[data-edit-product]").forEach(button => {
    button.addEventListener("click", () => editProduct(button.dataset.editProduct));
  });
  $("productRows").querySelectorAll("[data-delete-product]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteProduct;
      if (events.some(event => event.items.some(item => item.productId === id)) ||
          unavailable.some(item => item.productId === id)) {
        alert("Esta peça está vinculada a uma festa ou bloqueio. Remova esses vínculos antes de excluir o cadastro.");
        return;
      }
      if (!confirm("Excluir esta peça do catálogo?")) return;
      products = products.filter(product => product.id !== id);
      if (writeStorage(PRODUCT_KEY, products)) renderAll();
    });
  });
}
function renderUnavailableProductOptions() {
  const select = $("unavailableProduct");
  const current = select.value;
  select.innerHTML = products.map(product =>
    '<option value="' + escapeHtml(product.id) + '">' + escapeHtml(product.name) + " — estoque: " + product.stock + '</option>'
  ).join("");
  if (products.some(product => product.id === current)) select.value = current;
}
function renderUnavailable() {
  const list = unavailable.slice().sort((a,b) => a.startDate.localeCompare(b.startDate));
  $("unavailableTotal").textContent = list.length + (list.length === 1 ? " bloqueio" : " bloqueios");
  $("unavailableList").innerHTML = list.map(item => {
    const product = getProduct(item.productId);
    return '<article class="unavailable-card"><div><strong>' + escapeHtml(product ? product.name : "Peça removida") +
      ' · ' + item.quantity + ' un.</strong><small>' + formatDate(item.startDate) + ' até ' + formatDate(item.endDate) +
      ' · ' + escapeHtml(item.reason) + '</small></div><button type="button" class="danger-action" data-release-block="' + escapeHtml(item.id) + '">Liberar</button></article>';
  }).join("") || '<div class="empty-bookings">Nenhuma peça marcada como indisponível.</div>';
  attachReleaseButtons($("unavailableList"));
}
function editProduct(id) {
  const product = getProduct(id);
  if (!product) return;
  editingProductId = id;
  const form = $("productForm");
  form.elements.name.value = product.name;
  form.elements.category.value = product.category;
  form.elements.stock.value = product.stock;
  form.elements.tag.value = product.tag;
  form.elements.image.value = product.image;
  form.elements.description.value = product.description;
  $("saveProduct").textContent = "Salvar alterações";
  $("cancelEdit").hidden = false;
  form.scrollIntoView({behavior:"smooth", block:"center"});
  form.elements.name.focus();
}
function resetProductForm() {
  editingProductId = null;
  $("productForm").reset();
  $("productForm").elements.stock.value = "1";
  $("saveProduct").textContent = "Salvar produto +";
  $("cancelEdit").hidden = true;
}
function resetEventForm() {
  editingEventId = null;
  $("eventForm").reset();
  $("eventForm").elements.date.min = localDateISO();
  $("eventForm").elements.date.value = selectedDate;
  $("eventFormTitle").textContent = "Cadastrar festa de cliente";
  $("saveEvent").textContent = "Salvar festa na agenda";
  $("cancelEventEdit").hidden = true;
  eventItemsState = [];
  renderEventItems();
}
function editEvent(id) {
  const event = events.find(item => item.id === id);
  if (!event) return;
  editingEventId = id;
  selectedDate = event.date;
  currentMonth = new Date(dateFromISO(event.date).getFullYear(), dateFromISO(event.date).getMonth(), 1);
  const form = $("eventForm");
  form.elements.client.value = event.client;
  form.elements.date.value = event.date;
  form.elements.date.min = event.date < localDateISO() ? event.date : localDateISO();
  form.elements.eventType.value = event.eventType;
  form.elements.neighborhood.value = event.neighborhood;
  form.elements.status.value = event.status;
  form.elements.notes.value = event.notes;
  eventItemsState = event.items.map(item => ({productId:item.productId,quantity:item.quantity}));
  $("eventFormTitle").textContent = "Editar festa agendada";
  $("saveEvent").textContent = "Salvar alterações da festa";
  $("cancelEventEdit").hidden = false;
  renderCalendar();
  renderBookingsForDate();
  renderProducts();
  renderEventItems();
  $("eventEditorCard").scrollIntoView({behavior:"smooth", block:"start"});
}
function openNewEvent() {
  resetEventForm();
  if (products.length) {
    const firstAvailable = products.find(product => availableQuantity(product.id, selectedDate, null) > 0);
    if (firstAvailable) eventItemsState = [{productId:firstAvailable.id,quantity:1}];
  }
  renderEventItems();
  $("eventEditorCard").scrollIntoView({behavior:"smooth", block:"start"});
  $("eventForm").elements.client.focus();
}
function consolidateItems(items) {
  const map = new Map();
  items.forEach(item => {
    map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
  });
  return Array.from(map, entry => ({productId:entry[0],quantity:entry[1]}));
}
function renderAll() {
  renderCalendar();
  renderBookingsForDate();
  renderProducts();
  renderUnavailableProductOptions();
  renderUnavailable();
  renderEventItems();
}
$("connectGithub").addEventListener("click", connectGithub);
$("refreshGithub").addEventListener("click", refreshGithubData);
$("disconnectGithub").addEventListener("click", disconnectGithub);
$("publishAvailability").addEventListener("change", async event => {
  if (!githubReady || githubSaveInProgress) {
    event.target.checked = publishAvailability;
    alert("Conecte ao GitHub e aguarde qualquer gravação em andamento para alterar esta opção.");
    return;
  }
  const previous = publishAvailability;
  if (event.target.checked && !confirm("Publicar agora os totais de unidades livres por produto e data para todos os visitantes da loja? Não serão exibidos os dados das festas.")) {
    event.target.checked = previous;
    return;
  }
  publishAvailability = event.target.checked;
  const saved = await commitGithubSnapshot({products,events,unavailable},
    publishAvailability ? "Disponibilidade publicada na loja." : "Disponibilidade ocultada da loja.");
  if (!saved) {
    publishAvailability = previous;
    event.target.checked = previous;
  }
});
$("productForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const stock = Number(data.get("stock"));
  const rawImage = String(data.get("image") || "").trim();
  const image = rawImage ? safeImage(rawImage) : FALLBACK_IMAGE;
  if (!Number.isInteger(stock) || stock < 1 || stock > 100) {
    alert("Informe uma quantidade física entre 1 e 100.");
    return;
  }
  if (!image) {
    alert("Informe uma URL de imagem HTTPS válida.");
    return;
  }
  const id = editingProductId || randomId("produto");
  const product = normalizeProduct({
    id,
    name: data.get("name"),
    category: data.get("category"),
    stock,
    tag: data.get("tag"),
    description: data.get("description"),
    image
  });
  if (!product) {
    alert("Confira os campos do produto. Nome, categoria, descrição e estoque são obrigatórios.");
    return;
  }
  if (editingProductId && stock < maximumUsedQuantity(id)) {
    alert("Não é possível reduzir o estoque para " + stock + ". Existem até " + maximumUsedQuantity(id) + " unidade(s) reservada(s) ou bloqueada(s) simultaneamente.");
    return;
  }
  const wasEditing = Boolean(editingProductId);
  const nextProducts = wasEditing
    ? products.map(item => item.id === editingProductId ? product : item)
    : [...products, product];
  if (!writeStorage(PRODUCT_KEY, nextProducts, wasEditing ? "Produto atualizado." : "Produto cadastrado.")) return;
  products = nextProducts;
  resetProductForm();
  renderAll();
  
});
$("cancelEdit").addEventListener("click", resetProductForm);
$("restoreProducts").addEventListener("click", () => {
  if (events.length || unavailable.length) {
    alert("Antes de restaurar o catálogo, remova os agendamentos e bloqueios que usam as peças cadastradas.");
    return;
  }
  if (!confirm("Restaurar os produtos de exemplo? Isso substituirá o catálogo salvo neste navegador.")) return;
  if (!writeStorage(PRODUCT_KEY, DEFAULT, "Catálogo de exemplo restaurado.")) return;
  products = DEFAULT.slice();
  resetProductForm();
  renderAll();
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
    const newIds = new Set(validated.map(product => product.id));
    const referencedIds = new Set(events.flatMap(event => event.items.map(item => item.productId)).concat(unavailable.map(item => item.productId)));
    if (Array.from(referencedIds).some(id => !newIds.has(id))) throw new Error("A importação removeria peças usadas na agenda.");
    if (!writeStorage(PRODUCT_KEY, validated, "Catálogo importado.")) return;
    products = validated;
    resetProductForm();
    renderAll();
    
  } catch (error) {
    alert(error.message === "A importação removeria peças usadas na agenda."
      ? error.message
      : "Não foi possível importar. Use um JSON válido, com até 300 itens e imagens HTTPS.");
  } finally {
    event.target.value = "";
  }
});
$("eventForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const date = String(data.get("date") || "");
  const editedRecord = editingEventId ? events.find(item => item.id === editingEventId) : null;
  if (!validDate(date) || (date < localDateISO() && (!editedRecord || editedRecord.date !== date))) {
    alert("Para novos agendamentos, escolha uma data de hoje em diante. Uma festa antiga só pode ser editada mantendo a mesma data.");
    return;
  }
  const rawItems = eventItemsState.map(item => ({
    productId:String(item.productId || ""),
    quantity:Number(item.quantity)
  })).filter(item => item.productId);
  const items = consolidateItems(rawItems);
  if (!items.length) {
    alert("Adicione pelo menos uma peça à festa.");
    return;
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      alert("Confira as quantidades das peças.");
      return;
    }
    const product = getProduct(item.productId);
    if (!product) {
      alert("Uma das peças não existe mais no catálogo. Atualize a seleção.");
      return;
    }
    const status = String(data.get("status"));
    if (status !== "cancelada") {
      const available = availableQuantity(item.productId, date, editingEventId);
      if (item.quantity > available) {
        alert("Não há unidades suficientes de " + product.name + " para " + formatDate(date) + ". Disponíveis: " + available + ". Reduza a quantidade, escolha outra data ou ajuste o estoque/bloqueio.");
        return;
      }
    }
  }
  const wasEditing = Boolean(editingEventId);
  const record = {
    id: editingEventId || randomId("festa"),
    client: String(data.get("client")).trim().slice(0,80),
    date,
    eventType: String(data.get("eventType") || "Outro"),
    neighborhood: String(data.get("neighborhood") || "").trim().slice(0,80),
    status: String(data.get("status") || "confirmada"),
    notes: String(data.get("notes") || "").trim().slice(0,400),
    items
  };
  const nextEvents = wasEditing
    ? events.map(item => item.id === editingEventId ? record : item)
    : [...events, record];
  if (!writeStorage(EVENT_KEY, nextEvents, wasEditing ? "Festa atualizada." : "Festa adicionada à agenda.")) return;
  events = nextEvents;
  selectedDate = date;
  const selected = dateFromISO(date);
  currentMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  resetEventForm();
  renderAll();
  
});
$("cancelEventEdit").addEventListener("click", resetEventForm);
$("addEventItem").addEventListener("click", () => {
  const date = $("eventForm").elements.date.value || selectedDate;
  const next = products.find(product => availableQuantity(product.id, date, editingEventId) > 0);
  eventItemsState.push({productId:next ? next.id : "",quantity:1});
  renderEventItems();
});
$("eventForm").elements.date.addEventListener("change", event => {
  if (!validDate(event.target.value)) return;
  selectedDate = event.target.value;
  const date = dateFromISO(selectedDate);
  currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  renderCalendar();
  renderBookingsForDate();
  renderProducts();
  renderEventItems();
});
$("newEventForDate").addEventListener("click", openNewEvent);
$("previousMonth").addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  selectedDate = localDateISO(currentMonth);
  renderCalendar();
  renderBookingsForDate();
  renderProducts();
  if (!editingEventId) $("eventForm").elements.date.value = selectedDate;
  renderEventItems();
});
$("nextMonth").addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  selectedDate = localDateISO(currentMonth);
  renderCalendar();
  renderBookingsForDate();
  renderProducts();
  if (!editingEventId) $("eventForm").elements.date.value = selectedDate;
  renderEventItems();
});
$("unavailableForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!products.length) {
    alert("Cadastre primeiro as peças e suas quantidades.");
    return;
  }
  const data = new FormData(event.currentTarget);
  const productId = String(data.get("productId") || "");
  const quantity = Number(data.get("quantity"));
  const startDate = String(data.get("startDate") || "");
  const endDate = String(data.get("endDate") || "");
  const reason = String(data.get("reason") || "").trim();
  if (!validDate(startDate) || !validDate(endDate) || startDate < localDateISO() || endDate < startDate) {
    alert("Informe um período válido, de hoje em diante.");
    return;
  }
  const span = Math.round((dateFromISO(endDate) - dateFromISO(startDate)) / 86400000);
  if (span > 365) {
    alert("O período de bloqueio pode ter no máximo 366 dias.");
    return;
  }
  const product = getProduct(productId);
  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > product.stock || !reason) {
    alert("Confira a peça, a quantidade e o motivo do bloqueio.");
    return;
  }
  for (let offset = 0; offset <= span; offset += 1) {
    const date = shiftDate(startDate, offset);
    const available = availableQuantity(productId, date, null);
    if (quantity > available) {
      alert("Não é possível bloquear " + quantity + " unidade(s) de " + product.name + " em " + formatDate(date) + ". Há apenas " + available + " livre(s), considerando festas e outros bloqueios.");
      return;
    }
  }
  unavailable.push({
    id:randomId("bloqueio"),
    productId,
    quantity,
    startDate,
    endDate,
    reason:reason.slice(0,120)
  });
  if (saveUnavailable()) {
    event.currentTarget.reset();
    $("unavailableForm").elements.quantity.value = "1";
    $("unavailableForm").elements.startDate.value = localDateISO();
    $("unavailableForm").elements.endDate.value = localDateISO();
    renderAll();
  }
});
$("unavailableForm").elements.startDate.min = localDateISO();
$("unavailableForm").elements.endDate.min = localDateISO();
$("unavailableForm").elements.startDate.value = localDateISO();
$("unavailableForm").elements.endDate.value = localDateISO();
$("unavailableForm").elements.startDate.addEventListener("change", event => {
  $("unavailableForm").elements.endDate.min = event.target.value || localDateISO();
  if ($("unavailableForm").elements.endDate.value < event.target.value) {
    $("unavailableForm").elements.endDate.value = event.target.value;
  }
});
$("exportCatalog").setAttribute("aria-label", "Baixar cópia do catálogo em JSON");
$("exportAgenda").addEventListener("click", () => {
  const backup = {version:1,exportedAt:new Date().toISOString(),events,unavailable,products};
  const blob = new Blob([JSON.stringify(backup,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "familia-decora-agenda-backup.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("importBackup").addEventListener("change", async event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 8_000_000) throw new Error("A cópia é grande demais para importar.");
    const parsed = JSON.parse(await file.text());
    if (parsed.version !== 1 || !Array.isArray(parsed.products) ||
        !Array.isArray(parsed.events) || !Array.isArray(parsed.unavailable)) {
      throw new Error("O arquivo não é uma cópia completa válida da agenda.");
    }
    const nextProducts = normalizeCatalog(parsed.products);
    if (!nextProducts || nextProducts.length !== parsed.products.length) {
      throw new Error("O catálogo da cópia contém produtos inválidos.");
    }
    const previous = {products,events,unavailable};
    products = nextProducts;
    const nextEvents = normalizeEvents(parsed.events);
    const nextUnavailable = normalizeUnavailable(parsed.unavailable);
    products = previous.products;
    if (nextEvents.length !== parsed.events.length || nextUnavailable.length !== parsed.unavailable.length) {
      throw new Error("A cópia contém festas/bloqueios inválidos ou referências a produtos inexistentes.");
    }
    products = nextProducts;
    events = nextEvents;
    unavailable = nextUnavailable;
    const conflict = products.find(product => maximumUsedQuantity(product.id) > product.stock);
    products = previous.products;
    events = previous.events;
    unavailable = previous.unavailable;
    if (conflict) throw new Error("A cópia excede o estoque de " + conflict.name + ". Ajuste as quantidades antes de restaurar.");
    if (!githubReady) throw new Error("Conecte ao GitHub antes de restaurar a cópia.");
    if (!confirm("Restaurar esta cópia completa? Ela substituirá o catálogo, a agenda e os bloqueios atuais no GitHub.")) return;
    const saved = await commitGithubSnapshot({products:nextProducts,events:nextEvents,unavailable:nextUnavailable},"Cópia completa restaurada.");
    if (saved) {
      products = nextProducts;
      events = nextEvents;
      unavailable = nextUnavailable;
      resetProductForm();
      resetEventForm();
      renderAll();
    }
  } catch (error) {
    alert(error.message || "Não foi possível restaurar a cópia.");
  } finally {
    event.target.value = "";
  }
});
$("eventForm").elements.date.min = localDateISO();
$("cancelEdit").hidden = true;
$("cancelEventEdit").hidden = true;
resetProductForm();
resetEventForm();
renderAll();
