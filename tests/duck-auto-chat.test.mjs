import test from 'node:test';import assert from 'node:assert/strict';
import {DuckAutoChat,silentAutoReply,AUTO_CHAT_INSTRUCTION} from '../src/duck-auto-chat.mjs';
import {askCloudflare} from '../src/brain.mjs';
const msg=(channelId='public',content='Como funciona esse mod?')=>({channelId,content,author:{id:'user',bot:false}});
test('Fala sem menção e sem conversa anterior, somente em canais públicos autorizados',()=>{
 const auto=new DuckAutoChat({now:()=>0});
 assert.equal(auto.canStart(msg(),{allowed:true}),true);
 assert.equal(auto.canStart(msg(),{allowed:false}),false);
 assert.equal(auto.canStart({...msg(),author:{id:'another-bot',bot:true}},{allowed:true}),false);
 assert.equal(new DuckAutoChat({enabled:false}).canStart(msg(),{allowed:true}),false);
 const chosen=new DuckAutoChat({channelIds:['geral']});assert.equal(chosen.canStart(msg('public'),{allowed:true}),false);assert.equal(chosen.canStart(msg('geral'),{allowed:true}),true);
});
test('Participa também de falas normais e saudações sem responder a comandos, risadas e mensagens vazias',()=>{
 const auto=new DuckAutoChat({now:()=>0});
 for(const text of ['Meu Minecraft acabou de fechar','AINDA BEM','oi','bom dia','oq prime_mat falou'])assert.equal(auto.canStart(msg('public',text),{allowed:true}),true,text);
 for(const text of ['', 'kkkkkk','/website','!play musica','gg','👍','ok'])assert.equal(auto.canStart(msg('public',text),{allowed:true}),false,text);
});
test('Limites de canal/global e reserva de resposta impedem várias falas simultâneas',()=>{
 let now=0;const auto=new DuckAutoChat({now:()=>now});const first=auto.reserve(msg(),{allowed:true});assert.ok(first);
 now=6000;assert.equal(auto.canStart(msg(),{allowed:true}),false);assert.equal(auto.canStart(msg('outro'),{allowed:true}),true);
 auto.release(first);now=19000;assert.equal(auto.canStart(msg(),{allowed:true}),false);now=20000;assert.ok(auto.reserve(msg(),{allowed:true}));
 assert.equal(auto.canStart(msg('outro'),{allowed:true}),false);
});
test('Uma reserva antiga não libera uma geração nova; silêncio da IA não vira uma resposta genérica',()=>{
 let now=0;const auto=new DuckAutoChat({now:()=>now});const a=auto.reserve(msg(),{allowed:true});now=61000;const b=auto.reserve(msg(),{allowed:true});assert.ok(b);auto.release(a);assert.equal(auto.canStart(msg(),{allowed:true}),false);auto.release(b);
 assert.equal(silentAutoReply('[SILENCIO]'),true);assert.equal(silentAutoReply('[SILÊNCIO]'),true);assert.equal(silentAutoReply('Uma resposta útil'),false);
});
test('Pedido espontâneo e retry continuam com a conversa e permitem silêncio, sem fazer chamadas reais',async()=>{
 const original=globalThis.fetch,payloads=[];
 try{globalThis.fetch=async(_url,options)=>{payloads.push(JSON.parse(options.body));return payloads.length===1?{ok:false,status:503,text:async()=>'{"error":{"message":"Service unavailable"}}'}:{ok:true,json:async()=>({choices:[{message:{content:'[SILENCIO]'}}]})};};
 const answer=await askCloudflare({accountId:'auto-test',token:'test',model:'@cf/google/gemma-4-26b-a4b-it',question:'AINDA BEM',channelContext:'prime_mat: AINDA BEM',customPersonality:AUTO_CHAT_INSTRUCTION});
 assert.equal(silentAutoReply(answer),true);assert.equal(payloads.length,2);
 for(const p of payloads){assert.match(p.messages[0].content,/PARTICIPAÇÃO ESPONTÂNEA/);assert.match(p.messages[0].content,/\[SILENCIO\]/);assert.match(p.messages[0].content,/prime_mat: AINDA BEM/);}
 }finally{globalThis.fetch=original;}
});
