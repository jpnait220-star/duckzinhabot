import test from 'node:test';
import assert from 'node:assert/strict';
import {QUIZ_BANK,chooseQuestion} from '../src/duck-quiz.mjs';
import {SAFE_GAMES,DuckCommunity} from '../src/duck-community.mjs';
import {newCommands} from '../src/duck-features.mjs';

const CATEGORIES=[
 'verdadeiro-ou-falso','adivinhe-o-mob','matematica','desafio-mine',
 'geografia','anime','emoji','logica'
];
test('quiz tem 170 perguntas em cinco níveis com respostas válidas',()=>{
 assert.equal(QUIZ_BANK.length,5);
 assert.equal(QUIZ_BANK.reduce((count,tier)=>count+tier.length,0),170);
 for(const tier of QUIZ_BANK){
  assert.equal(tier.length,34);
  const seen=new Set();
  for(const question of tier){
   assert.equal(question.choices.length,4);
   assert.ok(Number.isInteger(question.right)&&question.right>=0&&question.right<4);
   assert.equal(new Set(question.choices).size,4,question.text);
   assert.ok(!seen.has(question.text),question.text);
   seen.add(question.text);
  }
 }
});
test('quiz não repete questões de um nível antes de esgotar 34',()=>{
 const used=[],keys=new Set();
 for(let n=0;n<34;n++){
  const q=chooseQuestion(1,used,()=>0);
  assert.ok(!keys.has(q.key),q.key);
  keys.add(q.key);used.push(q.key);
 }
 assert.equal(keys.size,34);
});
test('minigames somam 128 perguntas com 16 por categoria',()=>{
 assert.equal(SAFE_GAMES.length,128);
 for(const category of CATEGORIES){
  const questions=SAFE_GAMES.filter(q=>q.name===category);
  assert.equal(questions.length,16,category);
  const seen=new Set();
  for(const q of questions){
   assert.ok(q.label&&q.question);
   assert.equal(q.options.length,category==='verdadeiro-ou-falso'?2:4);
   assert.equal(new Set(q.options).size,q.options.length);
   assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length);
   assert.ok(!seen.has(q.question),'Pergunta repetida em '+category+': '+q.question);
   seen.add(q.question);
  }
 }
});
test('seleção alterna pelo menos 12 perguntas de minigame antes de repetir',async()=>{
 const community=new DuckCommunity();
 const questions=[];
 const mock={
  guildId:'123456789012345678',channelId:'234567890123456789',
  options:{getString:()=> 'anime'},
  reply:async payload=>{if(payload?.content)questions.push(payload.content);},
  fetchReply:async()=>({edit:async()=>{}})
 };
 for(let n=0;n<12;n++){
  await community.game(mock);
  community.games.clear();
 }
 assert.equal(new Set(questions).size,12);
 assert.equal(community.recentMinigames.get(mock.guildId+':'+mock.channelId).length,12);
 community.shutdown();
});
test('comando /minigame oferece os oito tipos e aleatório',()=>{
 const options=newCommands().find(x=>x.name==='minigame').options[0].choices;
 assert.deepEqual(options.map(x=>x.value),['aleatorio',...CATEGORIES]);
});
