import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {DuckStudio} from '../src/duck-studio.mjs';

function fixture(){
  const saved=new Map();let allowed=true,applied=null;
  const bot={id:'123456789123456789',async setAvatar(buffer){applied=buffer;}};
  const store={guildId:'guild1',persistent:true,
    async getAvatar(id){return saved.get(id)||null;},
    async setAvatar(id,value){saved.set(id,value);}};
  const client={user:bot,guilds:{fetch:async()=>({
    members:{fetch:async()=>({permissions:{has:()=>allowed}})}
  })}};
  const studio=new DuckStudio({store,client,extras:{}});
  studio.sessions.set('session123',{userId:'staff1',admin:true,
    expires:Date.now()+60000});
  async function request(method,url,body={},cookie='duck_session=session123'){
    const req=Readable.from(method==='POST'?[JSON.stringify(body)]:[]);
    Object.assign(req,{method,url,headers:{cookie}});
    let status=0,payload=Buffer.alloc(0);
    const res={headersSent:false,writeHead(code){status=code;},
      end(value){payload=Buffer.from(value||'');this.headersSent=true;}};
    await studio.route(req,res);
    const isPng=url.endsWith('.png');
    return {status,value:isPng?payload:JSON.parse(payload.toString()),raw:payload};
  }
  return {request,bot,saved,studio,forbid:()=>{allowed=false;},get applied(){return applied;}};
}
test('painel permite modificar avatar da Duckzinha sem alterar avatar de membro',async()=>{
  const x=fixture();
  const userAvatar={corpo:'azul'};
  x.saved.set('staff1',userAvatar);
  const response=await x.request('POST','/api/bot/avatar',{avatar:{
    corpo:'rosa',aura:'gelo',pet:'mini_pato',rosto:'mascara_corvo'
  }});
  assert.equal(response.status,200);
  assert.equal(x.saved.get(x.bot.id).corpo,'rosa');
  assert.equal(x.saved.get(x.bot.id).rosto,'nenhum');
  assert.deepEqual(x.saved.get('staff1'),userAvatar);
  const preview=await x.request('GET','/api/bot/avatar.png');
  assert.equal(preview.status,200);
  assert.equal(preview.raw.subarray(0,4).toString('hex'),'89504e47');
});
test('sem autorização não é possível editar ou aplicar o avatar do bot',async()=>{
  const x=fixture();
  const untrusted=await x.request('POST','/api/bot/avatar',{avatar:{aura:'fogo'}},'');
  assert.equal(untrusted.status,401);
  const noPrivilege=await x.request('GET','/api/bot/avatar','');
  assert.equal(noPrivilege.status,200); // admin ativo
  x.forbid();
  const denied=await x.request('POST','/api/bot/avatar',{avatar:{aura:'fogo'}});
  assert.equal(denied.status,403);
  const deniedApply=await x.request('POST','/api/bot/avatar/apply',{});
  assert.equal(deniedApply.status,403);
  assert.equal(x.applied,null);
});
test('aplicar foto de bot gera PNG com a configuração salva',async()=>{
  const x=fixture();
  await x.request('POST','/api/bot/avatar',{avatar:{aura:'estrelas',chapeu:'coroa'}});
  const outcome=await x.request('POST','/api/bot/avatar/apply',{});
  assert.equal(outcome.status,200);
  assert.equal(x.applied.subarray(0,4).toString('hex'),'89504e47');
});
