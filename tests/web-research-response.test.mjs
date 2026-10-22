import test from 'node:test';
import assert from 'node:assert/strict';
import {answerIgnoresWebResults,uncertainty} from '../src/web-research.mjs';

test('não diz que web está desativada quando já existem fontes',()=>{
  const fake='Eita, eu não consigo fazer essa pesquisa agora porque a pesquisa web ainda não está configurada aqui. 🦆✨';
  assert.equal(answerIgnoresWebResults(fake),true);
  assert.equal(answerIgnoresWebResults('A pesquisa na web está indisponível.'),true);
  assert.equal(answerIgnoresWebResults('Configure TAVILY_API_KEY para pesquisar'),true);
  assert.equal(answerIgnoresWebResults('[PESQUISA_NECESSARIA]'),true);
});

test('mantém respostas válidas fundamentadas em fontes',()=>{
  assert.equal(answerIgnoresWebResults('Segundo os resultados, Neymar é um futebolista brasileiro.'),false);
  assert.equal(answerIgnoresWebResults('A notícia foi publicada no site oficial de Minecraft.'),false);
  assert.equal(uncertainty('Não sei dizer'),true);
});
