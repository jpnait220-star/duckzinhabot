import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags} from 'discord.js';
import {DuckRockPaperScissors,rockPaperScissorsResult} from '../src/duck-rps.mjs';
import {DuckCommunity} from '../src/duck-community.mjs';

const guildId='111111111111111111',channelId='222222222222222222';
test('pedra, papel e tesoura avalia os nove confrontos',()=>{
 const results=[
  ['empate','derrota','vitoria'],
  ['vitoria','empate','derrota'],
  ['derrota','vitoria','empate']
 ];
 for(let player=0;player<3;player++)
  for(let bot=0;bot<3;bot++)
   assert.equal(rockPaperScissorsResult(player,bot),results[player][bot]);
 assert.throws(()=>rockPaperScissorsResult(5,0));
});
test('botões permitem a cada participante jogar uma vez, com resultado privado',async()=>{
 let now=Date.now(),callback,posted,reply;
 const game=new DuckRockPaperScissors({
  now:()=>now,randomMove:()=>2,
  setTimer:cb=>{callback=cb;return {unref:()=>{}}},
  clearTimer:()=>{}
 });
 const interaction={
  guildId,channelId,user:{id:'333333333333333333'},
  reply:async payload=>{reply=payload},
  fetchReply:async()=>({edit:async x=>{posted=x;}})
 };
 await game.start(interaction);
 assert.match(reply.content,/Pedra, Papel e Tesoura/);
 assert.equal(reply.components[0].components.length,3);
 const id=game.games.get(guildId+':'+channelId).id;
 await game.choose({...interaction,customId:'duckrps:'+id+':0});
 assert.match(reply.content,/Você ganhou/);
 assert.equal(reply.flags,MessageFlags.Ephemeral);
 await game.choose({...interaction,customId:'duckrps:'+id+':1});
 assert.match(reply.content,/já jogou/);
 await game.choose({...interaction,user:{id:'444444444444444444'},
  customId:'duckrps:'+id+':2});
 assert.match(reply.content,/Empate/);
 now+=30000;
 await callback();
 assert.match(posted.content,/1.*vitórias contra a Duckzinha/);
 assert.match(posted.content,/1.*empates/);
 assert.equal(game.games.size,0);
 game.shutdown();
});
test('integração permite /minigame tipo:pedra-papel-tesoura',async()=>{
 const community=new DuckCommunity();
 let payload;
 await community.game({
  guildId,channelId,user:{id:'333333333333333333'},
  options:{getString:()=> 'pedra-papel-tesoura'},
  reply:async content=>{payload=content},
  fetchReply:async()=>({edit:async()=>{}})
 });
 assert.match(payload.content,/Pedra, Papel e Tesoura/);
 assert.equal(community.rps.games.size,1);
 community.shutdown();
});
