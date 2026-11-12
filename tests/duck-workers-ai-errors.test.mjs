import test from 'node:test';
import assert from 'node:assert/strict';
import {askCloudflare,workersAIErrorInfo,compactWorkersAIPayload} from '../src/brain.mjs';

const model='@cf/google/gemma-4-26b-a4b-it';
const answer={choices:[{message:{content:'Oie! Entendi sua pergunta 💛'},finish_reason:'stop'}]};

function okResponse(){return {ok:true,status:200,json:async()=>answer};}
function badResponse(status,body){return {ok:false,status,text:async()=>JSON.stringify(body)};}

test('categoriza erros Cloudflare sem mostrar conteúdo privado',()=>{
 const one=workersAIErrorInfo(JSON.stringify({
  errors:[{code:5007,message:'No such model secret-token-private-value'}]
 }),400);
 assert.deepEqual(one,{code:'5007',reason:'modelo-invalido'});
 assert.equal(workersAIErrorInfo(JSON.stringify({
  error:{message:'maximum context length exceeded for this model'}
 }),400).reason,'contexto-grande');
 assert.equal(workersAIErrorInfo(JSON.stringify({
  errors:[{code:3040,message:'Capacity temporarily exceeded'}]
 }),429).reason,'capacidade');
 assert.equal(workersAIErrorInfo('{unparseable',400).reason,'nao-identificado');
});
test('HTTP 400 com campo inválido tenta a mesma IA com payload reduzido',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(_url,opts)=>{
   const sent=JSON.parse(opts.body);calls.push(sent);
   return calls.length===1?badResponse(400,{
    errors:[{code:5004,message:'unsupported chat_template_kwargs'}]
   }):okResponse();
  };
  const result=await askCloudflare({accountId:'acct',token:'very-private-token',
   model,question:'e o minecraft?',history:[{role:'user',content:'Estávamos falando de shader'}],
   customPersonality:'x'.repeat(8000),channelContext:'y'.repeat(4200)});
  assert.match(result,/Entendi sua pergunta/);
  assert.equal(calls.length,2);
  assert.equal(calls[0].model,calls[1].model);
  assert.ok(JSON.stringify(calls[1]).length<JSON.stringify(calls[0]).length);
  assert.equal('chat_template_kwargs' in calls[1],false);
  assert.equal(calls[1].messages.at(-1).content,'Mensagem atual de Membro: e o minecraft?');
  assert.ok(calls[1].messages[0].content.includes('y'.repeat(100)),'reduced request must retain channel conversation');
  assert.ok(calls[1].messages.some(m=>m.content.includes('Estávamos falando')));
 }finally{globalThis.fetch=previous;}
});
test('modelo inválido 400 apresenta código seguro, sem retry e sem vazar segredos',async()=>{
 const prev=globalThis.fetch;let count=0;
 try{
  globalThis.fetch=async()=>{
   count++;
   return badResponse(400,{errors:[{code:5007,
    message:'No such model (secret-token-private-value)'}]});
  };
  await assert.rejects(
   askCloudflare({accountId:'acct',token:'very-private-token',question:'oi',model}),
   err=>err.message.includes('codigo=5007')&&err.message.includes('modelo-invalido')&&
    !err.message.includes('very-private-token')&&!err.message.includes('secret-token-private-value')
  );
  assert.equal(count,1);
 }finally{globalThis.fetch=prev;}
});
test('segunda falha HTTP 400 mostra os dois motivos sem loop',async()=>{
 const prev=globalThis.fetch;let count=0;
 try{
  globalThis.fetch=async()=>{
   count++;
   return badResponse(400,{errors:[{code:5004,message:'unsupported input format'}]});
  };
  await assert.rejects(
   askCloudflare({accountId:'acct',token:'test',question:'oi',model}),
   /tentativa reduzida: Workers AI HTTP 400.*parametro-invalido/
  );
  assert.equal(count,2);
 }finally{globalThis.fetch=prev;}
});

test('uma falha temporária de rede tenta uma vez mantendo contexto, autor e pesquisa',async()=>{
 const prev=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(_url,opts)=>{const sent=JSON.parse(opts.body);calls.push(sent);if(calls.length===1)throw new TypeError('fetch failed');return okResponse();};
 const result=await askCloudflare({accountId:'network-case',token:'test',model,question:'e ele?',speaker:'Duckzin',channelContext:'prime_mat: AINDA BEM',research:'fonte confirmada',profileFacts:'gosta de Minecraft'});
 assert.match(result,/Entendi/);assert.equal(calls.length,2);assert.match(calls[1].messages[0].content,/prime_mat: AINDA BEM/);assert.match(calls[1].messages[0].content,/fonte confirmada/);assert.match(calls[1].messages.at(-1).content,/Mensagem atual de Duckzin: e ele/);
 }finally{globalThis.fetch=prev;}
});
test('503 recebe só uma nova tentativa; erro de autenticação não é repetido',async()=>{
 const prev=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return badResponse(503,{error:{message:'Service unavailable'}});};
 await assert.rejects(askCloudflare({accountId:'server-case',token:'test',model,question:'oi'}),/tentativa reduzida/);assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return badResponse(401,{error:{message:'Unauthorized'}});};
 await assert.rejects(askCloudflare({accountId:'auth-case',token:'test',model,question:'oi'}),/HTTP 401/);assert.equal(calls,1);
 }finally{globalThis.fetch=prev;}
});
