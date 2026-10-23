import test from 'node:test';
import assert from 'node:assert/strict';
import {customEmojiEnv,customEmojiId,findCustomEmoji,emojiNames} from '../src/emoji-reactions.mjs';
import {imageReactionKind,maySendImageReaction} from '../src/community-social.mjs';

test('Saudações e gargalhadas usam a reação correspondente',()=>{
  assert.equal(imageReactionKind('oi galera'),'ola');
  assert.equal(imageReactionKind('Bom dia!'),'ola');
  assert.equal(imageReactionKind('KKKKKKK'),'riso');
  assert.equal(imageReactionKind('GG ganhamos'),'gg');
});
test('Emojis são reconhecidos pelo nome no servidor',()=>{
  const serverEmojis=[
    {id:'123456789123456789',name:'duckzinha_ola',available:true},
    {id:'223456789123456789',name:'duckzinha_riso',available:true},
    {id:'323456789123456789',name:'duckzinha_fofo',available:true}
  ];
  assert.equal(findCustomEmoji(serverEmojis,'ola')?.id,'123456789123456789');
  assert.equal(findCustomEmoji(serverEmojis,'riso')?.id,'223456789123456789');
  assert.equal(findCustomEmoji(serverEmojis,'fofo')?.id,'323456789123456789');
  assert.equal(findCustomEmoji(serverEmojis,'surpresa'),null);
  assert.equal(findCustomEmoji([{id:'1',name:'duckzinha_ola',available:false}],'ola'),null);
  assert.ok(emojiNames('ola').includes('duckzinha_ola'));
});
test('IDs copiados do Discord funcionam, figurinha não é enviada',()=>{
  assert.equal(customEmojiEnv('ola'),'DUCK_EMOJI_OLA');
  assert.equal(customEmojiId('<:duckzinha_ola:123456789123456789>'),'123456789123456789');
  assert.equal(customEmojiId('<a:duckzinha_ola:123456789123456789>'),'123456789123456789');
  assert.equal(customEmojiId('123456789123456789'),'123456789123456789');
  assert.equal(customEmojiId('minhafigurinha'),null);
});
test('Limites impedem excesso de reações automáticas',()=>{
  const now=2_000_000;
  assert.equal(maySendImageReaction({now,lastGlobal:now-1000,lastChannel:0,roll:0}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:now-1000,roll:0}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,roll:0}),true);
});

test('Saudações respondem mais rápido mas seguem antispam por usuário',()=>{
  const now=1_800_000;
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,lastUser:0,roll:0.95,isGreeting:true}),true);
  assert.equal(maySendImageReaction({now,lastGlobal:now-1000,lastChannel:0,lastUser:0,roll:0,isGreeting:true}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:now-1000,lastUser:0,roll:0,isGreeting:true}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,lastUser:now-1000,roll:0,isGreeting:true}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,lastUser:0,roll:0.95,isGreeting:false}),false);
});

test('50% de chance em reações não relacionadas a saudações',()=>{
  const now=1_800_000;
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,lastUser:0,roll:0.49}),true);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,lastUser:0,roll:0.50}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:now-1_000,lastUser:0,roll:0.49}),false);
});
