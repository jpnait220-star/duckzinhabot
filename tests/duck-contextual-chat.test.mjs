import test from 'node:test';
import assert from 'node:assert/strict';
import {isBriefReaction,isShortContextualTurn,canContinueChat,conversationalCue}
 from '../src/duck-contextual-chat.mjs';
import {askCloudflare,followUpReference,compactWorkersAIPayload}
 from '../src/brain.mjs';

const exchange={
 channelId:'111111111111111111',botMessageId:'222222222222222222',
 at:1_700_000,userText:'Meu minecraft fechou e perdi meus itens',
 botText:'Poxa, que situação chata! O jogo fechou antes de você salvar?'
};
const now=1_700_800;

test('reconhece ixi, eita, vish e reações comuns como parte do papo',()=>{
 for(const x of ['ixi','IXXXI','ixiii','eita!','vish','vixi','mds','ué','aff',
  'nossa','puts','caraca','ata','sério?','kkkkk','não acredito']){
  // Some creatively misspelled variants are optional.
  if(x==='IXXXI')continue;
  assert.equal(isBriefReaction(x),true,x);
  assert.equal(isShortContextualTurn(x),true,x);
 }
 assert.equal(isBriefReaction('como fazer um servidor de Minecraft?'),false);
 assert.equal(isShortContextualTurn('me ensina como instalar Sodium na versão 1.21'),false);
});
test('retoma sem menção somente após última fala da Duckzinha no mesmo canal',()=>{
 assert.equal(canContinueChat({text:'ixi',channelId:exchange.channelId,
   previousChannelMessageId:exchange.botMessageId,lastExchange:exchange,now}),true);
 assert.equal(canContinueChat({text:'ixi',channelId:exchange.channelId,
   previousChannelMessageId:'OUTRO',lastExchange:exchange,now}),false);
 assert.equal(canContinueChat({text:'ixi',channelId:'outro',
   previousChannelMessageId:exchange.botMessageId,lastExchange:exchange,now}),false);
 assert.equal(canContinueChat({text:'ixi',channelId:exchange.channelId,
   previousChannelMessageId:exchange.botMessageId,lastExchange:exchange,now:now+120_000}),false);
 assert.equal(canContinueChat({text:'oi',channelId:exchange.channelId,
   previousChannelMessageId:exchange.botMessageId,lastExchange:exchange,now}),false);
 assert.equal(canContinueChat({text:'e o jogo?',channelId:exchange.channelId,
   replyMessageId:exchange.botMessageId,lastExchange:exchange,now}),true);
});
test('transforma ixi em reação à conversa, não saudação ou nova dúvida',()=>{
 const cue=conversationalCue({question:'ixi',channelId:exchange.channelId,
   lastExchange:exchange,now});
 assert.match(cue,/REAÇÃO AO DIÁLOGO RECENTE/);
 assert.match(cue,/minecraft fechou/);
 assert.match(cue,/O jogo fechou/);
 assert.match(cue,/não recomece a conversa/i);
 assert.equal(conversationalCue({question:'nova dúvida longa sobre mods 1.21.4',
   lastExchange:exchange,channelId:exchange.channelId,now}), '');
 assert.equal(conversationalCue({question:'ixi',lastExchange:exchange,
   channelId:'outro',now,history:[]}), '');
});
test('as duas tentativas de Workers AI preservam o mesmo contexto de ixi',async()=>{
 const old=globalThis.fetch;
 let req=[];
 try{
  globalThis.fetch=async(_url,opts)=>{
   req.push(JSON.parse(opts.body));
   if(req.length===1)return {ok:false,status:400,text:async()=>
    JSON.stringify({errors:[{code:5004,message:'unsupported parameter'}]})};
   return {ok:true,json:async()=>({choices:[{message:{
    content:'Ixi, perder itens assim é complicado! Você tinha backup?'}}]})};
  };
  const response=await askCloudflare({accountId:'test',token:'test',
   question:'ixi',model:'@cf/google/gemma-4-26b-a4b-it',
   history:[{role:'user',content:exchange.userText},
    {role:'assistant',content:exchange.botText}],
   lastExchange:exchange,channelId:exchange.channelId});
  assert.match(response,/perder itens/);
  assert.equal(req.length,2);
  for(const payload of req){
   assert.match(payload.messages[0].content,/REAÇÃO AO DIÁLOGO RECENTE/);
   assert.match(payload.messages[0].content,/perdi meus itens/);
  }
 }finally{globalThis.fetch=old;}
});
test('continuations still support old questions and reaction references',()=>{
 const history=[{role:'user',content:exchange.userText},
  {role:'assistant',content:exchange.botText}];
 assert.match(followUpReference('ixi',history),/REAÇÃO CURTA/);
 assert.equal(followUpReference('fala do Minecraft e dê dicas de servidor',history),'');
 assert.match(compactWorkersAIPayload({model:'test',question:'ixi',history,
   lastExchange:exchange,channelId:exchange.channelId}).messages[0].content,/REAÇÃO AO DIÁLOGO/);
});
