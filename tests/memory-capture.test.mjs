import test from 'node:test';
import assert from 'node:assert/strict';
import {captureCandidate} from '../src/memory-capture.mjs';

test('Mensagens públicas normais ficam só no contexto temporário',()=>{
  assert.equal(captureCandidate('o anime Cyberpunk é muito bom',{}),null);
  assert.equal(captureCandidate('meu jogo favorito é Minecraft',{mentioned:true}),null);
});
test('Membro pode pedir explicitamente para lembrar preferência',()=>{
  assert.deepEqual(captureCandidate('lembra que meu jogo favorito é Minecraft'),
    {kind:'self',key:'jogo',value:'meu jogo favorito é Minecraft'});
  assert.equal(captureCandidate('lembra que minha cor favorita é amarelo')?.key,'cor');
  assert.equal(captureCandidate('lembra que eu gosto de jogar Minecraft')?.kind,'self');
});
test('Informação oficial do servidor exige autorização e pedido explícito',()=>{
  assert.equal(captureCandidate('lembra que o servidor tem boxpvp',{isStaff:true})?.kind,'server');
  assert.equal(captureCandidate('lembra que o servidor tem boxpvp',{isStaff:false}),null);
  assert.equal(captureCandidate('o servidor tem boxpvp',{isStaff:true}),null);
});
test('Não transforma alegações de terceiros em fatos pessoais',()=>{
  assert.equal(captureCandidate('lembra que João gosta de Minecraft',{mentioned:true}),null);
  assert.equal(captureCandidate('lembra que ela gosta de anime',{mentioned:true}),null);
  assert.equal(captureCandidate('lembra que eu gosto de Minecraft https://site.example',{mentioned:true}),null);
});
