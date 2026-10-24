import test from 'node:test';
import assert from 'node:assert/strict';
import {offerSearchControls,uncertainty} from '../src/web-research.mjs';

test('no chat da call, não mostra Pesquisar só por mencionar a Duckzinha',()=>{
  assert.equal(offerSearchControls({isVoiceChat:true,mentioned:true,searching:false}),false);
  assert.equal(offerSearchControls({isVoiceChat:false,mentioned:true,searching:false}),false);
});

test('a dúvida real habilita Pesquisar, também no chat da call',()=>{
  for(const answer of [
    'Não sei o que é isso.',
    'Aii, não conheço essa coisa!',
    'Não tenho certeza do significado.'
  ]){
    assert.equal(uncertainty(answer),true,answer);
    assert.equal(offerSearchControls({shouldOffer:uncertainty(answer),isVoiceChat:true}),true);
  }
});

test('se já pesquisou ou sabe a resposta, não oferece buscar novamente',()=>{
  assert.equal(offerSearchControls({shouldOffer:true,searching:true}),false);
  assert.equal(offerSearchControls({shouldOffer:false,searching:false}),false);
  assert.equal(uncertainty('É um minério usado em circuitos do Minecraft.'),false);
});
