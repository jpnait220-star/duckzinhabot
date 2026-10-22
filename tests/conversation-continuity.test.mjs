import test from 'node:test';
import assert from 'node:assert/strict';
import {followUpReference,askCloudflare} from '../src/brain.mjs';

const history=[
  {role:'user',content:'O que é Cyberpunk?'},
  {role:'assistant',content:'Cyberpunk é um gênero de ficção científica; também existe Cyberpunk 2077.'}
];

test('e o jogo retoma a pergunta anterior sem repetir Cyberpunk',()=>{
  const note=followUpReference('e o jogo?',history);
  assert.match(note,/O que é Cyberpunk/);
  assert.match(note,/Cyberpunk 2077/);
  assert.equal(followUpReference('e a história?',history).length>0,true);
});
test('nova pergunta específica não herda assunto automaticamente',()=>{
  assert.equal(followUpReference('Quem é Neymar Jr?',history),'');
  assert.equal(followUpReference('e o jogo?',[]),'');
});
test('a IA recebe histórico pessoal mesmo quando existe conversa coletiva',async()=>{
  const previous=globalThis.fetch;
  let payload;
  try{
    globalThis.fetch=async(_url,options)=>{
      payload=JSON.parse(options.body);
      return {ok:true,json:async()=>({choices:[{message:{content:'O jogo é Cyberpunk 2077.'},finish_reason:'stop'}]})};
    };
    const answer=await askCloudflare({
      accountId:'test',token:'test',question:'e o jogo?',history,
      channelContext:'Joana: conversa diferente sobre servidores',
      speaker:'João',model:'@cf/google/gemma-4-26b-a4b-it'
    });
    assert.match(answer,/Cyberpunk 2077/);
    assert.ok(payload.messages.some(m=>m.role==='user'&&m.content==='O que é Cyberpunk?'));
    assert.ok(payload.messages.some(m=>m.role==='assistant'&&m.content.includes('Cyberpunk é')));
    assert.ok(payload.messages[0].content.includes('CONTINUIDADE DA CONVERSA'));
    assert.ok(payload.messages[0].content.includes('conversa diferente'));
    assert.match(payload.messages.at(-1).content,/Mensagem atual de João: e o jogo\?/);
    assert.match(payload.messages.at(-1).content,/continuação da pergunta.*O que é Cyberpunk\?/i);
  }finally{
    globalThis.fetch=previous;
  }
});
