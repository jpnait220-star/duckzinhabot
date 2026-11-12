import test from 'node:test';import assert from 'node:assert/strict';
import {readPublicChannel,replyFromChannel} from '../src/duck-chat-context.mjs';
import {formatChannelContext,cannedAnswer} from '../src/brain.mjs';
const now=Date.parse('2026-11-12T01:00:00Z'),botId='111111111111111111',requesterId='222222222222222222',prime='333333333333333333';
const message=(id,authorId,username,content,offset,extra={})=>({id,channelId:'public',guildId:'guild',createdTimestamp:now+offset,author:{id:authorId,username,bot:authorId===botId},content,...extra});
const current=()=>message('999',requesterId,'DuckzinXt',`<@${botId}> oq o prime_mat falou`,0);
const rows=[message('100',requesterId,'DuckzinXt','oq ele falou?',-3000),message('101',botId,'Duckzinha','não vi a mensagem',-2500),message('102',prime,'prime_mat','AINDA BEM',-1000,{member:{displayName:'prime_mat 🐐 GOAT'}})];
test('Screenshot: repeat prime_mat by account name or mention, without relying on the model',()=>{
 for(const question of [`<@${botId}> oq o prime_mat falou`,`<@${botId}> o que o <@${prime}> mandou?`,'oque o PRIME_MAT disse aqui?']){
  const text=replyFromChannel(question,rows,{botId,requesterId});assert.match(text,/AINDA BEM/);assert.match(text.replaceAll('\\_','_'),/prime_mat/);assert.doesNotMatch(text,/não vi|nao vi/);
 }
 assert.match(formatChannelContext(rows,botId,now),/usuario: prime_mat/);
});
test('Literal lookup keeps authors separate and does not invent a missing or ambiguous statement',()=>{
 const after=[...rows,message('103',requesterId,'DuckzinXt','AINDA PIOR',-500)];
 assert.match(replyFromChannel('oq prime_mat falou',after,{botId,requesterId}),/AINDA BEM/);
 assert.doesNotMatch(replyFromChannel('oq prime_mat falou',after,{botId,requesterId}),/AINDA PIOR/);
 assert.match(replyFromChannel('oq pessoa_ausente falou',rows,{botId}),/Não encontrei/);
 const twins=[message('11','u1','one','um',-1000,{member:{displayName:'Patinho'}}),message('12','u2','two','dois',-500,{member:{displayName:'Patinho'}})];
 assert.match(replyFromChannel('o que Patinho falou?',twins,{botId}),/mais de uma pessoa/);
 assert.equal(replyFromChannel('me explica como funciona Minecraft',rows,{botId}),null);
});
test('Pronouns need a reference and own-message lookups exclude the current message',()=>{
 assert.match(replyFromChannel('oq ele disse',rows,{botId,referenceId:'102'}),/AINDA BEM/);
 assert.match(replyFromChannel('oq ele disse',rows,{botId}),/De quem/);
 assert.match(replyFromChannel('oq eu falei',rows,{botId,requesterId}),/oq ele falou/);
});
test('API failure falls back to the current public channel RAM, excluding other channels, current, expired and future messages',async()=>{
 const m=current(),issues=[];m.channel={messages:{fetch:async()=>{throw Object.assign(Error('denied'),{code:50013});}}};
 const turns=rows.map(x=>({id:x.id,authorId:x.author.id,username:x.author.username,displayName:x.member?.displayName,text:x.content,channelId:x.channelId,guildId:x.guildId,timestamp:x.createdTimestamp}));
 turns.push({id:'private1',authorId:prime,username:'prime_mat',text:'PRIVATE CONTENT',channelId:'ticket',timestamp:now-100});
 turns.push({id:m.id,authorId:requesterId,text:m.content,channelId:'public',timestamp:now});
 turns.push({id:'old',authorId:prime,text:'TOO OLD',channelId:'public',timestamp:now-5*60*60_000});
 turns.push({id:'future',authorId:prime,text:'FUTURE',channelId:'public',timestamp:now+1000});
 const data=await readPublicChannel(m,{allowed:true,turns,now,onIssue:x=>issues.push(x)});
 assert.deepEqual(data.map(x=>x.id),['100','101','102']);assert.match(issues[0],/Ler histórico/);
 assert.match(replyFromChannel(m.content,data,{botId,requesterId}),/AINDA BEM/);
 assert.doesNotMatch(formatChannelContext(data,botId,now),/PRIVATE CONTENT|TOO OLD|FUTURE/);
});
test('Private channels never fetch or use the public cache; successful API data wins over stale/deleted cache',async()=>{
 let calls=0;const m=current();m.channel={messages:{fetch:async opts=>{calls++;assert.equal(opts.before,'999');return new Map();}}};
 const turns=[{id:'102',authorId:prime,username:'prime_mat',text:'DELETED',channelId:'public',timestamp:now-1000}];
 assert.deepEqual(await readPublicChannel(m,{allowed:false,turns,now}),[]);assert.equal(calls,0);
 assert.deepEqual(await readPublicChannel(m,{allowed:true,turns,now}),[]);assert.equal(calls,1);
});
test('Live fetch sorts/deduplicates, keeps edited content and rejects other-channel data',async()=>{
 const m=current(),edited={...rows[2],content:'texto corrigido'};
 m.channel={messages:{fetch:async()=>new Map([['b',edited],['a',rows[0]],['other',{...edited,id:'bad',channelId:'staff'}],['current',m]])}};
 const data=await readPublicChannel(m,{allowed:true,now});assert.deepEqual(data.map(x=>x.id),['100','102']);assert.match(replyFromChannel(m.content,data,{botId}),/texto corrigido/);
});
test('Empty message content warns about the intent instead of fabricating text',async()=>{
 const m=current(),issues=[];m.channel={messages:{fetch:async()=>new Map([['102',{...rows[2],content:''}]])}};
 const data=await readPublicChannel(m,{allowed:true,now,onIssue:x=>issues.push(x)});assert.match(issues[0],/Message Content Intent/);assert.match(replyFromChannel(m.content,data,{botId}),/Não encontrei/);
});
test('Fallback distinguishes missing AI setup and a temporary provider failure with context',()=>{
 assert.match(cannedAnswer('explica algo',{}, {aiReady:false}),/ainda não está configurado/);
 assert.match(cannedAnswer('explica algo',{}, {aiReady:true,hasChannelContext:true}),/Recebi o contexto deste chat/);
 assert.match(cannedAnswer('oi',{}, {aiReady:false}),/Oieee/);
});
