const API_VERSION = "2022-11-28";
const DATA_PATH = "data/agenda.json";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
let cachedInstallationToken = null;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}
  });
}
function toBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
function fromBase64(value) {
  const binary = atob(String(value || "").replace(/\s/g,""));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function base64url(value) {
  return toBase64(value instanceof Uint8Array ? value : new TextEncoder().encode(value))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function fromBase64url(value) {
  const normalized = String(value).replace(/-/g,"+").replace(/_/g,"/");
  return fromBase64(normalized + "=".repeat((4-normalized.length%4)%4));
}
function concatBytes(...parts) {
  const output = new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.length;}
  return output;
}
function derLength(length) {
  if(length<128)return Uint8Array.of(length);
  const bytes=[];let n=length;
  while(n>0){bytes.unshift(n&255);n>>>=8;}
  return Uint8Array.of(0x80|bytes.length,...bytes);
}
function der(tag,content){return concatBytes(Uint8Array.of(tag),derLength(content.length),content);}
function parsePrivateKey(pem) {
  const match=String(pem||"").match(/-----BEGIN ([A-Z ]+)-----([\s\S]+?)-----END \1-----/);
  if(!match)throw new Error("A chave privada do GitHub App não está em formato PEM.");
  const raw=fromBase64(match[2]);
  if(match[1]==="PRIVATE KEY")return raw;
  if(match[1]!=="RSA PRIVATE KEY")throw new Error("Formato de chave não suportado. Gere uma chave RSA no GitHub App.");
  const version=Uint8Array.of(0x02,0x01,0x00);
  const algorithm=Uint8Array.from([0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00]);
  return der(0x30,concatBytes(version,algorithm,der(0x04,raw)));
}
function jwtPart(value){return base64url(JSON.stringify(value));}
async function createAppJwt(env) {
  if(!env.GITHUB_APP_ID||!env.GITHUB_APP_PRIVATE_KEY)throw new Error("Configure GITHUB_APP_ID e GITHUB_APP_PRIVATE_KEY no Worker.");
  const key=await crypto.subtle.importKey("pkcs8",parsePrivateKey(env.GITHUB_APP_PRIVATE_KEY),
    {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const now=Math.floor(Date.now()/1000);
  const unsigned=jwtPart({alg:"RS256",typ:"JWT"})+"."+jwtPart({iat:now-60,exp:now+8*60,iss:String(env.GITHUB_APP_ID)});
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  return unsigned+"."+base64url(new Uint8Array(signature));
}
async function githubRequest(path,token,options={}) {
  const response=await fetch("https://api.github.com"+path,{
    ...options,
    headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,
      "X-GitHub-Api-Version":API_VERSION,...(options.headers||{})}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error("GitHub recusou a operação (HTTP "+response.status+"): "+String(data.message||"erro"));error.status=response.status;throw error;}
  return data;
}
async function createInstallationToken(env) {
  if(cachedInstallationToken&&cachedInstallationToken.expiresAt>Date.now()+60_000)return cachedInstallationToken.token;
  const repo=String(env.GITHUB_REPOSITORY||"");
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error("GITHUB_REPOSITORY inválido.");
  const jwt=await createAppJwt(env);
  const installation=await githubRequest("/repos/"+repo+"/installation",jwt);
  if(!installation.id)throw new Error("O GitHub App ainda não está instalado neste repositório.");
  const data=await githubRequest("/app/installations/"+installation.id+"/access_tokens",jwt,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({repositories:[repo.split("/")[1]],permissions:{contents:"write"}})
  });
  if(!data.token)throw new Error("O GitHub não retornou um token temporário.");
  cachedInstallationToken={token:data.token,expiresAt:data.expires_at?Date.parse(data.expires_at):Date.now()+50*60_000};
  return data.token;
}
function contentsPath(env,path=DATA_PATH){
  return "/repos/"+env.GITHUB_REPOSITORY+"/contents/"+path.split("/").map(encodeURIComponent).join("/");
}
async function agendaKey(env) {
  if(!env.AGENDA_ENCRYPTION_KEY)throw new Error("Configure o Secret AGENDA_ENCRYPTION_KEY no Worker.");
  const raw=fromBase64(env.AGENDA_ENCRYPTION_KEY);
  if(raw.length!==32)throw new Error("AGENDA_ENCRYPTION_KEY deve ser Base64 de 32 bytes.");
  return crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt","decrypt"]);
}
async function encryptPrivateAgenda(value,env) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await agendaKey(env);
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(value)));
  return {version:1,algorithm:"AES-256-GCM",kdf:"WORKER-SECRET",iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(encrypted))};
}
async function decryptPrivateAgenda(record,env) {
  if(!record)return null;
  if(record.kdf!=="WORKER-SECRET"||record.algorithm!=="AES-256-GCM"||record.version!==1) {
    throw new Error("A agenda usa a criptografia da versão anterior. Ela precisa ser migrada antes de ativar o novo acesso.");
  }
  try {
    const key=await agendaKey(env);
    const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64(record.iv)},key,fromBase64(record.ciphertext));
    const value=JSON.parse(new TextDecoder().decode(decrypted));
    if(!Array.isArray(value.events)||!Array.isArray(value.unavailable))throw new Error("Agenda privada inválida.");
    return value;
  } catch(error) {
    if(String(error.message||"").includes("versão anterior"))throw error;
    throw new Error("Não foi possível abrir a agenda privada. Confira AGENDA_ENCRYPTION_KEY.");
  }
}
async function getRemoteDocument(token,env) {
  const remote=await githubRequest(contentsPath(env)+"?ref="+encodeURIComponent(env.GITHUB_BRANCH||"main"),token);
  if(!remote.content||!remote.sha)throw new Error("O arquivo data/agenda.json está vazio ou ausente.");
  const document=JSON.parse(new TextDecoder().decode(fromBase64(remote.content)));
  if(document.schemaVersion!==1||!Array.isArray(document.products))throw new Error("Arquivo de dados do GitHub com formato inválido.");
  return {sha:remote.sha,document:{
    schemaVersion:1,initialized:Boolean(document.initialized),updatedAt:document.updatedAt||null,
    products:document.products,availability:document.availability||{enabled:false,from:null,through:null,days:{}},
    privateAgenda:await decryptPrivateAgenda(document.privateAgenda,env)
  }};
}
function validateProducts(products) {
  if(!Array.isArray(products)||products.length>300)throw new Error("Catálogo inválido ou com mais de 300 itens.");
  const ids=new Set();
  for(const item of products) {
    if(!item||!/^[A-Za-z0-9_-]{1,120}$/.test(String(item.id||""))||ids.has(item.id)||
      !String(item.name||"").trim()||!String(item.category||"").trim()||!String(item.description||"").trim()||
      !/^https:\/\//i.test(String(item.image||""))||!Number.isInteger(item.stock)||item.stock<1||item.stock>100) {
      throw new Error("O catálogo contém um produto inválido.");
    }
    ids.add(item.id);
  }
}
function isDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return false;
  const [year,month,day]=value.split("-").map(Number),date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
function validatePrivateAgenda(value,products) {
  if(!value||!Array.isArray(value.events)||!Array.isArray(value.unavailable)||value.events.length>3000||value.unavailable.length>3000) {
    throw new Error("Agenda privada inválida ou excede o limite permitido.");
  }
  const productIds=new Set(products.map(product=>product.id)),eventIds=new Set();
  for(const event of value.events) {
    if(!event||!/^[A-Za-z0-9_-]{1,120}$/.test(String(event.id||""))||eventIds.has(event.id)||
      !isDate(event.date)||!String(event.client||"").trim()||!Array.isArray(event.items)||event.items.length>40) {
      throw new Error("Há uma festa com dados inválidos.");
    }
    eventIds.add(event.id);
    for(const item of event.items) {
      if(!productIds.has(item.productId)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>100) {
        throw new Error("Uma reserva de peça contém dados inválidos.");
      }
    }
  }
  for(const block of value.unavailable) {
    if(!block||!productIds.has(block.productId)||!isDate(block.startDate)||!isDate(block.endDate)||
      block.endDate<block.startDate||!Number.isInteger(block.quantity)||block.quantity<1||block.quantity>100) {
      throw new Error("Um bloqueio de estoque contém dados inválidos.");
    }
  }
}
async function putRemoteDocument(token,env,payload) {
  if(!payload||!payload.document)throw new Error("Corpo da gravação inválido.");
  const latest=await getRemoteDocument(token,env);
  if(payload.expectedSha!==latest.sha) {
    const error=new Error("Outra pessoa atualizou a agenda. Atualize o painel antes de salvar.");
    error.status=409;throw error;
  }
  const document=payload.document;
  validateProducts(document.products);
  validatePrivateAgenda(document.privateAgenda,document.products);
  const saved={
    schemaVersion:1,initialized:true,updatedAt:new Date().toISOString(),products:document.products,
    availability:document.availability||{enabled:false,from:null,through:null,days:{}},
    privateAgenda:await encryptPrivateAgenda(document.privateAgenda,env)
  };
  const result=await githubRequest(contentsPath(env),token,{
    method:"PUT",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:"Atualizar agenda, estoque e disponibilidade da Família Decora",
      content:toBase64(new TextEncoder().encode(JSON.stringify(saved,null,2))),sha:latest.sha,branch:env.GITHUB_BRANCH||"main"})
  });
  if(!result.content||!result.content.sha)throw new Error("O GitHub não confirmou a gravação.");
  return {sha:result.content.sha,document:{...document,updatedAt:saved.updatedAt}};
}
async function uploadImage(token,env,request) {
  const url=new URL(request.url),productId=url.searchParams.get("productId")||"",extension=url.searchParams.get("extension")||"";
  const type=request.headers.get("Content-Type")||"",types={webp:"image/webp",jpg:"image/jpeg",png:"image/png"};
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(productId)||types[extension]!==type)return json({error:"Imagem ou produto inválido."},400);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(!bytes.length||bytes.length>MAX_IMAGE_BYTES)return json({error:"A imagem precisa ter até 5 MB."},413);
  const path="assets/products/"+productId+"-"+Date.now()+"."+extension;
  const result=await githubRequest(contentsPath(env,path),token,{
    method:"PUT",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:"Adicionar foto ao catálogo da Família Decora",content:toBase64(bytes),branch:env.GITHUB_BRANCH||"main"})
  });
  const actualPath=result.content?.path||path;
  return {path:actualPath,imageUrl:"https://raw.githubusercontent.com/"+env.GITHUB_REPOSITORY+"/main/"+actualPath.split("/").map(encodeURIComponent).join("/")};
}
async function signSession(email,env) {
  if(!env.SESSION_SIGNING_KEY)throw new Error("Configure o Secret SESSION_SIGNING_KEY no Worker.");
  const now=Math.floor(Date.now()/1000);
  const unsigned=jwtPart({alg:"HS256",typ:"JWT"})+"."+jwtPart({
    iss:"familia-decora-worker",aud:"familia-decora-admin",email,origin:env.ALLOWED_ORIGIN,iat:now,exp:now+SESSION_TTL_SECONDS
  });
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.SESSION_SIGNING_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(unsigned));
  return unsigned+"."+base64url(new Uint8Array(signature));
}
async function verifySession(request,env) {
  const match=(request.headers.get("Authorization")||"").match(/^Bearer ([A-Za-z0-9._-]+)$/);
  if(!match||!env.SESSION_SIGNING_KEY)return null;
  const parts=match[1].split(".");if(parts.length!==3)return null;
  try {
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.SESSION_SIGNING_KEY),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    if(!await crypto.subtle.verify("HMAC",key,fromBase64url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1])))return null;
    const claims=JSON.parse(new TextDecoder().decode(fromBase64url(parts[1]))),allowed=String(env.ADMIN_EMAIL||"").trim().toLowerCase();
    if(claims.iss!=="familia-decora-worker"||claims.aud!=="familia-decora-admin"||
      claims.exp<=Math.floor(Date.now()/1000)||claims.origin!==env.ALLOWED_ORIGIN||!allowed||claims.email!==allowed)return null;
    return claims;
  } catch {return null;}
}
function corsHeaders(env) {
  return {"Access-Control-Allow-Origin":env.ALLOWED_ORIGIN||"null","Access-Control-Allow-Methods":"GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Max-Age":"600","Vary":"Origin"};
}
function authPopup(token,origin) {
  const html="<!doctype html><html lang='pt-BR'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Família Decora</title><body style='font:16px system-ui,sans-serif;padding:32px;color:#49323d'><h1>Acesso autorizado</h1><p>Voltando ao painel da Família Decora…</p><script>const token="+JSON.stringify(token)+";const target="+JSON.stringify(origin)+";if(window.opener){window.opener.postMessage({type:'FAMILIA_DECORA_AUTH',token},target);window.close()}else{document.body.insertAdjacentHTML('beforeend','<p>Feche esta janela e volte ao painel.</p>')}</script></body></html>";
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}});
}
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url),origin=request.headers.get("Origin")||"";
    if(url.pathname==="/auth/complete"&&request.method==="GET") {
      if(!ctx.access)return new Response("Cloudflare Access precisa proteger /auth/complete.",{status:403});
      const identity=await ctx.access.getIdentity(),email=String(identity?.email||"").trim().toLowerCase();
      if(!env.ADMIN_EMAIL||email!==String(env.ADMIN_EMAIL).trim().toLowerCase())return new Response("Este e-mail não está autorizado para a gestão.",{status:403});
      return authPopup(await signSession(email,env),env.ALLOWED_ORIGIN);
    }
    if(origin!==env.ALLOWED_ORIGIN)return json({error:"Origem não autorizada."},403);
    const cors=corsHeaders(env);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
    if(!url.pathname.startsWith("/api/"))return json({error:"Rota não encontrada."},404,cors);
    const session=await verifySession(request,env);
    if(!session)return json({error:"Sessão ausente, expirada ou não autorizada."},401,cors);
    try {
      if(url.pathname==="/api/me"&&request.method==="GET")return json({email:session.email,expiresAt:session.exp},200,cors);
      const token=await createInstallationToken(env);
      if(url.pathname==="/api/data"&&request.method==="GET")return json(await getRemoteDocument(token,env),200,cors);
      if(url.pathname==="/api/data"&&request.method==="PUT")return json(await putRemoteDocument(token,env,await request.json()),200,cors);
      if(url.pathname==="/api/images"&&request.method==="POST")return json(await uploadImage(token,env,request),200,cors);
      return json({error:"Rota não encontrada."},404,cors);
    } catch(error) {
      return json({error:error.message||"Erro interno do serviço seguro."},Number.isInteger(error.status)?error.status:500,cors);
    }
  }
};
