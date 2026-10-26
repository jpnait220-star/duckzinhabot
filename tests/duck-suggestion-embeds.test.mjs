import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags,ChannelType} from 'discord.js';
import {DuckCommunityPlus,suggestionEmbed,SUGGESTIONS_CHANNEL_ID}
 from '../src/duck-community-plus.mjs';

const guild='111111111111111111';
const author='222222222222222222';
const supporter='333333333333333333';
const voter2='444444444444444444';

function makeStore(){
 const suggestion={id:42,guild_id:guild,author_id:author,channel_id:SUGGESTIONS_CHANNEL_ID,
  text:'Quero mais eventos de Minecraft!',status:'open',message_id:'555555555555555555',
  created_at:'2026-10-25T20:00:00.000Z'};
 const voters=new Set();
 const fake={
  persistent:true,
  requireResult:async promise=>{
   const result=await promise;
   if(result.error)throw Error(result.error.message);
   return result.data;
  },
  db:{
   from(table){
    const q={
     table,op:'select',row:null,column:'',value:null,
     fields:'*',
     select(fields){q.fields=fields;q.op=q.op==='insert'?'insert':q.op==='update'?'update':'select';return q;},
     insert(row){q.op='insert';q.row=row;return q;},
     upsert(row){q.op='upsert';q.row=row;return q;},
     update(row){q.op='update';q.row=row;return q;},
     eq(column,value){q.column=column;q.value=value;return q;},
     order(){return q;},limit(){return q;},
     single(){return q;},maybeSingle(){return q;},
     then(ok,bad){
      let data=null,count=null;
      if(q.table==='duckzinha_suggestions'){
       if(q.op==='insert'){
        Object.assign(suggestion,q.row);data={id:42};
       }else if(q.op==='update'){
        Object.assign(suggestion,q.row);data=q.fields==='*'?null:{...suggestion};
       }else data={...suggestion};
      }else if(q.table==='duckzinha_suggestion_votes'){
       if(q.op==='upsert'){voters.add(q.row.user_id);data=null;}
       else {data=[...voters].map(user_id=>({user_id}));count=voters.size;}
      }
      return Promise.resolve({data,count,error:null}).then(ok,bad);
     }
    };
    return q;
   }
  }
 };
 return {store:fake,suggestion,voters};
}

test('embed de sugestão inclui autores, apoiadores e total sem ping',()=>{
 const card=suggestionEmbed({id:42,text:'Sugestão de novos eventos',
  authorId:author,status:'open',supporters:[supporter,voter2],count:2});
 assert.match(card.data.title,/Sugestão #42/);
 assert.equal(card.data.fields[0].value,'<@'+author+'>');
 assert.equal(card.data.fields[1].value,'**2**');
 assert.match(card.data.fields[2].value,new RegExp(supporter));
 assert.match(card.data.fields[2].value,new RegExp(voter2));
 assert.equal(typeof card.data.color,'number');
});
test('mais de 20 apoiadores aparecem resumidos corretamente',()=>{
 const ids=Array.from({length:20},(_,i)=>String(100000000000000000n+BigInt(i)));
 const card=suggestionEmbed({id:12,text:'Teste',authorId:author,supporters:ids,count:73});
 assert.match(card.data.fields[2].value,/\+ 53 outros apoiadores/);
 assert.equal(card.data.fields[1].value,'**73**');
});
test('clicar Apoiar atualiza a mesma mensagem em embed e persiste voto único',async()=>{
 const {store,voters}=makeStore();
 const community=new DuckCommunityPlus({store});
 const edits=[],answers=[];
 const message={id:'555555555555555555',
  edit:async payload=>{edits.push(payload);return message;}};
 const interaction={
  customId:'duckidea:vote:42',user:{id:supporter},guildId:guild,
  message,channelId:SUGGESTIONS_CHANNEL_ID,
  deferReply:async value=>{assert.equal(value.flags,MessageFlags.Ephemeral);},
  editReply:async value=>{answers.push(value);}
 };
 await community.suggestionButton(interaction);
 assert.equal(voters.size,1);
 assert.equal(edits.length,1);
 assert.equal(edits[0].embeds[0].data.fields[1].value,'**1**');
 assert.ok(edits[0].embeds[0].data.fields[2].value.includes(supporter));
 assert.equal(edits[0].components[0].components[0].data.label,'Apoiar');
 assert.deepEqual(edits[0].allowedMentions,{parse:[]});
 await community.suggestionButton(interaction);
 assert.equal(voters.size,1,'clicar novamente não conta como outro apoio');
 assert.equal(edits.at(-1).embeds[0].data.fields[1].value,'**1**');
 assert.match(answers.at(-1),/registrado/);
});
test('comando /sugerir publica embed no canal correto',async()=>{
 const {store}=makeStore();
 const plus=new DuckCommunityPlus({store});
 let payload,confirmation;
 const msg={id:'555555555555555555'};
 const channel={
  type:ChannelType.GuildText,name:'sugestoes',guild:{roles:{everyone:{id:guild}}},
  permissionsFor:()=>({has:()=>true}),
  send:async posted=>{payload=posted;return msg;}
 };
 const interaction={
  guildId:guild,channelId:SUGGESTIONS_CHANNEL_ID,channel,user:{id:author},
  options:{getString:()=> 'Quero mais eventos de Minecraft!'},
  deferReply:async()=>{},editReply:async response=>{confirmation=response}
 };
 await plus.suggest(interaction);
 assert.equal(payload.embeds[0].data.title,'💡 Sugestão #42');
 assert.equal(payload.embeds[0].data.fields[1].value,'**0**');
 assert.equal(payload.components[0].components[0].data.label,'Apoiar');
 assert.equal(confirmation,'✅ Sua sugestão foi publicada!');
});
