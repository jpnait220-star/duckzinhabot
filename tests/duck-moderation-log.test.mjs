import test from 'node:test';
import assert from 'node:assert/strict';
import {ChannelType,PermissionFlagsBits,MessageFlags} from 'discord.js';
import {configureModerationLogs,sendModerationLog,moderationLogEmbed} from '../src/duck-moderation-log.mjs';
import {handleModerationRequest,parseModerationRequest} from '../src/duck-moderation.mjs';

const bot='999999999999999999';
const admin='111111111111111111';
const target='222222222222222222';
const channelId='444444444444444444';
const id='333333333333333333';

function makeData({isAdmin=true,canWrite=true}={}){
 const sent=[],replies=[],changes=[],data={mood:'calma',modLogChannelId:channelId};
 const channel={id:channelId,guildId:id,type:ChannelType.GuildText,
   permissionsFor:()=>({has:()=>canWrite}),
   send:async payload=>{sent.push(payload);return payload}};
 const guild={id,ownerId:'555555555555555555',channels:{
   fetch:async requested=>requested===channelId?channel:null},
   members:{me:{permissions:{has:()=>true}},
     fetchMe:async()=>({permissions:{has:()=>true}})}
 };
 const store={persistent:true,getFeatureSettings:async()=>({...data}),
   setFeatureSettings:async features=>{changes.push({...features});Object.assign(data,features);
     if(!('modLogChannelId' in features))delete data.modLogChannelId;}};
 const interaction={guildId:id,guild,memberPermissions:{has:p=>isAdmin&&p===PermissionFlagsBits.Administrator},
   inGuild:()=>true,user:{id:admin},options:{
     getSubcommand:()=> 'configurar',
     getChannel:()=>channel
   },reply:async payload=>{replies.push(payload);return payload}};
 const message={guild,author:{id:admin,username:'admin'},content:'',
   member:{permissions:{has:p=>isAdmin&&p===PermissionFlagsBits.Administrator}},
   inGuild:()=>true,
   reply:async payload=>{replies.push(payload);return payload}};
 return {guild,store,channel,interaction,message,data,sent,replies,changes};
}

test('canal de modlog é definido só por administradores e mantém preferências',async()=>{
 const x=makeData();
 await configureModerationLogs(x.interaction,{store:x.store});
 assert.equal(x.changes.length,1);
 assert.equal(x.changes[0].mood,'calma');
 assert.equal(x.changes[0].modLogChannelId,channelId);
 assert.match(x.replies[0].content,/Logs ativados/);
 assert.equal(x.replies[0].flags,MessageFlags.Ephemeral);
 const blocked=makeData({isAdmin:false});
 await configureModerationLogs(blocked.interaction,{store:blocked.store});
 assert.equal(blocked.changes.length,0);
 assert.match(blocked.replies[0].content,/Só administradores/);
});

test('registros usam embed com usuário, administrador e duração, sem pings',async()=>{
 const x=makeData();
 const r=await sendModerationLog({message:x.message,store:x.store,action:'timeout',
   target:{id:target,username:'usuario.legal'},reason:'spam',durationMs:600000});
 assert.deepEqual(r,{ok:true,configured:true});
 assert.equal(x.sent.length,1);
 assert.deepEqual(x.sent[0].allowedMentions,{parse:[]});
 const embed=x.sent[0].embeds[0].toJSON();
 assert.match(embed.title,/Castigo aplicado/);
 assert.ok(embed.fields.some(f=>f.value.includes('usuario.legal')));
 assert.ok(embed.fields.some(f=>f.value.includes('admin')));
 assert.ok(embed.fields.some(f=>f.value.includes('10 minuto')));
 assert.ok(embed.fields.some(f=>f.value.includes('spam')));
});

test('sem canal cadastrado, não tenta enviar logs',async()=>{
 const x=makeData();
 delete x.data.modLogChannelId;
 const r=await sendModerationLog({message:x.message,store:x.store,action:'ban',
   target:{id:target,username:'alvo'},reason:'spam'});
 assert.deepEqual(r,{ok:true,configured:false});
 assert.equal(x.sent.length,0);
});

test('comando de moderação responde com humor leve e também gera log',async()=>{
 const x=makeData();
 const member={id:target,user:{id:target,username:'usuario.legal'},
   permissions:{has:()=>false},bannable:true,
   ban:async()=>{}};
 x.guild.members.fetch=async requested=>requested===target?member:null;
 x.message.content='<@'+bot+'> bana <@'+target+'> motivo: spam';
 const action=parseModerationRequest(x.message.content,bot);
 await handleModerationRequest(x.message,action,{botId:bot,store:x.store});
 assert.equal(x.sent.length,1);
 assert.match(x.replies.at(-1).content,/bobão/);
 assert.equal(x.sent[0].embeds[0].data.title,'🔨 Banimento registrado');
});

test('falha no canal não desfaz banimento e avisa o administrador',async()=>{
 const x=makeData({canWrite:false});
 const member={id:target,user:{id:target,username:'usuario.legal'},
   permissions:{has:()=>false},bannable:true,ban:async()=>{}};
 x.guild.members.fetch=async requested=>requested===target?member:null;
 x.message.content='<@'+bot+'> bana <@'+target+'>';
 await handleModerationRequest(x.message,
   parseModerationRequest(x.message.content,bot),{botId:bot,store:x.store});
 assert.equal(x.sent.length,0);
 assert.match(x.replies.at(-1).content,/A ação funcionou/);
});

test('não inclui @everyone em registros de moderação',()=>{
 const embed=moderationLogEmbed({action:'ban',
   target:{id:target,username:'@everyone'},moderator:{id:admin,username:'staff'},
   reason:'regra descumprida'});
 assert.doesNotMatch(JSON.stringify(embed.toJSON()),/@everyone/);
});
