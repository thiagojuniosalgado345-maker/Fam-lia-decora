import { readFileSync, existsSync } from "node:fs";

const required = [
  "index.html",
  "style.css",
  "app.js",
  "gestao.html",
  "gestao.css",
  "gestao.js"
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

  const openBraces = (css.match(/{/g) || []).length;
  const closeBraces = (css.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    throw new Error(cssPath + " contém chaves CSS desbalanceadas.");
  }

  console.log("OK: " + htmlPath + " — IDs, CSS e JavaScript conferidos.");
}

inspectPage("index.html", "style.css", "app.js");
inspectPage("gestao.html", "gestao.css", "gestao.js");
console.log("Validação estrutural concluída.");
