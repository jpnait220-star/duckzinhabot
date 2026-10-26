import test from 'node:test';
import assert from 'node:assert/strict';
import {DuckChatHistory,HISTORY_WINDOW,HISTORY_CACHE_MS} from '../src/duck-chat-history.mjs';
import {conversationalCue} from '../src/duck-contextual-chat.mjs';
import {askCloudflare} from '../src/brain.mjs';

const user='222222222222222222';

test('após 5 minutos o histórico continua disponível com a última resposta',async()=>{
 let time=1_750_000_000_000,loads=0;
 const db=new Map();
 const history=new DuckChatHistory({
  now:()=>time,load:async id=>{loads++;return db.get(id)||[];},
  save:async(id,items)=>{db.set(id,structuredClone(items));}
 });
 await history.append(user,'Meu PC travou jogando Minecraft','Eita, você perdeu o progresso?');
 time+=5*60_000;
 const messages=await history.get(user);
 assert.equal(messages.length,2);
 assert.equal(messages[0].content,'Meu PC travou jogando Minecraft');
 assert.match(messages[1].content,/perdeu o progresso/);
 assert.equal(loads,1,'não perder histórico nem acessar banco depois de cinco minutos');
 const note=conversationalCue({question:'e o jogo?',history:messages,channelId:'canal',now:time});
 assert.match(note,/Meu PC travou jogando Minecraft/);
 assert.match(note,/Eita, você perdeu o progresso/);
 assert.equal(HISTORY_CACHE_MS,6*60*60_000);
});

test('conversa sobrevive à reinicialização e mantém até dez trocas no banco',async()=>{
 const db=new Map();
 let time=1_750_000_000_000;
 const config={now:()=>time,load:async id=>db.get(id)||[],
  save:async(id,items)=>{db.set(id,structuredClone(items));}};
 let history=new DuckChatHistory(config);
 for(let index=0;index<13;index++){
  await history.append(user,'Assunto '+index,'Resposta '+index);
  time+=15*60_000;
 }
 assert.equal(db.get(user).length,HISTORY_WINDOW);
 history=new DuckChatHistory(config); // restart process
 const turns=await history.get(user);
 assert.equal(turns.length,HISTORY_WINDOW);
 assert.equal(turns.at(-1).content,'Resposta 12');
 assert.equal(turns[0].content,'Assunto 3');
});

test('falha temporária no Supabase não apaga cache e não fixa vazio por 45 minutos',async()=>{
 const errors=[];
 let time=1_750_000_000_000,reads=0;
 const history=new DuckChatHistory({
  now:()=>time,cacheMs:1000,
  load:async()=>{reads++;if(reads===1)return [{role:'user',content:'Assunto sobre Minecraft'}];throw Error('timeout');},
  onError:(kind,id,error)=>errors.push({kind,id,error:error.message})
 });
 assert.equal((await history.get(user)).length,1);
 time+=5000;
 const afterFailure=await history.get(user);
 assert.equal(afterFailure.length,1);
 assert.match(afterFailure[0].content,/Minecraft/);
 assert.equal(reads,2);
 assert.equal(errors[0].kind,'load');

 const empty=new DuckChatHistory({load:async()=>{throw Error('offline')},
  onError:()=>{}});
 assert.deepEqual(await empty.get(user),[]);
 assert.deepEqual(await empty.get(user),[]);
});

test('tentativa de salvar com falha mantém histórico em RAM',async()=>{
 const failures=[];
 const memory=new DuckChatHistory({
  load:async()=>[],
  save:async()=>{throw Error('Supabase offline')},
  onError:(kind,_id,e)=>failures.push([kind,e.message])
 });
 await memory.append(user,'Qual o nome do servidor?','DuckzinCommunity');
 const result=await memory.get(user);
 assert.equal(result.length,2);
 assert.equal(result.at(-1).content,'DuckzinCommunity');
 assert.deepEqual(failures,[['save','Supabase offline']]);
});

test('limpeza de memória cancela cache local; não recupera conversa de outra pessoa',async()=>{
 const data=new Map();
 const memory=new DuckChatHistory({load:async id=>data.get(id)||[],
  save:async(id,items)=>{data.set(id,items)}});
 await memory.append(user,'Sobre mods','Fabric é uma opção');
 await memory.append('outro','Assunto secreto','Outro assunto');
 memory.clear(user);
 data.delete(user); // Simula o apagamento no Supabase
 assert.equal((await memory.get(user)).length,0);
 assert.equal((await memory.get('outro')).length,2);
});

test('Workers AI recebe histórico antigo sem cumprimentar depois de cinco minutos',async()=>{
 const previous=globalThis.fetch;
 let sent;
 try{
  globalThis.fetch=async(_,opts)=>{
   sent=JSON.parse(opts.body);
   return {ok:true,json:async()=>({choices:[{message:{content:'Sim, era sobre o mod do Minecraft.'}}]})};
  };
  await askCloudflare({
   accountId:'x',token:'x',model:'@cf/google/gemma-4-26b-a4b-it',
   question:'e aquele mod?',history:[
    {role:'user',content:'Me explica o mod Iris para Minecraft'},
    {role:'assistant',content:'Iris permite usar shaders no Minecraft.'}
   ],familiarity:'já conversaram antes; continue a conversa normalmente'
  });
  assert.match(sent.messages[0].content,/cinco minutos ou mais/);
  assert.match(sent.messages[0].content,/Iris permite usar shaders/);
  assert.doesNotMatch(sent.messages[0].content,/FAMILIARIDADE NO SERVIDOR: novo por aqui/);
 }finally{globalThis.fetch=previous;}
});

test('mensagens concorrentes não se sobrepõem quando Supabase demora',async()=>{
 const db=new Map();let loads=0;
 const manager=new DuckChatHistory({
  load:async id=>{loads++;await Promise.resolve();return db.get(id)||[];},
  save:async(id,items)=>{await Promise.resolve();db.set(id,structuredClone(items));}
 });
 await Promise.all([
  manager.append(user,'Primeira pergunta','Primeira resposta'),
  manager.append(user,'Segunda pergunta','Segunda resposta')
 ]);
 const rows=await manager.get(user);
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(x=>x.content),[
  'Primeira pergunta','Primeira resposta','Segunda pergunta','Segunda resposta'
 ]);
 assert.equal(db.get(user).length,4);
 assert.equal(loads,1);
});
