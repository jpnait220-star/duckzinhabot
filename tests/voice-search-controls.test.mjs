import test from 'node:test';
import assert from 'node:assert/strict';
import {offerSearchControls} from '../src/web-research.mjs';

test('Pesquisar aparece quando Duckzinha é mencionada no chat da call',()=>{
  assert.equal(offerSearchControls({isVoiceChat:true,mentioned:true,searching:false}),true);
  assert.equal(offerSearchControls({isVoiceChat:false,mentioned:true,searching:false}),false);
});
test('Pesquisar não aparece sozinho em mensagens comuns nem duplica buscas já feitas',()=>{
  assert.equal(offerSearchControls({isVoiceChat:true,mentioned:false}),false);
  assert.equal(offerSearchControls({isVoiceChat:true,mentioned:true,searching:true}),false);
});
test('pedido de esclarecimento oferece pesquisar também fora da call',()=>{
  assert.equal(offerSearchControls({shouldOffer:true}),true);
});
