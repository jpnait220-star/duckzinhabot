import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAvatar,normalizeAvatar,COLORS,DEFAULT_AVATAR} from '../src/duck-avatar.mjs';
import {DuckQuiz,QUIZ_BANK,levelForStreak} from '../src/duck-quiz.mjs';
import {newCommands,runNewCommand} from '../src/duck-features.mjs';
import {PermissionFlagsBits} from 'discord.js';

test('avatar novo aceita cosméticos independentes e preserva seleção antiga',()=>{
  const old=normalizeAvatar({acessorio:'coroa',corpo:'azul'});
  assert.equal(old.chapeu,'coroa');
  assert.equal(old.corpo,'azul');
  assert.equal(normalizeAvatar({acessorio:'oculos'}).rosto,'oculos');
  assert.equal(normalizeAvatar({chapeu:'coelho',acessorio:'bone'}).chapeu,'coelho');
  assert.equal(normalizeAvatar({maos:'item_que_nao_existe'}).maos,DEFAULT_AVATAR.maos);
  assert.ok(COLORS.pet.includes('ceifador'));
  assert.equal(COLORS.rosto.some(x=>x.startsWith('mascara_')),false);
  for(const removed of ['mascara_pato','mascara_corvo','mascara_japonesa']){
    assert.equal(normalizeAvatar({rosto:removed}).rosto,'nenhum');
  }
  assert.equal(COLORS.maos.includes('punhos_fogo'),false);
  assert.ok(COLORS.maos.includes('garras'));
  assert.equal(COLORS.maos.some(v=>v.includes('luva')),false);
  for(const removed of ['luvas_boxe','luvas_brancas']){
    assert.equal(normalizeAvatar({maos:removed}).maos,'nenhuma');
  }
});

test('gera PNG real de alta resolução e visual varia com cosméticos',()=>{
  const baseline=renderAvatar();
  const variant=renderAvatar({
    fundo:'espaco',corpo:'rosa',chapeu:'coelho',rosto:'visor',
    roupa:'kimono',maos:'garras',aura:'gelo',pet:'fantasma',olhos:'sonolento'
  });
  assert.equal(baseline.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(baseline.readUInt32BE(16),384);
  assert.equal(baseline.readUInt32BE(20),384);
  assert.ok(baseline.length>2500);
  assert.notDeepEqual(baseline,variant);
});

test('banco de perguntas tem cinco níveis com quatro alternativas corretas',()=>{
  assert.equal(QUIZ_BANK.length,5);
  for(const tier of QUIZ_BANK){
    assert.ok(tier.length>=10);
    for(const q of tier){
      assert.equal(q.choices.length,4);
      assert.ok(Number.isInteger(q.right)&&q.right>=0&&q.right<4);
    }
  }
  assert.deepEqual([0,2,3,5,6,8,9,12].map(levelForStreak),[1,1,2,2,3,3,4,5]);
});

test('quiz mantém streak, sobe de nível, não repete pergunta recente e termina ao errar',async()=>{
  let time=1_800_000_000_000;
  const quiz=new DuckQuiz({now:()=>time,random:()=>0});
  const initial=quiz.start({user:{id:'duck'}});
  assert.match(initial.content,/Nível: \*\*1\/5/);
  assert.equal(initial.components.length,1);
  for(let round=0;round<7;round++){
    const session=quiz.sessions.get(quiz.userSessions.get('duck'));
    assert.ok(session);
    const usedBefore=new Set(session.used);
    assert.equal(levelForStreak(session.streak),Math.min(5,1+Math.floor(round/3)));
    let updated;
    await quiz.answer({
      customId:'duckgame:'+session.id+':'+session.question.right,
      user:{id:'duck'},
      update:async payload=>{updated=payload;}
    });
    assert.match(updated.content,/Acertou/);
    assert.equal(quiz.activeStreak('duck'),round+1);
    const next=quiz.sessions.get(quiz.userSessions.get('duck'));
    if(next.question.key.split(':')[0]===session.question.key.split(':')[0])
      assert.equal(usedBefore.has(next.question.key),false);
  }
  assert.equal(quiz.score('duck'),7);
  const session=quiz.sessions.get(quiz.userSessions.get('duck'));
  let ended;
  await quiz.answer({
    customId:'duckgame:'+session.id+':'+((session.question.right+1)%4),
    user:{id:'duck'},
    update:async payload=>{ended=payload;}
  });
  assert.match(ended.content,/sequência terminou/);
  assert.equal(quiz.activeStreak('duck'),0);
  assert.equal(quiz.score('duck'),7);
  assert.equal(ended.components.length,0);
});

test('clique de outra pessoa não rouba pontos do jogador',async()=>{
  const quiz=new DuckQuiz({now:()=>1_800_000_000_000,random:()=>0});
  quiz.start({user:{id:'owner'}});
  const session=quiz.sessions.get(quiz.userSessions.get('owner'));
  let warning;
  await quiz.answer({
    customId:'duckgame:'+session.id+':'+session.question.right,
    user:{id:'intruder'},
    reply:async payload=>{warning=payload.content;}
  });
  assert.match(warning,/outra pessoa/);
  assert.equal(quiz.activeStreak('owner'),0);
  assert.ok(quiz.sessions.has(session.id));
});

test('anúncio usa um campo e envia Markdown completo como texto',async()=>{
  const spec=newCommands().find(x=>x.name==='novidade');
  const fields=spec.options.find(x=>x.name==='publicar').options;
  assert.deepEqual(fields.map(x=>x.name),['texto']);
  const announcement='# 🦆 Atualização!\n> **Avatares personalizados**\n\n✨ Novo quiz!';
  let posted,saved,deferred,confirmed;
  const interaction={
    inGuild:()=>true,guildId:'g',commandName:'novidade',user:{id:'moderator'},
    memberPermissions:{has:flag=>flag===PermissionFlagsBits.ManageGuild},
    guild:{members:{me:{id:'bot'}}},channel:{permissionsFor:()=>({has:()=>true}),
      send:async content=>{posted=content;}},
    options:{getString:()=>announcement},
    deferReply:async p=>{deferred=p;},editReply:async p=>{confirmed=p;}
  };
  const store={guildId:'g',persistent:true,addProjectUpdate:async(...args)=>{saved=args;}};
  assert.equal(await runNewCommand(interaction,{store}),true);
  assert.ok(posted,'Anúncio não enviado. Feedback: '+JSON.stringify(confirmed));
  assert.equal(posted.content,announcement+'\n\n@everyone');
  assert.deepEqual(posted.allowedMentions,{parse:['everyone']});
  assert.equal(saved[0],'🦆 Atualização!');
  assert.equal(saved[1],announcement);
  assert.match(confirmed,/publicada/);
  assert.ok(deferred);
});

test('auras e acessórios renderizam visuais PNG realmente distintos',()=>{
  const base={corpo:'amarelo',chapeu:'coroa',roupa:'jaqueta',maos:'garras'};
  const styles=['brilho','coracoes','fogo','gelo','eletrica','dinheiro'];
  const images=styles.map(aura=>renderAvatar({...base,aura}));
  assert.equal(new Set(images.map(img=>img.toString('base64'))).size,styles.length);
  for(const png of images){
    assert.ok(png.length>5000);
    assert.equal(png.readUInt32BE(16),384);
    assert.equal(png.readUInt32BE(20),384);
  }
});
