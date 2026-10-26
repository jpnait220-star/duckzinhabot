import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags} from 'discord.js';
import {DuckPublicQuiz,PUBLIC_ROUND_MS} from '../src/duck-public-quiz.mjs';
import {DuckCommunity} from '../src/duck-community.mjs';
import {newCommands} from '../src/duck-features.mjs';
import {activeGameQuestions} from '../src/duck-game-integrity.mjs';

const guildId='111111111111111111';
const channelId='222222222222222222';
const userId='333333333333333333';

test('Quiz Streak foi removido do menu e não pode ser iniciado',async()=>{
 const choices=newCommands().find(x=>x.name==='minigame').options[0].choices;
 assert.equal(choices.some(x=>x.value==='quiz-streak'),false);
 assert.ok(choices.some(x=>x.value==='jogo-da-velha'));
 let notice;
 const community=new DuckCommunity();
 await community.game({guildId,channelId,
   options:{getString:()=> 'quiz-streak'},reply:async value=>{notice=value;}});
 assert.match(notice.content,/não está disponível/);
 community.shutdown();
});

test('quiz público não exibe streak, mantém perguntas e oferece Jogar novamente no final',async()=>{
 let now=500000,initial,answer,updated;
 const msg={edit:async data=>{updated=data;return msg;}};
 const quiz=new DuckPublicQuiz({now:()=>now,random:()=>0,maxRounds:1,
   setTimer:()=>({unref:()=>{}}),clearTimer:()=>{}});
 const interaction={guildId,channelId,channel:{send:async()=>msg},
   reply:async data=>{initial=data;},
   fetchReply:async()=>msg};
 assert.equal(await quiz.start(interaction),true);
 assert.match(initial.content,/QUIZ DA GALERA/);
 assert.match(initial.content,/Iniciante/);
 assert.match(initial.content,new RegExp(String(Math.ceil(PUBLIC_ROUND_MS/1000))+' segundos'));
 assert.doesNotMatch(initial.content,/streak|sequência em jogo/i);
 const round=quiz.rooms.get(guildId+':'+channelId).current;
 await quiz.answer({
   customId:'duckpublic:'+round.id+':'+round.question.right,
   user:{id:userId},reply:async value=>{answer=value;}
 });
 assert.equal(answer.flags,MessageFlags.Ephemeral);
 assert.equal(activeGameQuestions({publicQuiz:quiz,guildId,now}).length,1);
 now+=PUBLIC_ROUND_MS;
 await quiz.closeRound(round);
 assert.match(updated.content,/Partida concluída/);
 assert.doesNotMatch(updated.content,/streak/i);
 assert.equal(updated.components[0].components[0].data.custom_id,'duckagain:quiz');
 assert.equal(quiz.rooms.size,0);
 quiz.shutdown();
});

test('quiz sem acertos encerra com botão para tentar novamente',async()=>{
 let now=600000,updated;
 const msg={edit:async data=>{updated=data;return msg;}};
 const quiz=new DuckPublicQuiz({now:()=>now,random:()=>0,
   setTimer:()=>({unref:()=>{}}),clearTimer:()=>{}});
 await quiz.start({guildId,channelId,channel:{send:async()=>msg},
   reply:async()=>{},fetchReply:async()=>msg});
 const round=quiz.rooms.get(guildId+':'+channelId).current;
 round.answers.set(userId,(round.question.right+1)%round.question.choices.length);
 now+=PUBLIC_ROUND_MS;
 await quiz.closeRound(round);
 assert.match(updated.content,/Fim da partida/);
 assert.equal(updated.components[0].components[0].data.label,'Jogar novamente');
 assert.equal(quiz.rooms.size,0);
 assert.equal(quiz.rounds.size,0);
 quiz.shutdown();
});
