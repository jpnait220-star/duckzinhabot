import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags} from 'discord.js';
import {replayRow} from '../src/duck-replay.mjs';
import {DuckCommunity} from '../src/duck-community.mjs';

const guildId='111111111111111111',channelId='222222222222222222';
const alice='333333333333333333',bob='444444444444444444';

function button(customId,userId=alice){
 let result,edits=[];
 const message={edit:async payload=>{edits.push(payload);return message}};
 const request={
  customId,guildId,channelId,user:{id:userId},guild:{
   members:{fetch:async id=>({id,user:{id,bot:false}})}
  },
  reply:async payload=>{result=payload;},
  fetchReply:async()=>message
 };
 return {request,edits,get result(){return result}};
}

test('Botões de replay são IDs específicos sem armazenar resposta ou segredos',()=>{
 assert.equal(replayRow('mini',{ownerId:'aleatorio'}).components[0].data.custom_id,'duckagain:mini:aleatorio');
 assert.equal(replayRow('rps').components[0].data.custom_id,'duckagain:rps');
 assert.equal(replayRow('ttt',{ownerId:alice}).components[0].data.custom_id,'duckagain:ttt:'+alice);
 assert.equal(replayRow('coin',{ownerId:alice,opponentId:bob}).components[0].data.custom_id,'duckagain:coin:'+alice+':'+bob);
 assert.equal(replayRow('quiz').components[0].data.label,'Jogar novamente');
 assert.throws(()=>replayRow('mini',{ownerId:'quiz:evil'}));
});

test('Rejogar minigame comum abre outra pergunta com botões novos',async()=>{
 const community=new DuckCommunity();
 const mock=button('duckagain:mini:verdadeiro-ou-falso');
 await community.replay(mock.request);
 assert.match(mock.result.content,/Verdadeiro ou falso/);
 assert.equal(mock.result.components[0].components.length,2);
 assert.equal(community.games.size,1);
 community.shutdown();
});

test('Rejogar pedra/papel/tesoura cria rodada sem slash command',async()=>{
 const community=new DuckCommunity();
 const mock=button('duckagain:rps');
 await community.replay(mock.request);
 assert.match(mock.result.content,/Pedra, Papel e Tesoura/);
 assert.equal(community.rps.games.size,1);
 community.shutdown();
});

test('Somente dono do jogo da velha consegue usar sua revanche',async()=>{
 const community=new DuckCommunity();
 const invalid=button('duckagain:ttt:'+alice,bob);
 await community.replay(invalid.request);
 assert.equal(invalid.result.flags,MessageFlags.Ephemeral);
 assert.equal(community.ttt.games.size,0);
 const valid=button('duckagain:ttt:'+alice);
 await community.replay(valid.request);
 assert.match(valid.result.content,/Jogo da Velha/);
 assert.equal(community.ttt.games.size,1);
 community.shutdown();
});

test('Rejogar quiz e campeonato mantém o modo escolhido',async()=>{
 const modes=[];
 const community=new DuckCommunity({extras:{startGame:async (_interaction,opts)=>{modes.push(opts||{});}}});
 await community.replay(button('duckagain:quiz').request);
 await community.replay(button('duckagain:championship').request);
 assert.deepEqual(modes,[{},{championship:true}]);
 community.shutdown();
});

test('Somente quem desafiou pode repetir o Coinflip com o mesmo oponente',async()=>{
 const community=new DuckCommunity({store:{persistent:true}});
 const blocked=button('duckagain:coin:'+alice+':'+bob,bob);
 await community.replay(blocked.request);
 assert.equal(blocked.result.flags,MessageFlags.Ephemeral);
 assert.equal(community.coin.games.size,0);
 const valid=button('duckagain:coin:'+alice+':'+bob,alice);
 await community.replay(valid.request);
 assert.match(valid.result.content,/Cara ou Coroa/);
 assert.equal(community.coin.games.size,1);
 community.shutdown();
});
