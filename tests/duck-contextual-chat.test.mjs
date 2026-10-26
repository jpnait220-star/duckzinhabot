import test from 'node:test';
import assert from 'node:assert/strict';
import {isBriefReaction,isShortContextualTurn,canContinueChat,conversationalCue,reactionFallback}
 from '../src/duck-contextual-chat.mjs';
import {askCloudflare,followUpReference,compactWorkersAIPayload}
 from '../src/brain.mjs';

const exchange={
 channelId:'111111111111111111',botMessageId:'222222222222222222',
 at:1_700_000,userText:'Meu Minecraft fechou e perdi meus itens',
 botText:'Poxa, que situação chata! O jogo fechou antes de você salvar?'
};
const now=1_700_800;

test('contexto funciona com palavras aleatórias e gírias não cadastradas',()=>{
 for(const text of ['ixi','oxe','talokoooo','rapazzzz','slk q doidera',
  'ué mano','mds','n acredito nisso','kkkkkkk', 'õxe da mulesta',
  'essa foi de lascar', '???', 'hmmmm', 'num creiooo', 'pff']){
  assert.equal(isShortContextualTurn(text),true,text);
  const cue=conversationalCue({question:text,lastExchange:exchange,
    channelId:exchange.channelId,now});
  assert.match(cue,/CONTEXTO CONVERSACIONAL/,text);
  assert.match(cue,/Meu Minecraft fechou/,text);
  assert.match(cue,/O jogo fechou/,text);
  assert.match(cue,/gírias desconhecidas/,text);
 }
 assert.equal(isShortContextualTurn('x'.repeat(170)),false);
 assert.equal(isShortContextualTurn('  '),false);
 assert.equal(isBriefReaction('ixi'),true);
});
test('continua sem mencionar apenas após resposta da bot no mesmo canal e pessoa',()=>{
 for(const text of ['ixi','slk q doidera','essa foi de lascar','que tu acha?', 'como assim mano']){
  assert.equal(canContinueChat({text,channelId:exchange.channelId,
   previousChannelMessageId:exchange.botMessageId,lastExchange:exchange,now}),true,text);
 }
 assert.equal(canContinueChat({text:'ixi',channelId:exchange.channelId,
   previousChannelMessageId:'OUTRA_MENSAGEM',lastExchange:exchange,now}),false);
 assert.equal(canContinueChat({text:'ixi',channelId:'outro',
   previousChannelMessageId:exchange.botMessageId,lastExchange:exchange,now}),false);
 assert.equal(canContinueChat({text:'ixi',channelId:exchange.channelId,
   previousChannelMessageId:exchange.botMessageId,lastExchange:exchange,now:now+120_000}),false);
 assert.equal(canContinueChat({text:'nova mensagem com texto maior que limite '.repeat(8),
  channelId:exchange.channelId,previousChannelMessageId:exchange.botMessageId,
  lastExchange:exchange,now}),false);
 assert.equal(canContinueChat({text:'uma resposta bem detalhada',
  channelId:exchange.channelId,replyMessageId:exchange.botMessageId,
  lastExchange:exchange,now:now+61_000}),true);
});
test('a IA decide se há reação ou assunto novo, sem conclusão pré-definida',()=>{
 const cue=conversationalCue({question:'vou mudar de assunto: filmes',
  lastExchange:exchange,channelId:exchange.channelId,now});
 assert.match(cue,/Quando o usuário mudar claramente de assunto/);
 assert.match(cue,/assunto novo/);
 assert.doesNotMatch(cue,/mensagem atual é uma interjeição|mensagem atual retoma/);
 assert.equal(conversationalCue({question:'oxi',lastExchange:exchange,
  channelId:'outro',history:[],now}), '');
});
test('as duas requisições da Cloudflare preservam o assunto sem prefixo obrigatório',async()=>{
 const saved=globalThis.fetch;const sent=[];
 try{
  globalThis.fetch=async(_url,opts)=>{
   sent.push(JSON.parse(opts.body));
   if(sent.length===1)return {ok:false,status:400,
    text:async()=>JSON.stringify({errors:[{code:5004,message:'unsupported parameter'}]})};
   return {ok:true,json:async()=>({choices:[{message:{
    content:'Nossa, perder itens depois do jogo fechar é complicado mesmo.'}}]})};
  };
  const response=await askCloudflare({accountId:'test',token:'test',
   question:'oxi que coisa',model:'@cf/google/gemma-4-26b-a4b-it',
   history:[{role:'user',content:exchange.userText},
    {role:'assistant',content:exchange.botText}],
   lastExchange:exchange,channelId:exchange.channelId});
  assert.match(response,/perder itens/);
  assert.equal(sent.length,2);
  for(const payload of sent){
   assert.match(payload.messages[0].content,/CONTEXTO CONVERSACIONAL/);
   assert.match(payload.messages[0].content,/perdi meus itens/);
   assert.match(payload.messages[0].content,/O jogo fechou/);
   assert.match(payload.messages[0].content,/assunto novo/);
  }
  assert.match(sent[1].messages.at(-1).content,/oxi que coisa/);
 }finally{globalThis.fetch=saved;}
});
test('histórico permite continuação após reinício, sem inventar resposta',()=>{
 const history=[{role:'user',content:exchange.userText},
  {role:'assistant',content:exchange.botText}];
 assert.match(followUpReference('ixi',history),/CONTEXTO CONVERSACIONAL/);
 assert.match(followUpReference('rapazzzz',history),/O jogo fechou/);
 assert.match(compactWorkersAIPayload({model:'test',question:'qui doidera',history,
  lastExchange:exchange,channelId:exchange.channelId}).messages[0].content,
  /CONTEXTO CONVERSACIONAL/);
});
test('quando a IA falha não simula uma interpretação que nunca gerou',()=>{
 const result=reactionFallback('oxi qq foi isso',{lastExchange:exchange,
  channelId:exchange.channelId,now});
 assert.match(result,/minha IA não conseguiu responder/);
 assert.doesNotMatch(result,/jogo fechou|perder itens|tá tudo bem/i);
 assert.equal(reactionFallback('ixi',{lastExchange:exchange,channelId:'outro',now}),null);
});
