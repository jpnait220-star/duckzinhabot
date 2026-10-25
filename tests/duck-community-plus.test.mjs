import test from 'node:test';
import assert from 'node:assert/strict';
import {ChannelType,PermissionFlagsBits} from 'discord.js';
import {newCommands} from '../src/duck-features.mjs';
import {parseBahiaDate,suggestionButtons,eventButtons,DuckCommunityPlus} from '../src/duck-community-plus.mjs';
import {dynamicPersonality,voiceTone,parseNaturalReminder,parseTimeSpan,summarizePublicMessages} from '../src/duck-smart.mjs';
import {SAFE_GAMES} from '../src/duck-community.mjs';

test('sete ideias aparecem em comandos ou recursos reais',()=>{
 const commands=newCommands();
 for(const n of ['lembrete','resumo','sugerir','sugestao','evento','minigame'])
  assert.ok(commands.some(x=>x.name===n),n);
 assert.deepEqual(commands.find(x=>x.name==='lembrete').options.map(x=>x.name),
  ['criar','listar','cancelar']);
 assert.deepEqual(commands.find(x=>x.name==='evento').options.map(x=>x.name),
  ['criar','listar','cancelar']);
 const moderation=commands.find(x=>x.name==='sugestao');
 assert.equal(moderation.default_member_permissions,String(PermissionFlagsBits.Administrator));
 assert.ok(SAFE_GAMES.some(x=>x.name==='anime'));
 assert.ok(SAFE_GAMES.some(x=>x.name==='emoji'));
 assert.ok(SAFE_GAMES.some(x=>x.name==='logica'));
});
test('adapta tom à conversa sem incentivar provocações em problemas',()=>{
 assert.match(dynamicPersonality('estou com um erro no servidor'),/sem piadas/);
 assert.match(dynamicPersonality('kkkk muito bom'),/BRINCALHÃO/);
 assert.equal(voiceTone('GG GANHEI!!!'),'animada');
 assert.equal(voiceTone('Estou triste e preciso de ajuda'),'calma');
 assert.equal(voiceTone('Será que funciona?'),'curiosa');
});
test('lembrete natural aceita horários relativos e amanhã na Bahia',()=>{
 const now=Date.parse('2026-10-25T12:00:00-03:00');
 assert.equal(parseTimeSpan('10m'),600000);
 assert.equal(parseTimeSpan('2h'),7200000);
 assert.equal(parseTimeSpan('31d'),null);
 assert.equal(parseNaturalReminder('me lembra de estudar em 15 minutos',now).at,
  new Date(now+15*60000).toISOString());
 assert.equal(parseNaturalReminder('me lembra de estudar amanhã às 15h',now).at,
  '2026-10-26T18:00:00.000Z');
 assert.equal(parseBahiaDate('2026-10-26 16:30',now),'2026-10-26T19:30:00.000Z');
 assert.equal(parseBahiaDate('2026-02-30 11:00',now),null);
 assert.equal(parseBahiaDate('2026-10-24 11:00',now),null);
});
test('resumo calcula temas de mensagens públicas, sem reproduzir segredos',()=>{
 const now=Date.parse('2026-10-25T15:00:00Z');
 const messages=[
  {author:{id:'a'},content:'Minecraft com shader',createdTimestamp:now-15000},
  {author:{id:'b'},content:'Minecraft mod',createdTimestamp:now-16000},
  {author:{id:'c'},content:'Qual o servidor de Minecraft?',createdTimestamp:now-17000},
  {author:{id:'d'},content:'senha: segredo',createdTimestamp:now-18000}
 ];
 const result=summarizePublicMessages(messages,{now});
 assert.match(result,/3.*mensagens/);
 assert.match(result,/Minecraft/);
 assert.doesNotMatch(result,/senha|segredo/);
});
test('resumo recusa canais privados e consulta somente canal público',async()=>{
 let content='';
 const plus=new DuckCommunityPlus({});
 const base={
  guild:{roles:{everyone:{id:'everyone'}}},type:ChannelType.GuildText,
  nsfw:false,name:'chat-geral',
  permissionsFor:()=>({has:()=>true}),
  messages:{fetch:async()=>new Map([
   ['1',{author:{id:'a'},content:'jogo Minecraft',createdTimestamp:Date.now()}],
   ['2',{author:{id:'b'},content:'jogo Minecraft',createdTimestamp:Date.now()}],
   ['3',{author:{id:'c'},content:'jogo Minecraft',createdTimestamp:Date.now()}]
  ])}
 };
 const interaction={channel:base,deferReply:async()=>{},editReply:async x=>{content=x.content},
  reply:async x=>{content=x.content}};
 await plus.summary(interaction);
 assert.match(content,/Minecraft/);
 await plus.summary({...interaction,channel:{...base,name:'ticket-ajuda'}});
 assert.match(content,/canal público/);
});
test('botões de sugestões e eventos têm identificadores persistentes e exclusivos',()=>{
 assert.equal(suggestionButtons(44)[0].components[0].data.custom_id,'duckidea:vote:44');
 assert.equal(eventButtons(91)[0].components[0].data.custom_id,'duckevent:join:91');
 assert.equal(eventButtons(91)[0].components[1].data.custom_id,'duckevent:leave:91');
});
