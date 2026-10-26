import test from 'node:test';
import assert from 'node:assert/strict';
import {pickSelfName,isSelfIdentityQuestion,findSelfNameInHistory,identityAnswer}
 from '../src/duck-self-identity.mjs';
import {pickName,askCloudflare} from '../src/brain.mjs';
import {DuckChatHistory} from '../src/duck-chat-history.mjs';

test('Duckzinha reconhece apresentação natural: sou o Duck, eu sou Duck e me chamo Duck',()=>{
 for(const line of ['eu sou o Duck','sou o Duck','eu sou Duck',
  'Eu sou o duck!','Oi, eu sou o Duck','eu me chamo Duck',
  'pode me chamar de Duck','Meu nick é Duck','meu nome é Duck']){
  assert.equal(pickSelfName(line)?.toLowerCase(),'duck',line);
  assert.equal(pickName(line)?.toLowerCase(),'duck',line);
 }
 assert.equal(pickSelfName('eu sou o admin'),null);
 assert.equal(pickSelfName('eu não sou o Duck'),null);
 assert.equal(pickSelfName('ele é o Duck'),null);
});

test('entende quem eu sou e variações que antes não eram reconhecidas',()=>{
 for(const text of ['quem eu sou?', 'quem sou eu?',
  'Duckzinha, você sabe quem eu sou?', 'vc lembra quem eu sou?',
  'qual meu nome?', 'qual é o meu nome?', 'qual meu apelido?',
  'tu lembra de mim?', 'quem eu era mesmo?']){
  assert.equal(isSelfIdentityQuestion(text),true,text);
 }
 for(const text of ['quem é o Duck?','sou o Duck','qual é o nome do servidor?'])
  assert.equal(isSelfIdentityQuestion(text),false,text);
});

test('nome informado por membro prevalece sobre nick do Discord, sem usar afirmação de outros',()=>{
 const history=[
  {role:'user',content:'Oi, eu sou o Duck'},
  {role:'assistant',content:'Olá, Duck!'},
  {role:'user',content:'E meu mod?'},
 ];
 assert.equal(findSelfNameInHistory(history),'Duck');
 assert.equal(identityAnswer(findSelfNameInHistory(history)),'Você me contou que é o **Duck**! 💛');
 assert.doesNotMatch(identityAnswer(findSelfNameInHistory(history)),/mewtwo|Discord/);
 assert.equal(findSelfNameInHistory([{role:'assistant',content:'Duck é seu nome!'}]),null);
 assert.match(identityAnswer(null),/Ainda não encontrei/);
});

test('identidade permanece após cinco minutos e após reiniciar, sem novo dado pessoal',async()=>{
 const backing=new Map();
 let now=1_750_000_000_000;
 const config={
  now:()=>now,load:async id=>backing.get(id)||[],
  save:async(id,items)=>{backing.set(id,structuredClone(items));}
 };
 const id='234567890123456789';
 const memory=new DuckChatHistory(config);
 await memory.append(id,'eu sou o Duck','Entendi, Duck.');
 now+=5*60_000;
 assert.equal(findSelfNameInHistory(await memory.get(id)),'Duck');
 const reloaded=new DuckChatHistory(config);
 assert.equal(findSelfNameInHistory(await reloaded.get(id)),'Duck');
});

test('modelo recebe nome declarado, sem substituir por apelido do Discord',async()=>{
 const oldFetch=globalThis.fetch;
 let payload;
 try{
  globalThis.fetch=async(_url,opts)=>{
   payload=JSON.parse(opts.body);
   return {ok:true,json:async()=>({choices:[{message:{content:'Você me disse que é Duck!'}}]})};
  };
  const history=[{role:'user',content:'eu sou o Duck'},
   {role:'assistant',content:'Entendi, Duck.'}];
  const response=await askCloudflare({
   accountId:'test',token:'test',model:'@cf/google/gemma-4-26b-a4b-it',
   question:'quem eu sou?',name:findSelfNameInHistory(history),history,
   speaker:'nome discord diferente'
  });
  assert.match(response,/Duck/);
  assert.match(payload.messages[0].content,/Nome que ESTA pessoa informou/);
  assert.match(payload.messages[0].content,/Duck/);
 }finally{globalThis.fetch=oldFetch;}
});
