/* Família Decora — loja demonstrativa.
   Não salva dados pessoais dos clientes no navegador.
   Catálogo pode ser alterado localmente pelo painel da equipe; para sincronizar vários aparelhos, conecte um backend.
*/
const CONFIG = {
  whatsapp: "5538991234590", // número divulgado em diretório público antigo; confirmar com a loja antes de divulgar
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
const PRODUCTS_KEY="familia-decora-products-v2";
const $=id=>document.getElementById(id);
const safeRead=(key,fallback)=>{try{const parsed=JSON.parse(localStorage.getItem(key));return parsed??fallback}catch{return fallback}};
const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products=safeRead(PRODUCTS_KEY,DEFAULT_PRODUCTS);
if(!Array.isArray(products)||!products.length)products=DEFAULT_PRODUCTS;
let selected={};
let category="Todos";
let query="";
function localToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function notify(message){const toast=$("toast");toast.textContent=message;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),2600)}
function persistProducts(){if(!safeWrite(PRODUCTS_KEY,products))notify("Não foi possível salvar: armazenamento indisponível neste navegador.");}
function categories(){return ["Todos",...new Set(products.map(p=>p.category).filter(Boolean))]}
function renderFilters(){
  $("filters").innerHTML=categories().map(c=>`<button type="button" class="filter-chip ${category===c?"active":""}" data-filter="${escapeHtml(c)}" aria-pressed="${category===c}">${escapeHtml(c)}</button>`).join("");
  $("filters").querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{category=b.dataset.filter;renderFilters();renderProducts()}));
}
function renderProducts(){
  const filtered=products.filter(p=>(category==="Todos"||p.category===category)&&[p.name,p.category,p.description,p.tag].join(" ").toLocaleLowerCase("pt-BR").includes(query));
  $("productGrid").innerHTML=filtered.length?filtered.map(p=>`
    <article class="product-card">
      <div class="product-photo"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1519225421980-888cb4c1e12c?auto=format&fit=crop&w=900&q=80'"><span class="photo-label">${escapeHtml(p.tag||p.category)}</span></div>
      <div class="product-info"><div class="product-category">${escapeHtml(p.category)}</div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p>
        <div class="product-bottom"><span class="price-hint">Consulte disponibilidade</span><button type="button" class="add-button" data-add="${escapeHtml(p.id)}">Adicionar ao orçamento +</button></div>
      </div>
    </article>`).join(""):`<div class="no-results">Não encontramos itens com essa busca. Tente outro termo ou categoria.</div>`;
  $("productGrid").querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>addItem(b.dataset.add)));
}
function addItem(id){if(!products.some(p=>p.id===id))return;selected[id]=(selected[id]||0)+1;renderQuote();openQuote();notify("Item adicionado ao seu orçamento.");}
function quoteEntries(){return Object.entries(selected).map(([id,qty])=>({product:products.find(p=>p.id===id),qty})).filter(x=>x.product&&x.qty>0)}
function renderQuote(){
  const entries=quoteEntries();const total=entries.reduce((n,x)=>n+x.qty,0);
  $("quoteCount").textContent=total;
  $("quoteItems").innerHTML=entries.length?`<div class="quote-lines">${entries.map(({product:p,qty})=>`
    <div class="quote-line"><img src="${escapeHtml(p.image)}" alt=""><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)}</small><div class="quantity"><button type="button" data-qty="${escapeHtml(p.id)}" data-step="-1" aria-label="Diminuir quantidade">−</button><span>${qty}</span><button type="button" data-qty="${escapeHtml(p.id)}" data-step="1" aria-label="Aumentar quantidade">+</button></div></div><button type="button" class="remove-button" data-remove="${escapeHtml(p.id)}" aria-label="Remover item">×</button></div>`).join("")}</div>`:`<div class="empty-quote">Seu orçamento ainda está vazio.<br>Escolha as peças que deseja consultar no catálogo. ♡</div>`;
  $("quoteItems").querySelectorAll("[data-qty]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.qty;selected[id]=Math.max(0,(selected[id]||0)+Number(b.dataset.step));if(!selected[id])delete selected[id];renderQuote()}));
  $("quoteItems").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{delete selected[b.dataset.remove];renderQuote()}));
  $("sendQuote").disabled=!entries.length;$("sendQuote").style.opacity=entries.length?"1":".5";
}
function openQuote(){ $("overlay").classList.add("open");$("quoteDrawer").classList.add("open");$("quoteDrawer").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";$("closeQuote").focus()}
function closeQuote(){ $("overlay").classList.remove("open");$("quoteDrawer").classList.remove("open");$("quoteDrawer").setAttribute("aria-hidden","true");document.body.style.overflow=""}
function sendQuote(){
  const form=$("quoteForm");if(!quoteEntries().length){notify("Adicione ao menos um item ao orçamento.");return}
  if(!form.reportValidity())return;
  const data=new FormData(form);const date=data.get("date");
  if(date<localToday()){notify("Escolha uma data futura para o evento.");return}
  const items=quoteEntries().map(x=>`• ${x.qty}x ${x.product.name}`);
  const msg=[
    "Olá, Família Decora! Gostaria de solicitar um orçamento.",
    "",
    `Nome: ${data.get("name")}`,
    `WhatsApp para retorno: ${data.get("phone")}`,
    `Data do evento: ${new Date(date+"T12:00:00").toLocaleDateString("pt-BR")}`,
    `Tipo de evento: ${data.get("event")}`,
    `Preferência: ${data.get("delivery")}`,
    data.get("neighborhood")?`Bairro/região: ${data.get("neighborhood")}`:null,
    "",
    "Itens selecionados:",
    ...items,
    data.get("notes")?`Detalhes: ${data.get("notes")}`:null,
    "",
    "Podem confirmar disponibilidade, valores e condições?"
  ].filter(Boolean).join("\n");
  // Não persiste nome, telefone ou informações do evento no navegador. O cliente envia diretamente à loja.
  const url="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent(msg);
  window.open(url,"_blank","noopener,noreferrer");
  notify("Mensagem preparada. Conclua o envio na conversa do WhatsApp.");
}
function init(){
  $("year").textContent=new Date().getFullYear();
  $("eventDate")?.setAttribute("min",localToday());
  $("quoteForm").elements.date.min=localToday();
  $("openQuote").addEventListener("click",openQuote);
  $("closeQuote").addEventListener("click",closeQuote);
  $("overlay").addEventListener("click",closeQuote);
  $("sendQuote").addEventListener("click",sendQuote);
  $("productSearch").addEventListener("input",e=>{query=e.target.value.toLocaleLowerCase("pt-BR").trim();renderProducts()});
  $("menuToggle").addEventListener("click",()=>{const open=$("mainNav").classList.toggle("open");$("menuToggle").setAttribute("aria-expanded",String(open));$("menuToggle").textContent=open?"×":"☰"});
  $("mainNav").querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{$("mainNav").classList.remove("open");$("menuToggle").setAttribute("aria-expanded","false");$("menuToggle").textContent="☰"}));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeQuote()});
  renderFilters();renderProducts();renderQuote();
}
init();
