import test from 'node:test';
import assert from 'node:assert/strict';
import {pickName,stripMentions,safeResponse,cannedAnswer,PERSONALITY,formatChannelContext} from '../src/brain.mjs';
test('Lê apresentação simples e não confunde equipe com nome',()=>{
 assert.equal(pickName('Oi, me chamo Duckzin!'),'Duckzin');
 assert.equal(pickName('Sou a Maria'),'Maria');
 assert.equal(pickName('eu sou o admin'),null);
});
test('Remove menções de entrada e referências perigosas na resposta',()=>{
 assert.equal(stripMentions('<@12345678912345678> Oi @everyone <#12345678912345678>'),'Oi');
 assert.match(safeResponse('oi @everyone <@12345678912345678>'),/@\u200beveryone/);
 assert.match(safeResponse('site https://bad.example/path'),/\[link removido\]/);
});
test('Modo básico informa sobre IA e tickets',()=>{
 assert.match(cannedAnswer('você é IA?'),/assistente virtual/);
 assert.match(cannedAnswer('meu mod está com bug'),/ticket/);
 assert.match(PERSONALITY,/bot|IA/);
});

test('Contexto coletivo acompanha as falas de pessoas diferentes, em ordem',()=>{
 const now=Date.now();
 const mk=(name,id,content,offset)=>({
   author:{id,username:name,bot:false},
   member:{displayName:name},
   content,createdTimestamp:now+offset,
   mentions:{users:new Map()}
 });
 const input=[
   mk('Duck','2','@Duckzinha eu não!',-1000),
   mk('João','1','@Duckzinha o Duck é doidinho KKK',-3000),
   mk('Pessoa','3','mensagem muito antiga',-40*60*1000),
 ];
 const context=formatChannelContext(input,'bot',now);
 assert.match(context,/João: @Duckzinha o Duck é doidinho KKK/);
 assert.match(context,/Duck: @Duckzinha eu não!/);
 assert.ok(context.indexOf('João:')<context.indexOf('Duck:'));
 assert.doesNotMatch(context,/mensagem muito antiga/);
});
