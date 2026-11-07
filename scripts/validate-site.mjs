import { readFileSync, existsSync } from "node:fs";

const required = [
  "index.html",
  "style.css",
  "app.js",
  "gestao.html",
  "gestao.css",
  "gestao.js",
  "data/agenda.json",
  "assets/logo-familia-decora.webp"
];

for (const file of required) {
  if (!existsSync(file)) throw new Error("Arquivo obrigatório ausente: " + file);
}

function inspectPage(htmlPath, cssPath, jsPath) {
  const html = readFileSync(htmlPath, "utf8");
  const css = readFileSync(cssPath, "utf8");
  const js = readFileSync(jsPath, "utf8");

  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    throw new Error(htmlPath + " contém IDs duplicados: " + [...new Set(duplicateIds)].join(", "));
  }

  const idSet = new Set(ids);
  const referencedIds = [...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]);
  const missingIds = [...new Set(referencedIds)].filter(id => !idSet.has(id));
  if (missingIds.length) {
    throw new Error(jsPath + " usa IDs inexistentes em " + htmlPath + ": " + missingIds.join(", "));
  }

  const cssRef = cssPath.split("/").pop();
  const jsRef = jsPath.split("/").pop();
  if (!html.includes(cssRef) || !html.includes(jsRef)) {
    throw new Error(htmlPath + " não referencia corretamente seus arquivos CSS/JS.");
  }

  const localRefs = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter(ref => ref && !/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(ref))
    .map(ref => ref.split(/[?#]/)[0]);
  for (const ref of localRefs) {
    if (ref && !existsSync(ref)) {
      throw new Error(htmlPath + " aponta para arquivo local inexistente: " + ref);
    }
  }

  const openBraces = (css.match(/{/g) || []).length;
  const closeBraces = (css.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    throw new Error(cssPath + " contém chaves CSS desbalanceadas.");
  }

  if (!/@media\s*\(max-width:\s*(?:650|680)px\)/.test(css)) {
    throw new Error(cssPath + " não contém a regra de adaptação para celular.");
  }

  console.log("OK: " + htmlPath + " — IDs, arquivos locais, CSS e JavaScript conferidos.");
  return html;
}

const storeHtml = inspectPage("index.html", "style.css", "app.js");
inspectPage("gestao.html", "gestao.css", "gestao.js");

const structuredData = [...storeHtml.matchAll(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
for (const match of structuredData) {
  JSON.parse(match[1]);
}
if (!structuredData.length) throw new Error("index.html está sem dados estruturados para mecanismos de busca.");

if (!storeHtml.includes('id="duvidas"') || !storeHtml.includes('name="privacyConsent" required')) {
  throw new Error("A loja precisa manter a seção de dúvidas e o consentimento do orçamento.");
}

const app = readFileSync("app.js", "utf8");
if (!app.includes("copyMessage(message)") || !app.includes("CONFIG.instagram")) {
  throw new Error("O fluxo de contato alternativo precisa estar configurado quando o WhatsApp não estiver confirmado.");
}

const management = readFileSync("gestao.html", "utf8");
if (!/name=["']robots["'] content=["']noindex,nofollow["']/.test(management)) {
  throw new Error("A página de demonstração da equipe deve manter a instrução noindex,nofollow.");
}

const adminRequiredIds = [
  "calendarGrid",
  "calendarTitle",
  "bookingsForDate",
  "blockedForDate",
  "eventForm",
  "eventItems",
  "unavailableForm",
  "unavailableList",
  "exportCatalog",
  "githubToken",
  "agendaPassphrase",
  "publishAvailability",
  "connectGithub",
  "refreshGithub",
  "disconnectGithub",
  "exportAgenda",
  "importBackup"
];
const adminIds = new Set([...management.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
const missingAdminIds = adminRequiredIds.filter(id => !adminIds.has(id));
if (missingAdminIds.length) {
  throw new Error("Painel de gestão sem elementos da agenda/estoque: " + missingAdminIds.join(", "));
}

const managementScript = readFileSync("gestao.js", "utf8");
for (const requiredFeature of [
  "EVENT_KEY",
  "UNAVAILABLE_KEY",
  "availableQuantity",
  "bookedQuantity",
  "blockedQuantity",
  "renderBlocksForDate",
  "calendar-day-count",
  "GITHUB_API_URL",
  "commitGithubSnapshot",
  "buildPublicAvailability",
  "AES-GCM",
  "PBKDF2-SHA-256",
  "CRYPTO_ITERATIONS",
  "publishAvailability"
]) {
  if (!managementScript.includes(requiredFeature)) {
    throw new Error("Funcionalidade da agenda/estoque/GitHub ausente: " + requiredFeature);
  }
}

const publicApp = readFileSync("app.js", "utf8");
for (const requiredFeature of ["PUBLIC_DATA_URL", "loadPublicData", "availabilityFor"]) {
  if (!publicApp.includes(requiredFeature)) {
    throw new Error("Integração da vitrine com a disponibilidade ausente: " + requiredFeature);
  }
}

const dataFile = JSON.parse(readFileSync("data/agenda.json", "utf8"));
if (dataFile.schemaVersion !== 1 || !Array.isArray(dataFile.products) ||
    !dataFile.availability || typeof dataFile.availability.enabled !== "boolean" || typeof dataFile.availability.days !== "object" ||
    !Object.prototype.hasOwnProperty.call(dataFile, "privateAgenda")) {
  throw new Error("data/agenda.json não possui a estrutura pública/privada esperada.");
}
if (Object.prototype.hasOwnProperty.call(dataFile, "events") ||
    Object.prototype.hasOwnProperty.call(dataFile, "unavailable")) {
  throw new Error("Dados de festas ou bloqueios não podem aparecer em texto aberto no arquivo público.");
}
if (dataFile.privateAgenda && (!dataFile.privateAgenda.ciphertext ||
    dataFile.privateAgenda.algorithm !== "AES-256-GCM")) {
  throw new Error("O conteúdo privado da agenda não está criptografado no formato esperado.");
}

const productById = new Map();
for (const product of dataFile.products) {
  if (!product || typeof product !== "object" ||
      !/^[a-zA-Z0-9_-]{1,120}$/.test(String(product.id || "")) ||
      productById.has(product.id) ||
      !String(product.name || "").trim() ||
      !String(product.category || "").trim() ||
      !String(product.description || "").trim() ||
      !Number.isInteger(product.stock) || product.stock < 1 || product.stock > 100 ||
      !/^https:\/\//i.test(String(product.image || ""))) {
    throw new Error("O catálogo público contém produto inválido, ID duplicado ou estoque/imagem fora do padrão.");
  }
  productById.set(product.id, product);
}

for (const [date, quantities] of Object.entries(dataFile.availability.days)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !quantities || typeof quantities !== "object" || Array.isArray(quantities)) {
    throw new Error("A disponibilidade pública contém uma data ou estrutura inválida.");
  }
  for (const [productId, freeQuantity] of Object.entries(quantities)) {
    const product = productById.get(productId);
    if (!product || !Number.isInteger(freeQuantity) || freeQuantity < 0 || freeQuantity > product.stock) {
      throw new Error("A disponibilidade pública contém quantidade inválida ou referência a produto inexistente.");
    }
  }
}
if (dataFile.initialized === false && dataFile.availability.enabled === true) {
  throw new Error("A disponibilidade pública não pode ser ativada antes da inicialização da agenda.");
}

console.log("Validação final concluída: loja, privacidade, criptografia, GitHub, catálogo e disponibilidade pública.");
