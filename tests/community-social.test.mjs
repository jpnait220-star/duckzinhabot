import test from 'node:test';
import assert from 'node:assert/strict';
import {familiarityLabel,imageReactionKind,maySendImageReaction,ticketGuide} from '../src/community-social.mjs';

test('Níveis de familiaridade baseados apenas em número de conversas',()=>{
  assert.equal(familiarityLabel(0),'novo por aqui');
  assert.equal(familiarityLabel(5),'conhecido da comunidade');
  assert.equal(familiarityLabel(25),'frequenta bastante o chat');
});
test('Reações de imagem detectam risadas e vitórias mas evitam situações delicadas',()=>{
  assert.equal(imageReactionKind('KKKKKKK muito bom'),'riso');
  assert.equal(imageReactionKind('GG vencemos!!'),'gg');
  assert.equal(imageReactionKind('que susto!'),'surpresa');
  assert.equal(imageReactionKind('muito fofo'),'fofo');
  assert.equal(imageReactionKind('ajuda, meu jogo tá com bug KKKK'),null);
  assert.equal(imageReactionKind('oi galera'),null);
});
test('Limites globais e por canal evitam spam automático',()=>{
  const now=1_800_000;
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,roll:0.05}),true);
  assert.equal(maySendImageReaction({now,lastGlobal:now-60000,lastChannel:0,roll:0.05}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:now-60_000,roll:0.05}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,roll:0.8}),false);
});
test('Assistente de ticket orienta a equipe e protege segredos',()=>{
  const guide=ticketGuide();
  assert.match(guide,/versão/);
  assert.match(guide,/Aguarde um membro da staff/);
  assert.match(guide,/Nunca envie senhas/);
});
