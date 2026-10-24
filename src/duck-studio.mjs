import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {renderAvatar,normalizeAvatar,COLORS} from './duck-avatar.mjs';
import {MOODS,normalizeSettings} from './duck-extras.mjs';
import {PermissionFlagsBits} from 'discord.js';

function html(){
return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>Duckzinha Studio • Avatares</title>
<style>
:root{font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f5f4f2;background:#101118}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 80% 0,#29243e 0,transparent 43%),#101118}
header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:19px clamp(18px,4vw,64px);border-bottom:1px solid #30303c}
.brand{font-size:22px;font-weight:900;letter-spacing:-.7px}.brand b{color:#ffda55}
header small{color:#a5a4b5}main{max-width:1060px;padding:28px 20px 90px;margin:auto}
.hero{margin:10px 0 25px}.hero h1{font-size:clamp(29px,5vw,48px);letter-spacing:-1.6px;margin:0 0 7px}.hero p{color:#abaabb;margin:0}
.panel{background:#1d1e29;border:1px solid #343541;border-radius:22px;padding:24px;box-shadow:0 14px 40px #0002}
.layout{display:grid;grid-template-columns:minmax(260px,420px) minmax(300px,1fr);gap:20px}
.preview{display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:17px;background:radial-gradient(circle at 18% 12%,#564465,#302b41 60%,#1f2638);border-radius:18px;min-height:430px;padding:24px 14px 19px;border:1px solid #ffffff17}
.preview img{width:min(94%,340px);aspect-ratio:1;image-rendering:auto;border:6px solid #ffffff1a;border-radius:28px;box-shadow:0 18px 45px #0007}.preview small{color:#b7b9d1;text-align:center}.preview-head{font-weight:850;color:#ffde7a;letter-spacing:.04em;font-size:13px}.preview-tip{font-size:12px;color:#c3bdd4;max-width:310px;text-align:center}.subsection{grid-column:1/-1;color:#ffdf78;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #414050;padding:6px 0 7px}
h2{font-size:20px;margin:0 0 16px}label{display:block;color:#d9d9e4;font-size:14px;margin:0 0 5px;font-weight:600}
.controls{display:grid;grid-template-columns:1fr 1fr;gap:14px}
select,input{width:100%;border:1px solid #494857;border-radius:12px;padding:12px;background:#282936;color:white;font:inherit;outline-color:#ffdc59}
button{border:0;border-radius:12px;padding:13px 19px;font-weight:800;background:#ffda5e;color:#1a1924;font:inherit;cursor:pointer}
button:hover{filter:brightness(1.06)}button:disabled{opacity:.5;cursor:not-allowed}
button.secondary{background:#343546;color:#fff}button.secondary.active{outline:2px solid #ffda5e}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.notice{min-height:28px;margin:14px 0 0;color:#ddcfc0;font-size:14px}
.tip{margin-top:18px;border:1px solid #3c3b49;border-radius:16px;padding:16px;color:#bbbbcd}
.hidden{display:none!important}.login{max-width:510px;margin:45px auto}.login input{margin:14px 0}.login p{color:#a5a3b9}
.tabs{display:flex;gap:10px;margin:0 0 20px}.switch{display:flex;align-items:center;justify-content:space-between;background:#282936;border-radius:12px;padding:13px;margin:10px 0}
.switch input{width:22px;height:22px}
@media(max-width:760px){.layout{grid-template-columns:1fr}.controls{grid-template-columns:1fr 1fr}.preview{min-height:290px}.preview img{max-width:245px}.panel{padding:17px}}
</style></head>
<body><header><div class="brand">🦆 <b>Duckzinha</b> Studio</div><small>Seu avatar, seu estilo</small></header>
<main>
<section class="hero"><h1>Crie seu patinho. 💛</h1><p>Vista seu pato, misture cosméticos em camadas e monte um visual único para mostrar no Discord.</p></section>
<section id="login" class="panel login"><h2>Entrar no Studio</h2><p>Abra o Discord e use <strong>/avatar</strong> para receber seu código de acesso privado. Ele expira em 5 minutos.</p>
<label for="code">Código de acesso</label><input id="code" placeholder="Cole o código que recebeu pelo Discord" autocomplete="off">
<button id="loginButton">Entrar</button><p id="loginStatus" role="status"></p></section>
<section id="studio" class="hidden">
<div class="tabs"><button id="avatarTab" class="secondary active">🎨 Meu avatar</button><button id="adminTab" class="secondary hidden">⚙️ Administração</button><button id="logout" class="secondary">Sair</button></div>
<div id="avatarPane" class="layout">
 <section class="panel preview"><span class="preview-head">✦ DUCKZINHA AVATAR STUDIO ✦</span><img id="avatar" alt="Prévia detalhada do seu avatar de pato"><div class="preview-tip">Seu patinho com acessórios independentes e combinações exclusivas ✨</div></section>
 <section class="panel"><h2 id="welcome">Personalize seu avatar</h2>
 <div class="controls">
 <div class="subsection">🎨 Aparência</div>
 <div><label for="corpo">Cor do patinho</label><select id="corpo"></select></div>
 <div><label for="olhos">Expressão dos olhos</label><select id="olhos"></select></div>
 <div><label for="fundo">Fundo do avatar</label><select id="fundo"></select></div>
 <div class="subsection">🧢 Cosméticos • combine à vontade</div>
 <div><label for="chapeu">Chapéus e coroas</label><select id="chapeu"></select></div>
 <div><label for="rosto">Óculos e máscaras</label><select id="rosto"></select></div>
 <div><label for="roupa">Roupas</label><select id="roupa"></select></div>
 <div><label for="maos">Punhos e luvas</label><select id="maos"></select></div>
 <div><label for="aura">Auras e efeitos</label><select id="aura"></select></div>
 <div><label for="pet">Mascote companheiro</label><select id="pet"></select></div>
 </div><div class="actions"><button id="save">💛 Salvar visual</button><button id="random" class="secondary">🎲 Surpreenda-me</button><button id="cute" class="secondary">🐰 Fofo</button><button id="combat" class="secondary">⚔️ PvP</button></div>
 <p id="status" role="status" class="notice"></p>
 <div class="tip">No Discord, use <strong>/ver pessoa</strong> para mostrar o avatar de alguém. Seus acessórios ficam salvos até você mudar novamente.</div>
 </section>
</div>
<div id="adminPane" class="panel hidden">
 <h2>Configurações da Duckzinha</h2><p>Este painel só pode ser usado por quem tem permissão de administrador no servidor.</p>
 <label for="mood">Humor da Duckzinha</label><select id="mood"></select>
 <label class="switch">Voz com emoções <input type="checkbox" id="emotionalVoice"></label>
 <label class="switch">Reações especiais <input type="checkbox" id="specialReactions"></label>
 <button id="saveSettings">Salvar configurações</button><p id="settingsStatus" class="notice" role="status"></p>
 </div>
</section>
</main>
<script>
const names=${JSON.stringify(COLORS)};
const pretty={ceu:'Céu limpo',lilas:'Lilás',menta:'Menta',por_do_sol:'Pôr do sol',
  neon:'Neon',cafe:'Café',espaco:'Espaço',creme:'Creme',caramelo:'Caramelo',
  oculos:'Óculos clássicos',escuros:'Óculos escuros',visor:'Visor futurista',
  mascara_pato:'Máscara de pato',mascara_corvo:'Máscara de corvo',mascara_japonesa:'Máscara japonesa',
  monoculo:'Monóculo',laco:'Laço',bone:'Boné',touca:'Touca',coelho:'Orelhas de coelho',
  sombrero:'Sombrero',chines:'Chapéu chinês',cartola:'Cartola',tiara:'Tiara',
  natal:'Gorro de Natal',moletom:'Moletom',nenhum:'Nenhum',nenhuma:'Nenhuma',
  sonolento:'Sonolento',piscando:'Piscando',determinado:'Determinado',
  cachecol:'Cachecol',jaqueta:'Jaqueta',kimono:'Quimono',capa:'Capa real',
  uniforme:'Uniforme',sueter:'Suéter',terno:'Terno elegante',armadura:'Armadura',
  praia:'Roupa de praia',luvas_boxe:'Luvas de boxe',garras:'Garras Spring',
  punhos_gelo:'Punhos de gelo',punhos_fogo:'Punhos de fogo',
  punhos_corrompidos:'Punhos corrompidos',luvas_brancas:'Luvas brancas',
  brilho:'Brilho delicado',estrelas:'Estrelas',coracoes:'Corações',
  fogo:'Fogo',gelo:'Gelo',eletrica:'Eletricidade',dinheiro:'Dinheiro',
  fantasma:'Ghost Pet',estrela:'Pet estrela',mini_pato:'Mini patinho',
  ceifador:'Pet ceifador',borboleta:'Borboleta'};
const $=id=>document.getElementById(id);
for(const [k,opts] of Object.entries(names))for(const v of opts)$ (k).add(new Option(pretty[v]||v[0].toUpperCase()+v.slice(1),v));
for(const v of ['auto','animada','calma','curiosa','sonolenta'])$('mood').add(new Option(v[0].toUpperCase()+v.slice(1),v));
const params=()=>Object.fromEntries(Object.keys(names).map(k=>[k,$(k).value]));
let current=null;
function preview(){$('avatar').src='/api/preview.png?'+new URLSearchParams(params());}
for(const k of Object.keys(names))$(k).addEventListener('change',preview);
async function request(path,method='GET',body){
 const res=await fetch(path,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({error:'Resposta inválida do servidor.'}));
 if(!res.ok)throw Error(data.error||'Erro HTTP '+res.status);
 return data;
}
async function enter(){
 try{
  current=await request('/api/me');
  $('login').classList.add('hidden');$('studio').classList.remove('hidden');
  $('welcome').textContent='Avatar de '+current.name;
  Object.entries(current.avatar).forEach(([k,v])=>{if($(k))$(k).value=v;});
  $('adminTab').classList.toggle('hidden',!current.admin);
  preview();
  if(current.admin){
   $('mood').value=current.settings.mood;
   $('emotionalVoice').checked=current.settings.emotionalVoice;
   $('specialReactions').checked=current.settings.specialReactions;
  }
 }catch(e){$('login').classList.remove('hidden');$('studio').classList.add('hidden');}
}
$('loginButton').onclick=async()=>{
 $('loginStatus').textContent='Conferindo acesso...';
 try{await request('/api/login','POST',{code:$('code').value.trim()});$('code').value='';await enter();}
 catch(e){$('loginStatus').textContent=e.message;}
};
$('save').onclick=async()=>{
 $('status').textContent='Salvando...';
 try{await request('/api/avatar','POST',{avatar:params()});$('status').textContent='💛 Avatar salvo! Use /ver pessoa no Discord.';}
 catch(e){$('status').textContent=e.message;}
};
$('random').onclick=()=>{for(const [k,opts] of Object.entries(names))$(k).value=opts[Math.floor(Math.random()*opts.length)];preview();};
function preset(values){for(const [k,v] of Object.entries(values))if($(k))$(k).value=v;preview();}
$('cute').onclick=()=>preset({corpo:'creme',fundo:'rosa',chapeu:'coelho',rosto:'nenhum',roupa:'moletom',maos:'luvas_brancas',aura:'coracoes',pet:'mini_pato',olhos:'feliz'});
$('combat').onclick=()=>preset({corpo:'amarelo',fundo:'neon',chapeu:'bone',rosto:'visor',roupa:'armadura',maos:'punhos_corrompidos',aura:'eletrica',pet:'ceifador',olhos:'determinado'});
function tab(admin){$('avatarPane').classList.toggle('hidden',admin);$('adminPane').classList.toggle('hidden',!admin);$('avatarTab').classList.toggle('active',!admin);$('adminTab').classList.toggle('active',admin);}
$('avatarTab').onclick=()=>tab(false);
$('adminTab').onclick=()=>{if(current?.admin)tab(true);};
$('saveSettings').onclick=async()=>{
 $('settingsStatus').textContent='Salvando...';
 try{const data=await request('/api/settings','POST',{settings:{mood:$('mood').value,emotionalVoice:$('emotionalVoice').checked,specialReactions:$('specialReactions').checked}});$('settingsStatus').textContent=data.persistent?'Configuração salva no Supabase.':'Configuração temporária. Atualize a migração SQL para persistir.';}
 catch(e){$('settingsStatus').textContent=e.message;}
};
$('logout').onclick=async()=>{await request('/api/logout','POST',{}).catch(()=>{});current=null;location.assign('/');};
const fragment=new URLSearchParams(location.hash.replace(/^#/,''));
const code=fragment.get('code');
if(code){
 history.replaceState(null,'',location.pathname);
 $('code').value=code;
 $('loginButton').click();
}else enter();
</script></body></html>`;
}
const respond=(res,status,data,type='application/json; charset=utf-8')=>{
 const buffer=Buffer.isBuffer(data)?data:Buffer.from(type.startsWith('application/json')?JSON.stringify(data):String(data));
 res.writeHead(status,{'Content-Type':type,'Content-Length':buffer.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':type.startsWith('text/html')?"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'":"default-src 'none'"});res.end(buffer);
};
function readJson(req){
 return new Promise((resolve,reject)=>{
  let data='',length=0;
  req.on('data',chunk=>{
   length+=chunk.length;if(length>4000){reject(Error('Pedido muito grande'));req.destroy();return;}
   data+=chunk;
  });req.on('end',()=>{try{resolve(JSON.parse(data||'{}'));}catch{reject(Error('JSON inválido'));}});req.on('error',reject);
 });
}
export class DuckStudio{
 constructor({store,extras,client}={}){
  this.store=store;this.extras=extras;this.client=client;
  this.codes=new Map();this.sessions=new Map();this.server=null;
 }
 get url(){return String(process.env.APP_URL||'').replace(/\/$/,'');}
 link(type,member,admin=false){
  if(!this.url)return null;
  const code=randomBytes(24).toString('base64url');
  const now=Date.now();
  for(const [key,value] of this.codes)if(value.expires<now)this.codes.delete(key);
  this.codes.set(code,{userId:member.id,guildId:this.store.guildId,admin,name:member.displayName||member.user?.username||'Membro',expires:now+300000});
  return this.url+'/'+(type==='painel'?'painel':'avatar')+'#code='+code;
 }
 session(req){
  const cookie=String(req.headers.cookie||'').match(/(?:^|;\s*)duck_session=([a-zA-Z0-9_-]+)/)?.[1];
  const session=cookie?this.sessions.get(cookie):null;
  if(!session||session.expires<Date.now()){if(cookie)this.sessions.delete(cookie);return null;}
  return session;
 }
 async avatar(userId){
  const existing=await this.store.getAvatar(userId).catch(()=>null);
  return normalizeAvatar(existing);
 }
 async canManageBot(who){
  if(!who?.admin||!this.client?.user?.id)return false;
  try{
    const guild=await this.client.guilds.fetch(this.store.guildId);
    const member=await guild.members.fetch(who.userId);
    return member.permissions.has(PermissionFlagsBits.Administrator);
  }catch(err){
    console.warn('[Duckzinha] Verificação de admin: '+String(err?.message||err).slice(0,120));
    return false;
  }
 }
 start(){
  const port=Number(process.env.PORT)||8080;
  this.server=createServer((req,res)=>{void this.route(req,res).catch(e=>{
    console.warn('[Duckzinha] Studio: '+String(e.message||e));
    if(!res.headersSent)respond(res,500,{error:'Erro interno do Studio.'});
    else res.end();
  });});
  this.server.listen(port,'0.0.0.0',()=>console.log('[Duckzinha] Studio ouvindo na porta '+port+
    (this.url?' • '+this.url:' • ative Web address na FadeHost')));
 }
 async route(req,res){
  const url=new URL(req.url||'/', 'http://local');
  const path=url.pathname;
  const method=req.method||'GET';
  if(method==='GET'&&(path==='/'||path==='/avatar'||path==='/painel')){
    return respond(res,200,html(),'text/html; charset=utf-8');
  }
  if(method==='GET'&&path==='/health')return respond(res,200,{status:'ok'});
  if(method==='GET'&&path==='/api/preview.png'){
    const avatar=Object.fromEntries(Object.keys(normalizeAvatar()).map(k=>[k,url.searchParams.get(k)]));
    return respond(res,200,renderAvatar(avatar),'image/png');
  }
  if(method==='GET'&&path==='/api/bot/avatar.png'){
    if(!this.client?.user?.id)return respond(res,503,{error:'Duckzinha offline.'});
    return respond(res,200,renderAvatar(await this.avatar(this.client.user.id)),'image/png');
  }
  if(method==='GET'&&path==='/api/bot/avatar'){
    const who=this.session(req);
    if(!await this.canManageBot(who))return respond(res,403,{error:'Somente administradores.'});
    return respond(res,200,{avatar:await this.avatar(this.client.user.id)});
  }
  if(method==='GET'&&/^\/api\/avatar\/\d{17,22}\.png$/.test(path)){
    const id=path.split('/').pop().replace('.png','');
    return respond(res,200,renderAvatar(await this.avatar(id)),'image/png');
  }
  if(method==='POST'){
    // Cookies de sessão só são aceitos na própria origem do Studio.
    const origin=req.headers.origin;
    if(origin){
      let expected;
      try{expected=this.url?new URL(this.url).origin:'https://'+req.headers.host;}catch{expected='';}
      if(origin!==expected)return respond(res,403,{error:'Origem não permitida.'});
    }
    const body=await readJson(req);
    if(path==='/api/login'){
      const code=String(body.code||'');
      const item=this.codes.get(code);
      if(!item||item.expires<Date.now())return respond(res,401,{error:'Código inválido ou expirado. Use /avatar novamente.'});
      this.codes.delete(code);
      const token=randomBytes(32).toString('base64url');
      this.sessions.set(token,{...item,expires:Date.now()+30*60_000});
      res.setHeader('Set-Cookie','duck_session='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800');
      return respond(res,200,{ok:true});
    }
    const who=this.session(req);
    if(path==='/api/logout'){
      if(who)for(const [key,s] of this.sessions)if(s===who)this.sessions.delete(key);
      res.setHeader('Set-Cookie','duck_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
      return respond(res,200,{ok:true});
    }
    if(!who)return respond(res,401,{error:'Sessão expirada. Use /avatar para entrar novamente.'});
    if(path==='/api/bot/avatar'||path==='/api/bot/avatar/apply'){
      if(!await this.canManageBot(who))return respond(res,403,{error:'Somente administradores podem editar a Duckzinha.'});
      if(!this.store.persistent)return respond(res,503,{error:'Supabase precisa estar configurado.'});
      if(path==='/api/bot/avatar'){
        const avatar=normalizeAvatar(body.avatar);
        await this.store.setAvatar(this.client.user.id,avatar);
        return respond(res,200,{ok:true,avatar});
      }
      await this.client.user.setAvatar(renderAvatar(await this.avatar(this.client.user.id)));
      return respond(res,200,{ok:true});
    }
    if(path==='/api/avatar'){
      if(!this.store.persistent)return respond(res,503,{error:'É necessário configurar o Supabase para guardar avatares.'});
      const avatar=normalizeAvatar(body.avatar);
      await this.store.setAvatar(who.userId,avatar);
      return respond(res,200,{ok:true,avatar});
    }
    if(path==='/api/settings'&&await this.canManageBot(who)){
      const next=normalizeSettings(body.settings);
      let persisted=true;
      for(const [k,v] of Object.entries(next)){
        if(!await this.extras.update(k,v,who.userId))persisted=false;
      }
      return respond(res,200,{ok:true,persistent:persisted});
    }
    return respond(res,403,{error:'Ação não autorizada.'});
  }
  if(method==='GET'&&path==='/api/me'){
    const who=this.session(req);
    if(!who)return respond(res,401,{error:'Não autenticado'});
    return respond(res,200,{id:who.userId,name:who.name,admin:who.admin,
      avatar:await this.avatar(who.userId),settings:who.admin?this.extras.settings:undefined});
  }
  return respond(res,404,{error:'Página não encontrada'});
 }
 close(){this.server?.close();this.codes.clear();this.sessions.clear();}
}
