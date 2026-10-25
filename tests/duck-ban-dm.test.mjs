import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits} from 'discord.js';
import {DuckBanNotifier,banDmText} from '../src/duck-ban-dm.mjs';
import {parseModerationRequest,handleModerationRequest} from '../src/duck-moderation.mjs';

const server='111111111111111111',user='222222222222222222',admin='333333333333333333',bot='444444444444444444';
test('a DM informa servidor, moderador e motivo com mensagem educada',()=>{
 const s=banDmText({guildName:'Comunidade Duck',moderator:'Moderador',reason:'Spam'});
 assert.match(s,/banido/);
 assert.match(s,/Moderador/);
 assert.match(s,/Spam/);
 assert.match(s,/respeitar as regras/);
 assert.doesNotMatch(s,/@everyone|@here/);
});
test('o comando envia DM só depois do banimento concluir e com o moderador correto',async()=>{
 const events=[];
 const notifier=new DuckBanNotifier({logger:{warn:()=>{}},wait:async()=>{}});
 const target={id:user,username:'Pessoa',send:async msg=>{events.push(['dm',msg]);}};
 const member={id:user,user:target,bannable:true,permissions:{has:()=>false},
  ban:async()=>{events.push(['banned']);}};
 const guild={id:server,name:'DuckzinCommunity',ownerId:'555555555555555555',
  members:{
   me:{permissions:{has:()=>true}},fetch:async()=>member
  }};
 const msg={content:'<@'+bot+'> bana <@'+user+'> motivo: spam',guild,
  author:{id:admin,username:'AdminTeste'},
  member:{permissions:{has:()=>true}},inGuild:()=>true,
  reply:async()=>{}};
 await handleModerationRequest(msg,parseModerationRequest(msg.content,bot),{
  botId:bot,banNotifier:notifier
 });
 assert.deepEqual(events.map(x=>x[0]),['banned','dm']);
 assert.match(events[1][1].content,/AdminTeste/);
 assert.match(events[1][1].content,/spam/);
 assert.deepEqual(events[1][1].allowedMentions,{parse:[]});
 assert.equal(notifier.reserve(server,user),false);
});
test('ban negado não avisa falsamente à pessoa e libera reserva',async()=>{
 const events=[],notifier=new DuckBanNotifier({logger:{warn:()=>{}}});
 const target={id:user,username:'Pessoa',send:async msg=>{events.push(msg)}};
 const member={id:user,user:target,bannable:true,permissions:{has:()=>false},
  ban:async()=>{throw Error('sem hierarquia')}};
 const guild={id:server,name:'DuckzinCommunity',ownerId:'555555555555555555',
  members:{me:{permissions:{has:()=>true}},fetch:async()=>member}};
 const msg={content:'<@'+bot+'> bana <@'+user+'> motivo: spam',guild,
  author:{id:admin,username:'AdminTeste'},
  member:{permissions:{has:()=>true}},inGuild:()=>true,
  reply:async()=>{}};
 await handleModerationRequest(msg,parseModerationRequest(msg.content,bot),{
  botId:bot,banNotifier:notifier
 });
 assert.equal(events.length,0);
 assert.equal(notifier.reserve(server,user),true);
});
test('ban feito no Discord consulta audit log e envia DM sem duplicar',async()=>{
 const sent=[],logs={entries:new Map([['one',{
  target:{id:user},executor:{id:admin,username:'Staff'},reason:'Ofensa',
  createdTimestamp:100000
 }]])};
 const notifier=new DuckBanNotifier({now:()=>100000,wait:async()=>{}});
 const guild={id:server,name:'Comunidade Duck',
  members:{me:{permissions:{has:p=>p===PermissionFlagsBits.ViewAuditLog}}},
  fetchAuditLogs:async()=>logs};
 const ban={guild,user:{id:user,send:async body=>{sent.push(body)}}};
 assert.deepEqual(await notifier.onBanEvent(ban),{ok:true});
 assert.match(sent[0].content,/Staff/);
 assert.match(sent[0].content,/Ofensa/);
 assert.equal((await notifier.onBanEvent(ban)).reason,'duplicate');
 assert.equal(sent.length,1);
});
test('sem permissões de audit log não inventa moderador',async()=>{
 const messages=[];
 const notifier=new DuckBanNotifier({now:()=>100000,wait:async()=>{}});
 const ban={guild:{id:server,name:'Comunidade',
   members:{me:{permissions:{has:()=>false}}}},
  user:{id:user,send:async data=>messages.push(data)}};
 await notifier.onBanEvent(ban);
 assert.match(messages[0].content,/equipe de moderação/);
 assert.match(messages[0].content,/Motivo não informado/);
});
test('se DMs estiverem fechadas não interrompe moderação',async()=>{
 const notifier=new DuckBanNotifier({logger:{warn:()=>{}}});
 const result=await notifier.send({send:async()=>{throw Error('Cannot DM')}} ,
  {moderator:'Staff',reason:'spam',guildName:'Duck'});
 assert.equal(result.reason,'dm-closed');
});
