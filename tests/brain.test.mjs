import test from 'node:test';
import assert from 'node:assert/strict';
import {pickName,stripMentions,safeResponse,cannedAnswer,PERSONALITY} from '../src/brain.mjs';
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
