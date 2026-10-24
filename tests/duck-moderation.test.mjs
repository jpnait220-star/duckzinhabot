import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits} from 'discord.js';
import {parseModerationRequest,parseDuration,handleModerationRequest} from '../src/duck-moderation.mjs';

const botId='999999999999999999';
const targetId='222222222222222222';
const authorId='111111111111111111';
function request(text){return parseModerationRequest('<@'+botId+'> '+text,botId);}
function fixture({admin=true,botBan=true,botTimeout=true,canBan=true,canTimeout=true,duplicateName=false}={}){
 const sent=[],calls=[];
 const user={id:targetId,username:'usuarioLegal',globalName:'Pessoa Legal'};
 const target={
   id:targetId,user,permissions:{has:()=>false},
   bannable:canBan,moderatable:canTimeout,
   ban:async options=>{calls.push(['ban',options]);},
   timeout:async (duration,reason)=>{calls.push(['timeout',duration,reason]);}
 };
 const members=new Map([[targetId,target]]);
 const banned={user:{...user}};
 const guild={
   ownerId:'555555555555555555',
   members:{
     me:{permissions:{has:p=>p===PermissionFlagsBits.BanMembers?botBan:
       p===PermissionFlagsBits.ModerateMembers?botTimeout:false}},
     fetch:async id=>members.get(id)||null,
     search:async()=>new Map(duplicateName?[
       [targetId,target],['333333333333333333',{...target,id:'333333333333333333'}]
     ]:[[targetId,target]]),
     cache:members
   },
   bans:{
     fetch:async arg=>typeof arg==='string'?banned:new Map([[targetId,banned]]),
     remove:async (id,reason)=>{calls.push(['unban',id,reason]);}
   }
 };
 const message={
   content:'',guild,author:{id:authorId,username:'administrador',bot:false},
   member:{permissions:{has:p=>admin&&p===PermissionFlagsBits.Administrator}},
   inGuild:()=>true,
   reply:async p=>{sent.push(p);return p}
 };
 async function run(action,text){
   message.content='<@'+botId+'> '+text;
   return handleModerationRequest(message,action||request(text),{botId});
 }
 return {message,run,sent,calls,target,guild};
}

test('aceita comandos por menção, e ignora frases que não são ordens',()=>{
 assert.equal(request('bana <@'+targetId+'>').kind,'ban');
 assert.equal(request('desbana '+targetId).kind,'unban');
 assert.equal(request('banir o usuarioLegal').kind,'ban');
 assert.equal(request('castiga <@'+targetId+'> por 30 minutos').kind,'timeout');
 assert.equal(request('muta <@'+targetId+'> por 1h').kind,'timeout');
 assert.equal(request('desmuta <@'+targetId+'>').kind,'untimeout');
 assert.equal(request('tira o castigo <@'+targetId+'>').kind,'untimeout');
 assert.equal(request('remove o castigo <@'+targetId+'>').kind,'untimeout');
 assert.equal(request('o que é banimento?'),null);
});
test('tempo de castigo reconhece minutos, horas e dias',()=>{
 assert.equal(parseDuration('por 15 minutos').ms,15*60000);
 assert.equal(parseDuration('durante 2h').ms,2*3600000);
 assert.equal(parseDuration('7 dias').ms,7*86400000);
});
test('membro comum não pode executar moderação, mesmo mencionando a bot',async()=>{
 const {run,calls,sent}=fixture({admin:false});
 await run(null,'bana <@'+targetId+'>');
 assert.equal(calls.length,0);
 assert.match(sent[0].content,/Acesso negado/);
 assert.deepEqual(sent[0].allowedMentions,{parse:[],repliedUser:false});
});
test('admin pode banir apenas membro bannable; mensagem não menciona todos',async()=>{
 const {run,calls,sent}=fixture();
 await run(null,'bana <@'+targetId+'> motivo: spam');
 assert.equal(calls[0][0],'ban');
 assert.match(calls[0][1].reason,/spam/);
 assert.equal(calls[0][1].deleteMessageSeconds,0);
 assert.match(sent.at(-1).content,/Membro banido/);
 assert.deepEqual(sent.at(-1).allowedMentions,{parse:[],repliedUser:false});
});
test('admin pode desbanir por ID e aplicar ou remover timeout',async()=>{
 const {run,calls}=fixture();
 await run(null,'desbana '+targetId);
 await run(null,'castiga <@'+targetId+'> por 20 minutos');
 await run(null,'tira o castigo <@'+targetId+'>');
 assert.equal(calls[0][0],'unban');
 assert.deepEqual(calls[1].slice(0,2),['timeout',1200000]);
 assert.deepEqual(calls[2].slice(0,2),['timeout',null]);
});
test('punição bloqueia administradores, hierarquia e castigos acima do limite',async()=>{
 let x=fixture({canBan:false});
 await x.run(null,'bana <@'+targetId+'>');
 assert.equal(x.calls.length,0);
 assert.match(x.sent.at(-1).content,/hierarquia/);
 x=fixture();
 x.target.permissions.has=p=>p===PermissionFlagsBits.Administrator;
 await x.run(null,'castiga <@'+targetId+'> por 10 minutos');
 assert.equal(x.calls.length,0);
 assert.match(x.sent.at(-1).content,/outro administrador/);
 x=fixture();
 await x.run(null,'castiga <@'+targetId+'> por 29 dias');
 assert.equal(x.calls.length,0);
 assert.match(x.sent.at(-1).content,/28 dias/);
});
test('apelidos ambíguos e múltiplos alvos são rejeitados',async()=>{
 let x=fixture({duplicateName:true});
 await x.run(null,'bana usuarioLegal');
 assert.equal(x.calls.length,0);
 assert.match(x.sent.at(-1).content,/mais de uma pessoa/);
 x=fixture();
 await x.run(null,'bana <@'+targetId+'> <@333333333333333333>');
 assert.equal(x.calls.length,0);
 assert.match(x.sent.at(-1).content,/apenas um usuário/);
});
test('sem permissão de banir ou timeout, nunca aplica a punição',async()=>{
 const x=fixture({botBan:false,botTimeout:false});
 await x.run(null,'bana <@'+targetId+'>');
 await x.run(null,'muta <@'+targetId+'>');
 assert.equal(x.calls.length,0);
 assert.match(x.sent[0].content,/Banir Membros/);
 assert.match(x.sent[1].content,/Moderar Membros/);
});
