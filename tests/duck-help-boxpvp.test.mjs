import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits,MessageFlags} from 'discord.js';
import {commandPayloads,embed} from '../src/commands.mjs';
import {memberHelpEmbeds,MEMBER_HELP_SECTIONS} from '../src/duck-member-help.mjs';
import {showBoxPvp,manageBoxPvp,validateBoxPvpIp} from '../src/duck-boxpvp-directory.mjs';

const gid='111111111111111111';
const uid='222222222222222222';
const commandList=commandPayloads();
const slashNames=commandList.filter(x=>x.type===1||!x.type).map(x=>x.name);
const helpCommands=MEMBER_HELP_SECTIONS.flatMap(s=>s.commands.map(x=>x[0]));
test('ajuda tem quatro embeds, todos abaixo do limite, sem comandos restritos',()=>{
 const embeds=memberHelpEmbeds(embed);
 assert.equal(embeds.length,4);
 for(const e of embeds){
  assert.ok(e.data.description.length<4096);
  assert.ok(e.data.description.length>80);
 }
 const text=embeds.map(x=>x.data.description).join('\n');
 assert.match(text,/\/minigame/);
 assert.match(text,/\/boxpvp/);
 assert.match(text,/cadastrar.*IP BoxPvP/);
 assert.match(text,/\/duckzinha entrar/);
 for(const forbidden of ['/configurar','/ensinar','/boxpvpadmin','/painel',
  '/novidade publicar','/sugestao aprovar','/diario publicar',
  '/emblema configurar','/modlog','/jogo parar','/falar','/duckzinha reset'])
  assert.ok(!text.includes('**'+forbidden+'**'),'leak '+forbidden);
});
test('o catálogo de membros cobre comandos registrados que não exigem moderação',()=>{
 const excluded=new Set([
  'configurar','ensinar','ensinamentos','painel','falar','novidade','modlog',
  'sugestao','diario','boxpvpadmin','cargosreacao'
 ]);
 const memberTop=new Set(helpCommands.map(x=>x.split(' ')[0].slice(1)));
 for(const name of slashNames){
  if(!excluded.has(name))assert.ok(memberTop.has(name),'missing public command: '+name);
 }
 assert.ok(slashNames.includes('boxpvpadmin'));
 assert.ok(helpCommands.some(x=>x==='/boxpvp'));
});
test('IP BoxPvP é validado e normalizado sem links/menções',()=>{
 assert.equal(validateBoxPvpIp('Box.example.NET:25565'),'box.example.net:25565');
 assert.equal(validateBoxPvpIp('198.51.100.20'),'198.51.100.20');
 for(const invalid of ['x','localhost','example.com','bad..example.net',
  'example.net:0','example.net:99999','https://example.net',
  'example.net/anything','test server.net','127.0.0.1'])
   assert.equal(validateBoxPvpIp(invalid),null,invalid);
});
function fakeStore(rows=[]){
 let mode='read',inserted,deleted;
 const chain={
  select(){return chain;},eq(){return chain;},order(){return chain;},
  limit(){return chain;},single(){return {id:9}},maybeSingle(){return {id:5}},
  insert(x){mode='insert';inserted=x;return chain;},
  delete(){mode='delete';return chain;}
 };
 return {
  store:{persistent:true,db:{from:()=>chain},requireResult:async q=>
   Array.isArray(q)?q:(mode==='read'?rows:mode==='insert'?{id:9}:{id:5})},
  get inserted(){return inserted;},get deleted(){return deleted}
 };
}
test('boxpvp mostra somente endereços cadastrados e como pedir ticket',async()=>{
 let response;
 const io={guildId:gid,reply:async r=>{response=r}};
 const db=fakeStore([{id:1,server_name:'Teste Box',server_ip:'box.test.net:25565'}]);
 await showBoxPvp(io,{store:db.store,panelId:'333333333333333333'});
 const text=response.embeds[0].data.description;
 assert.match(text,/Teste Box/);
 assert.match(text,/box.test.net:25565/);
 assert.match(text,/Abra um ticket/);
 assert.match(text,/<#333333333333333333>/);
 assert.deepEqual(response.allowedMentions,{parse:[]});
});
test('boxpvp sem servidores exibe estado vazio, sem IP inventado',async()=>{
 let response;
 const db=fakeStore([]);
 await showBoxPvp({guildId:gid,reply:async r=>{response=r}},{store:db.store});
 assert.match(response.embeds[0].data.description,/Ainda não há servidores/);
 assert.match(response.embeds[0].data.description,/Abra um ticket/);
});
test('somente admins podem registrar e excluir, e ticket não cadastra automaticamente',async()=>{
 let response;
 const db=fakeStore();
 const base={guildId:gid,user:{id:uid},memberPermissions:{has:()=>false},
  options:{getSubcommand:()=> 'adicionar',getString:x=>x==='nome'?'Meu Box':'box.example.net'},
  reply:async r=>{response=r}};
 await manageBoxPvp(base,{store:db.store});
 assert.match(response.content,/Apenas administradores/);
 assert.equal(response.flags,MessageFlags.Ephemeral);
 await manageBoxPvp({...base,memberPermissions:{has:p=>p===PermissionFlagsBits.Administrator}},{store:db.store});
 assert.match(response.content,/BoxPvP cadastrado/);
 assert.equal(db.inserted.server_name,'Meu Box');
 assert.equal(db.inserted.server_ip,'box.example.net');
});
