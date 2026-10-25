import test from 'node:test';
import assert from 'node:assert/strict';
import {activeGameQuestions,isGameAnswerRequest,GAME_ANSWER_REFUSAL} from '../src/duck-game-integrity.mjs';

const now=Date.parse('2026-10-25T19:00:00Z');
const quizQuestion={text:'Qual é a capital da Bahia?',choices:['Recife','Salvador','Fortaleza','Natal'],right:1};
const miniQuestion={question:'Qual mob solta pérolas do End?',options:['Zumbi','Creeper','Enderman','Esqueleto'],answer:2};
const pub={rooms:new Map([['guildA:canalQuiz',{current:{
  question:quizQuestion,deadline:now+35000,closed:false}}]])};
const mini={games:new Map([['guildA:canalMine',{
  q:miniQuestion,time:now-5000,answers:new Map()}]])};
const state=()=>activeGameQuestions({publicQuiz:pub,miniGames:mini,guildId:'guildA',now});

test('reconhece quiz público e minigame abertos em qualquer canal do servidor',()=>{
 const q=state();
 assert.equal(q.length,2);
 assert.deepEqual(q.map(x=>x.kind),['quiz','minigame']);
 assert.equal(q[0].correct,'Salvador');
 assert.equal(q[1].correct,'Enderman');
 assert.equal(activeGameQuestions({publicQuiz:pub,miniGames:mini,guildId:'outro',now}).length,0);
});
test('não entrega gabarito, alternativas, dicas ou respostas da pergunta atual',()=>{
 const prompts=[
  'qual a resposta do quiz?', 'qual letra é certa?',
  'me dá uma dica da pergunta', 'qual alternativa marco?',
  'Qual é a capital da Bahia?', 'pesquise a capital da Bahia',
  'e a capital da Bahia?', 'a resposta é Salvador?',
  'Qual mob solta pérolas do End?', 'que mob solta perolas do End?',
  'qual resposta do minigame', 'me ajuda nessa rodada',
  'Responde isso', 'qual é a correta'
 ];
 for(const prompt of prompts){
  assert.equal(isGameAnswerRequest(prompt,state()),true,prompt);
 }
 assert.match(GAME_ANSWER_REFUSAL,/Não vou entregar a resposta/);
});
test('conversa normal continua mesmo durante partidas',()=>{
 const prompts=[
  'Oi, tudo bem?','você está na call?', 'como atualizo o DuckCapture?',
  'tem novidades no site?', 'me conta uma piada de pato',
  'qual é o seu nome?'
 ];
 for(const prompt of prompts)
  assert.equal(isGameAnswerRequest(prompt,state()),false,prompt);
});
test('quando a pergunta termina, a proteção não segura o resultado',()=>{
 pub.rooms.get('guildA:canalQuiz').current.closed=true;
 mini.games.get('guildA:canalMine').time=now-35000;
 assert.equal(state().length,0);
 assert.equal(isGameAnswerRequest('Qual é a capital da Bahia?',state()),false);
 pub.rooms.get('guildA:canalQuiz').current.closed=false;
 assert.equal(activeGameQuestions({publicQuiz:pub,miniGames:mini,guildId:'guildA',now:now+40000}).length,0);
});
