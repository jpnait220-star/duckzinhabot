import test from 'node:test';
import assert from 'node:assert/strict';
import {awardMinigameWin,MINIGAME_REWARD,winRewardLabel} from '../src/duck-minigame-rewards.mjs';
import {DuckCommunity} from '../src/duck-community.mjs';
import {DuckRockPaperScissors} from '../src/duck-rps.mjs';
import {DuckTicTacToe} from '../src/duck-tictactoe.mjs';
import {DuckPublicQuiz} from '../src/duck-public-quiz.mjs';

const guildId='111111111111111111',channelId='222222222222222222';
const userId='333333333333333333',loserId='444444444444444444';
function rewardingStore(){
 const calls=[],unique=new Set();
 const store={persistent:true,
  async rewardMinigame(user,key){
   calls.push({user,key});
   const composite=user+':'+key;
   const credited=!unique.has(composite);
   unique.add(composite);
   return {ok:true,credited,balance:credited?105:105};
  }
 };
 return {store,calls};
}
test('recompensa é de 5 moedas e permite confirmar pagamento duplicado apenas uma vez',async()=>{
 const {store,calls}=rewardingStore();
 assert.equal(MINIGAME_REWARD,5);
 assert.match(winRewardLabel,/\+5/);
 const first=await awardMinigameWin(store,userId,'mini:abcd1234abcd');
 const second=await awardMinigameWin(store,userId,'mini:abcd1234abcd');
 assert.equal(first.credited,true);
 assert.equal(second.credited,false);
 assert.equal(calls.length,2);
 assert.equal((await awardMinigameWin({},userId,'mini:abcd1234abcd')).credited,false);
});
test('pedra papel tesoura premia apenas vitória, jamais derrota ou empate',async()=>{
 const {store,calls}=rewardingStore();
 const game=new DuckRockPaperScissors({store,randomMove:()=>2,
  setTimer:()=>({unref:()=>{}}),clearTimer:()=>{}});
 let reply,edited;
 const message={edit:async()=>{}};
 const call={
  guildId,channelId,user:{id:userId},
  reply:async value=>{reply=value},
  editReply:async value=>{edited=value},
  fetchReply:async()=>message
 };
 await game.start(call);
 const key=game.games.get(guildId+':'+channelId).id;
 await game.choose({...call,customId:'duckrps:'+key+':0'});
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{user:userId,key:'rps:'+key});
 assert.match(edited.content,/\+5 moedas/);
 await game.choose({...call,user:{id:loserId},customId:'duckrps:'+key+':1'});
 assert.equal(calls.length,1,'perder não deve render pontos');
 await game.choose({...call,user:{id:'555555555555555555'},customId:'duckrps:'+key+':2'});
 assert.equal(calls.length,1,'empatar não deve render pontos');
 game.shutdown();
});
test('vitória no Jogo da Velha premia o jogador uma única vez',async()=>{
 const {store,calls}=rewardingStore();
 const game=new DuckTicTacToe({store,setTimer:()=>({unref:()=>{}}),clearTimer:()=>{}});
 let reply,update,edited;
 const call={
  guildId,channelId,user:{id:userId},
  reply:async value=>{reply=value},
  fetchReply:async()=>({edit:async()=>{}}),
  update:async value=>{update=value},
  editReply:async value=>{edited=value}
 };
 await game.start(call);
 const session=game.games.get(guildId+':'+channelId);
 session.board=['X','X','','O','O','','','',''];
 await game.choose({...call,customId:'duckttt:'+session.id+':2'});
 assert.match(update.content,/Você venceu/);
 assert.match(edited.content,/\+5 moedas/);
 assert.deepEqual(calls,[{user:userId,key:'ttt:'+session.id}]);
 await game.choose({...call,customId:'duckttt:'+session.id+':6'});
 assert.equal(calls.length,1);
 game.shutdown();
});
test('minigame de pergunta premia somente quem acertou, após 30 segundos',async()=>{
 const {store,calls}=rewardingStore();
 let callback,result;
 const community=new DuckCommunity({store,
  setTimer:cb=>{callback=cb;return {unref:()=>{}}}
 });
 const call={
  guildId,channelId,user:{id:userId},
  options:{getString:()=> 'anime'},
  reply:async()=>{},
  fetchReply:async()=>({edit:async value=>{result=value}})
 };
 await community.game(call);
 const session=community.games.get(guildId+':'+channelId);
 session.answers.set(userId,session.q.answer);
 session.answers.set(loserId,(session.q.answer+1)%4);
 await callback();
 assert.deepEqual(calls,[{user:userId,key:'mini:'+session.id}]);
 assert.match(result.content,/\+5 moedas/);
 assert.equal(community.games.size,0);
 community.shutdown();
});
test('Quiz Streak dá 5 moedas por rodada vencida, não pela resposta errada',async()=>{
 const {store,calls}=rewardingStore();
 let now=400000,result;
 const quiz=new DuckPublicQuiz({store,now:()=>now,random:()=>0,
  setTimer:()=>({unref:()=>{}}),clearTimer:()=>{}});
 const message={edit:async data=>{result=data;return message}};
 await quiz.start({
  guildId,channelId,user:{id:userId},
  channel:{send:async()=>message},
  reply:async()=>{},fetchReply:async()=>message
 },{streakMode:true});
 const round=quiz.rooms.get(guildId+':'+channelId).current;
 round.answers.set(userId,round.question.right);
 round.answers.set(loserId,(round.question.right+1)%4);
 now+=30000;
 await quiz.closeRound(round);
 assert.deepEqual(calls,[{user:userId,key:'quiz:'+round.id}]);
 assert.match(result.content,/\+5 moedas/);
 await quiz.closeRound(round);
 assert.equal(calls.length,1);
 quiz.shutdown();
});
