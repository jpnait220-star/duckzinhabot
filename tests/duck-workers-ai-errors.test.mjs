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
  assert.equal(calls[1].messages.at(-1).content,'e o minecraft?');
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
