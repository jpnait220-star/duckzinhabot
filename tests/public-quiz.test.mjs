import test from 'node:test';
import assert from 'node:assert/strict';
import {DuckPublicQuiz,levelForStreak} from '../src/duck-public-quiz.mjs';
import {MessageFlags,PermissionFlagsBits} from 'discord.js';
import {newCommands,runNewCommand} from '../src/duck-features.mjs';

function setup(){
  let now=100_000;
  const jobs=[],messages=[];
  const setTimer=(fn,delay)=>{
    const timer={due:now+delay,fn,cancelled:false,unref(){}};
    jobs.push(timer);return timer;
  };
  const quiz=new DuckPublicQuiz({
    now:()=>now,random:()=>0,setTimer,
    clearTimer:timer=>{timer.cancelled=true;},
    roundMs:35000,nextMs:4000,maxRounds:30
  });
  let startPayload=null;
  const message=()=>({
    edits:[],
    async edit(payload){this.edits.push(payload);return this;}
  });
  const channel={async send(payload){
    const m=message();m.payload=payload;messages.push(m);return m;
  }};
  const interaction={guildId:'guild1',channelId:'general',channel,
    reply:async payload=>{startPayload=payload;},
    fetchReply:async()=>{const m=message();m.payload=startPayload;messages.push(m);return m;}
  };
  async function advance(ms){
    const target=now+ms;
    for(let safety=0;safety<100;safety++){
      const next=jobs.filter(j=>!j.cancelled&&j.due<=target).sort((a,b)=>a.due-b.due)[0];
      if(!next)break;
      now=next.due;next.cancelled=true;next.fn();
      await new Promise(resolve=>setImmediate(resolve));
      await new Promise(resolve=>setImmediate(resolve));
    }
    now=target;
  }
  const click=async(user,correct=true)=>{
    const room=quiz.rooms.get('guild1:general'),round=room.current;
    const choice=correct?round.question.right:(round.question.right+1)%4;
    const received=[];
    await quiz.answer({customId:'duckpublic:'+round.id+':'+choice,
      user:{id:user},reply:async p=>received.push(p)});
    return received[0];
  };
  return {quiz,interaction,channel,messages,click,advance,get startPayload(){return startPayload;}};
}

test('public quiz posts without ephemeral flag and accepts multiple voters',async()=>{
  const s=setup();
  assert.equal(await s.quiz.start(s.interaction),true);
  assert.equal(s.messages.length,1);
  assert.equal(s.startPayload.flags,undefined);
  assert.match(s.startPayload.content,/Todos podem entrar/);
  const before=s.messages[0].edits.length;
  const a=await s.click('member1',true);
  const b=await s.click('member2',true);
  const c=await s.click('member3',false);
  assert.match(a.content,/Resposta registrada/);
  assert.match(b.content,/Resposta registrada/);
  assert.match(c.content,/Resposta registrada/);
  assert.equal(a.flags,MessageFlags.Ephemeral);
  assert.equal(s.messages[0].edits.length,before,'Clique de um jogador não deve fechar a pergunta');
  assert.equal(s.quiz.rooms.get('guild1:general').current.answers.size,3);
  s.quiz.shutdown();
});

test('same player cannot answer twice, but everyone else can',async()=>{
  const s=setup();
  await s.quiz.start(s.interaction);
  await s.click('member1',true);
  const repeated=await s.click('member1',false);
  assert.match(repeated.content,/já respondeu/);
  await s.click('member2',false);
  assert.equal(s.quiz.rooms.get('guild1:general').current.answers.size,2);
  s.quiz.shutdown();
});

test('round closes by timer, shows qualified players, and continues at harder levels',async()=>{
  const s=setup();
  await s.quiz.start(s.interaction);
  for(let roundNo=1;roundNo<=4;roundNo++){
    const room=s.quiz.rooms.get('guild1:general'),round=room.current;
    assert.equal(round.number,roundNo);
    assert.equal(levelForStreak(round.number-1),roundNo<=3?1:2);
    await s.click('winner1',true);
    await s.click('winner2',true);
    if(roundNo===1)await s.click('lost',false);
    assert.equal(round.message.edits.length,0);
    await s.advance(35000);
    const ended=round.message.edits.at(-1);
    assert.match(ended.content,/QUEM PASSOU \(2\)/);
    assert.match(ended.content,/<@winner1>/);
    assert.match(ended.content,/<@winner2>/);
    assert.doesNotMatch(ended.content,/<@lost>/);
    assert.equal(ended.components.length,0);
    assert.equal(s.quiz.score('winner1'),roundNo);
    await s.advance(4000);
    const next=s.quiz.rooms.get('guild1:general').current;
    assert.equal(next.number,roundNo+1);
    if(roundNo===1){
      assert.equal(next.eligible.has('lost'),false);
      const rejected=await s.click('lost',true);
      assert.match(rejected.content,/apenas as pessoas/);
    }
    assert.equal(s.messages.length,roundNo+1);
  }
  s.quiz.shutdown();
});

test('quiz finishes only when there are no correct players',async()=>{
  const s=setup();
  await s.quiz.start(s.interaction);
  await s.click('player1',false);
  await s.advance(35000);
  assert.equal(s.quiz.rooms.size,0);
  assert.match(s.messages[0].edits[0].content,/Ninguém passou/);
  assert.match(s.messages[0].edits[0].content,/Fim da partida/);
  await s.advance(4000);
  assert.equal(s.messages.length,1);
});

test('only one quiz per channel, but parallel channels are independent',async()=>{
  const s=setup();
  await s.quiz.start(s.interaction);
  let notice;
  await s.quiz.start({...s.interaction,reply:async p=>{notice=p;}});
  assert.match(notice.content,/Já existe/);
  assert.equal(notice.flags,MessageFlags.Ephemeral);
  const ch2={...s.interaction,channelId:'another',channel:{
    send:async()=>({edit:async()=>{}})
  },reply:async()=>{},fetchReply:async()=>({edit:async()=>{}})};
  assert.equal(await s.quiz.start(ch2),true);
  assert.equal(s.quiz.rooms.size,2);
  s.quiz.shutdown();
});

test('moderators can stop a public quiz and everyone else is refused',async()=>{
  const s=setup();
  await s.quiz.start(s.interaction);
  let notice;
  const mock={inGuild:()=>true,guildId:'guild1',channelId:'general',commandName:'jogo',
    memberPermissions:{has:()=>false},
    options:{getSubcommand:()=> 'parar'},
    reply:async p=>{notice=p;}};
  const extras={stopGame:interaction=>s.quiz.stop(interaction)};
  assert.equal(await runNewCommand(mock,{store:{guildId:'guild1'},extras}),true);
  assert.match(notice.content,/Apenas a moderação/);
  assert.equal(s.quiz.rooms.size,1);
  mock.memberPermissions.has=flag=>flag===PermissionFlagsBits.ManageMessages;
  assert.equal(await runNewCommand(mock,{store:{guildId:'guild1'},extras}),true);
  assert.equal(s.quiz.rooms.size,0);
  assert.match(s.messages[0].edits.at(-1).content,/encerrado pela moderação/);
});

test('command /jogo quiz public and /jogo parar exist',()=>{
  const cmds=newCommands();
  const game=cmds.find(x=>x.name==='jogo');
  assert.deepEqual(game.options.map(x=>x.name),['quiz','parar']);
});
