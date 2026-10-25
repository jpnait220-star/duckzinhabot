import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags} from 'discord.js';
import {DuckPublicQuiz,PUBLIC_NEXT_MS} from '../src/duck-public-quiz.mjs';
import {DuckCommunity} from '../src/duck-community.mjs';
import {DuckTicTacToe} from '../src/duck-tictactoe.mjs';
import {newCommands} from '../src/duck-features.mjs';
import {activeGameQuestions} from '../src/duck-game-integrity.mjs';

const guildId='111111111111111111',channelId='222222222222222222',userId='333333333333333333';
test('Quiz Streak aparece como tipo do /minigame e reutiliza o banco de 170 perguntas',async()=>{
 let opts;
 const community=new DuckCommunity({extras:{startGame:async (_interaction,options)=>{opts=options;}}});
 const mock={guildId,channelId,options:{getString:()=> 'quiz-streak'}};
 await community.game(mock);
 assert.deepEqual(opts,{streakMode:true});
 community.shutdown();
 const choices=newCommands().find(x=>x.name==='minigame').options[0].choices;
 assert.ok(choices.some(x=>x.value==='quiz-streak'));
 assert.ok(choices.some(x=>x.value==='jogo-da-velha'));
});
test('comando Jogo da Velha usa engine real com jogo público',async()=>{
 const community=new DuckCommunity();
 let response;
 const request={guildId,channelId,user:{id:userId},
  options:{getString:()=> 'jogo-da-velha'},
  reply:async value=>{response=value;},
  fetchReply:async()=>({edit:async()=>{}})
 };
 await community.game(request);
 assert.match(response.content,/Jogo da Velha/);
 assert.equal(community.ttt.games.size,1);
 community.shutdown();
});
test('Quiz Streak inicia em nível 1, registra acertos e avança automaticamente',async()=>{
 let now=500000,firstReply,nextMessage,confirm;
 const timers=[];
 const quiz=new DuckPublicQuiz({
  now:()=>now,random:()=>0,
  setTimer:(callback,ms)=>{const handle={callback,ms,unref:()=>{}};timers.push(handle);return handle;},
  clearTimer:()=>{}
 });
 const initialMessage={edit:async data=>{firstReply=data;return initialMessage;}};
 const channel={send:async data=>{nextMessage=data;return {edit:async()=>{}};}};
 const interaction={guildId,channelId,channel,user:{id:userId},
  reply:async data=>{firstReply=data;},
  fetchReply:async()=>initialMessage
 };
 assert.equal(await quiz.start(interaction,{streakMode:true}),true);
 assert.match(firstReply.content,/QUIZ STREAK/);
 assert.match(firstReply.content,/Iniciante/);
 assert.match(firstReply.content,/30 segundos/);
 const room=quiz.rooms.get(guildId+':'+channelId);
 assert.equal(room.current.number,1);
 assert.equal(timers[0].ms,30000);
 const round=room.current;
 await quiz.answer({
  customId:'duckpublic:'+round.id+':'+round.question.right,
  user:{id:userId},
  reply:async data=>{confirm=data;}
 });
 assert.equal(confirm.flags,MessageFlags.Ephemeral);
 assert.match(confirm.content,/Resposta registrada/);
 assert.equal(activeGameQuestions({publicQuiz:quiz,guildId,now}).length,1);
 now+=30000;
 await quiz.closeRound(round);
 assert.match(firstReply.content,/Melhor streak da sessão: \*\*1\*\*/);
 assert.equal(quiz.score(userId),1);
 assert.equal(timers[1].ms,PUBLIC_NEXT_MS);
 now+=PUBLIC_NEXT_MS;
 await quiz.advance(room,round,new Set([userId]));
 assert.equal(room.current.number,2);
 assert.match(nextMessage.content,/QUIZ STREAK/);
 assert.match(nextMessage.content,/Sequência em jogo: \*\*1\*\*/);
 assert.notEqual(room.current.question.key,round.question.key);
 assert.equal(activeGameQuestions({publicQuiz:quiz,guildId,now}).length,1);
 quiz.shutdown();
});
test('quando ninguém acerta, streak termina sem emitir nova pergunta',async()=>{
 let now=600000,result;
 const quiz=new DuckPublicQuiz({
  now:()=>now,random:()=>0,
  setTimer:()=>({unref:()=>{}}),clearTimer:()=>{}
 });
 const msg={edit:async data=>{result=data;}};
 const interaction={guildId,channelId,
  channel:{send:async()=>msg},user:{id:userId},
  reply:async()=>{},fetchReply:async()=>msg
 };
 await quiz.start(interaction,{streakMode:true});
 const r=quiz.rooms.get(guildId+':'+channelId).current;
 r.answers.set(userId,(r.question.right+1)%4);
 now+=30000;
 await quiz.closeRound(r);
 assert.match(result.content,/Fim da streak/);
 assert.equal(quiz.rooms.size,0);
 assert.equal(quiz.rounds.size,0);
 quiz.shutdown();
});
