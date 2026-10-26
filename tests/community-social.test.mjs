import test from 'node:test';
import assert from 'node:assert/strict';
import {familiarityLabel,imageReactionKind,complimentToDuck,maySendImageReaction,ticketGuide} from '../src/community-social.mjs';

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
  assert.equal(imageReactionKind('oi galera'),'ola');
});
test('Limites globais e por canal evitam spam automático',()=>{
  const now=1_800_000;
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,roll:0.05}),true);
  assert.equal(maySendImageReaction({now,lastGlobal:now-60000,lastChannel:0,roll:0.05}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:now-60_000,roll:0.05}),false);
  assert.equal(maySendImageReaction({now,lastGlobal:0,lastChannel:0,roll:0.8}),false);
});
test('Piadas e bordões só viram memória por pedido expresso',async()=>{
  const {captureCandidate}=await import('../src/memory-capture.mjs');
  assert.equal(captureCandidate('meu bordão é pato rei',{mentioned:true}),null);
  assert.equal(captureCandidate('lembra que meu bordão é pato rei')?.key,'bordao');
  assert.equal(captureCandidate('lembra que minha piada favorita é pato ninja')?.key,'piada');
});
test('Assistente de ticket orienta a equipe e protege segredos',()=>{
  const guide=ticketGuide();
  assert.match(guide,/versão/);
  assert.match(guide,/Aguarde um membro da staff/);
  assert.match(guide,/Nunca envie senhas/);
});

test('Variações informais e sem acento de saudações',()=>{
  for(const msg of [
    'ola','OLÁ','olaaaa','Olááá!!!!','oieeeee','OIIIIII',
    'eae','e aí pessoal','eaiii','opa','opaaa','SALVEEE',
    'bom dia','bom diaaa','Boa Tarde!','boa noite',
    '👋 olá','fala rapaziada','oioi'
  ])assert.equal(imageReactionKind(msg),'ola',msg);
  assert.equal(imageReactionKind('oi pode me ajudar? deu erro'),null);
});

test('elogio direcionado a Duckzinha recebe categoria fofo mesmo com oi ou risada',()=>{
 const praises=[
  'Duckzinha você é incrível!', 'Duckzinha, vc é muito legal',
  'duckzinha vc é mt fofa kkkkk', 'Você é maravilhosa',
  'te adoro, Duckzinha', 'você é muito engraçada',
  'tu é gente boa', 'parabéns, Duckzinha!'
 ];
 for(const input of praises){
  assert.equal(complimentToDuck(input,{directed:true}),true,input);
  assert.equal(imageReactionKind(input,{botDirected:true}),'fofo',input);
 }
 assert.equal(complimentToDuck('vc é incrível',{directed:false}),false);
 assert.equal(imageReactionKind('que fofo'),'fofo','mantém reações antigas');
});
test('elogios a outras pessoas ou frases negativas não acionam elogio da bot',()=>{
 for(const input of [
  'a Maria é linda!', 'vc é legal', 'minha amiga é maravilhosa',
  'não é fofa, Duckzinha', 'Duckzinha meu Minecraft deu erro', 
  'Duckzinha, me ajuda com o servidor', 'Duckzinha minha senha é xyz'
 ]){
  assert.equal(complimentToDuck(input,{directed:false}),false,input);
 }
 for(const input of ['não é fofa, Duckzinha','Duckzinha meu Minecraft deu erro',
   'Duckzinha, me ajuda com o servidor']){
  assert.equal(complimentToDuck(input,{directed:true}),false,input);
 }
});
test('50% de chance de fofo com antispam próprio e mínimo para elogios',()=>{
 const now=1_800_000;
 const args={now,lastGlobal:0,lastChannel:0,lastUser:0,isCompliment:true};
 assert.equal(maySendImageReaction({...args,roll:0}),true);
 assert.equal(maySendImageReaction({...args,roll:0.49}),true);
 assert.equal(maySendImageReaction({...args,roll:0.50}),false);
 assert.equal(maySendImageReaction({...args,roll:0.99}),false);
 assert.equal(maySendImageReaction({...args,lastGlobal:now-7000,roll:0.1}),false);
 assert.equal(maySendImageReaction({...args,lastChannel:now-20000,roll:0.1}),false);
 assert.equal(maySendImageReaction({...args,lastUser:now-30000,roll:0.1}),false);
 assert.equal(maySendImageReaction({...args,lastGlobal:now-9000,lastChannel:now-26000,
  lastUser:now-61000,roll:0.49}),true);
 // Outros tipos continuam com o antispam mais forte.
 assert.equal(maySendImageReaction({now,lastGlobal:now-26000,lastChannel:0,
  lastUser:0,roll:0.1}),false);
});
