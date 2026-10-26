import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags} from 'discord.js';
import {tiktokRelayRequest} from '../src/duck-conversation-intents.mjs';
import {SUGGESTIONS_CHANNEL_ID,DuckCommunityPlus} from '../src/duck-community-plus.mjs';
import {MEMBER_HELP_SECTIONS,memberHelpEmbeds} from '../src/duck-member-help.mjs';
import {embed} from '../src/commands.mjs';
const bot='999999999999999999',friend='333333333333333333';

test('Duckzinha entende pedido informal de perguntar TikTok a uma pessoa marcada',()=>{
 for(const message of [
  'fala pro <@'+friend+'> se ele tem tik Tok <@'+bot+'>',
  '<@'+bot+'> pergunta pra <@'+friend+'> se ele tem TikTok',
  'diz pro <@'+friend+'> se tem tiktok <@'+bot+'>'
 ]){
  const x=tiktokRelayRequest(message,{botId:bot,mentionedIds:[bot,friend]});
  assert.equal(x?.kind,'ask',message);
  assert.equal(x?.userId,friend);
  assert.match(x.text,/você tem TikTok/);
 }
});
test('não inventa destinatário nem responde por conta da pessoa',()=>{
 const unclear=tiktokRelayRequest('fala pro se ele tem tik Tok',{botId:bot,mentionedIds:[bot]});
 assert.equal(unclear?.kind,'clarify');
 assert.match(unclear.text,/quem é/i);
 assert.equal(tiktokRelayRequest('vc tem TikTok?',{botId:bot,mentionedIds:[bot]}),null);
 assert.equal(tiktokRelayRequest('fala pra ele se está online',{botId:bot,mentionedIds:[bot]}),null);
});
test('/sugerir é rejeitado fora do canal oficial sem registrar no banco',async()=>{
 let response=null;
 const plus=new DuckCommunityPlus({store:{persistent:true,db:{from:()=>{throw Error('Não deveria acessar banco');}}}});
 const options={getString:()=> 'Essa é minha sugestão para o site'};
 const request={channelId:'111111111111111111',options,
   reply:async result=>{response=result;}};
 await plus.suggest(request);
 assert.equal(response.flags,MessageFlags.Ephemeral);
 assert.match(response.content,new RegExp(SUGGESTIONS_CHANNEL_ID));
});
test('/ajuda não fala de banimento por DM e informa canal de sugestões',()=>{
 const help=memberHelpEmbeds(embed).map(x=>x.data.description).join('\n');
 assert.doesNotMatch(help,/Banimentos e avisos podem chegar por DM/);
 assert.match(help,new RegExp(SUGGESTIONS_CHANNEL_ID));
 assert.ok(MEMBER_HELP_SECTIONS.some(x=>x.commands.some(y=>y[0]==='/sugerir')));
});
