import test from 'node:test';
import assert from 'node:assert/strict';
import {decision,sourceDetails,uncertainty} from '../src/web-research.mjs';
import {researchTopic} from '../src/research.mjs';

test('pergunta sobre MushMC identifica assunto factual',()=>{
  assert.equal(researchTopic('o que é MushMC?'),'MushMC');
  assert.equal(uncertainty('[PESQUISA_NECESSARIA]'),true);
  assert.equal(uncertainty('Aii, não conheço esse servidor.'),true);
});
test('o membro pode escolher explicar ou pesquisar',()=>{
  assert.equal(decision('eu explico'),'explain');
  assert.equal(decision('quero explicar!'),'explain');
  assert.equal(decision('sim'),'yes');
  assert.equal(decision('pode pesquisar'),'yes');
  assert.equal(decision('não'),'no');
});
test('Ver fontes organiza títulos e links sem vazamento de menções',()=>{
  const view=sourceDetails([
    {title:'Portal oficial Minecraft',url:'https://www.minecraft.net/'},
    {title:'Notícias @everyone',url:'https://example.org/new'}
  ]);
  assert.match(view,/Fontes da pesquisa/);
  assert.match(view,/minecraft\.net/);
  assert.doesNotMatch(view,/@everyone/);
  assert.match(view,/example\.org/);
  assert.equal(sourceDetails([]),'Não há fontes disponíveis para esta resposta.');
});
