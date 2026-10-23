import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedAction,musicBotMessage,ttsBotMessage} from '../src/action-router.mjs';
import {publicInfoPayload} from '../src/commands.mjs';

test('Perguntas sobre site e projetos correspondem aos comandos públicos',()=>{
  for(const text of ['qual site do duckzin','qual é o site do DuckzinCommunity?',
    'manda o site','website','qual o link do site']){
    assert.equal(requestedAction(text)?.kind,'website',text);
  }
  for(const text of ['quais projetos','quais são os projetos?','me mostra os projetos',
    'quais os mods','projetos']){
    assert.equal(requestedAction(text)?.kind,'projetos',text);
  }
  const site='https://example.net';
  assert.match(publicInfoPayload('website',{site}).embeds[0].data.description,/example.net/);
  assert.match(publicInfoPayload('projetos',{site}).embeds[0].data.description,/DuckModels/);
});

test('Títulos de música recebem m!p de forma controlada',()=>{
  const examples=[
    ['coloque a musica Blinding Lights na call','blinding lights'],
    ['coloca a música Faded na call','faded'],
    ['coloca musica na call Faded','faded'],
    ['toca believer','believer']
  ];
  for(const [text,title] of examples){
    const action=requestedAction(text);
    assert.deepEqual(action,{kind:'music',song:title});
    assert.equal(musicBotMessage(action.song),'m!p '+title);
  }
  assert.deepEqual(requestedAction('coloque a musica na call'),{kind:'music',song:''});
  assert.equal(musicBotMessage('a\n-join'),null);
  assert.equal(musicBotMessage('oi @everyone'),null);
  assert.equal(requestedAction('toca https://example.org'),null);
});

test('TTS só encaminha -join quando for solicitado',()=>{
  for(const text of ['entra na call do tts','ativa o tts',
    'coloca o tts na call','faz -join do tts','manda -join no chat da call']){
    assert.deepEqual(requestedAction(text),{kind:'tts'},text);
  }
  assert.equal(ttsBotMessage(),'-join');
  assert.equal(requestedAction('oi'),null);
  assert.equal(requestedAction('como funciona o tts?'),null);
});

test('Mensagens banais não ativam automaticamente ações',()=>{
  for(const text of ['olá galera','tô ouvindo música','música muito boa',
    'tenho um projeto','o tts não funciona?','qual seu jogo favorito?']){
    assert.equal(requestedAction(text),null,text);
  }
});
