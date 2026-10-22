import test from 'node:test';
import assert from 'node:assert/strict';
import {researchMemoryNote,historyAnswer,previousResearchNotes} from '../src/research-memory.mjs';
import {askCloudflare} from '../src/brain.mjs';

const sample=[{
  title:'Histórico de MushMC',
  summary:'MushMC é citado como um servidor de Minecraft em páginas sobre o assunto.',
  url:'https://example.org/mushmc'
},{
  title:'Outra página sobre MushMC',
  summary:'A página menciona modos de jogo do servidor MushMC.',
  url:'https://example.org/mush'
}];

test('Pesquisa vira memória curta reutilizável em perguntas de continuação',()=>{
  const stored=historyAnswer('Encontrei informações sobre MushMC.', 'O que é MushMC?',sample);
  const history=[{role:'user',content:'O que é MushMC?'},{role:'assistant',content:stored}];
  assert.match(stored,/\[PESQUISA_ANTERIOR\]/);
  assert.match(stored,/\[\/PESQUISA_ANTERIOR\]/);
  assert.ok(stored.length<=800);
  assert.match(previousResearchNotes(history),/servidor de Minecraft/);
  assert.match(previousResearchNotes(history),/MushMC/);
  assert.doesNotMatch(stored,/example\.org/);
  assert.equal(previousResearchNotes([]),'');
});

test('Limite do banco não elimina o marcador da pesquisa',()=>{
  const huge=Array.from({length:4},(_,i)=>({
    title:'Página '+i+' '.repeat(60),
    summary:'A'.repeat(900)
  }));
  const packed=historyAnswer('X'.repeat(1200),'O que é um tema?',huge);
  assert.ok(packed.length<=800);
  assert.ok(packed.endsWith('[/PESQUISA_ANTERIOR]'));
  assert.ok(previousResearchNotes([{role:'assistant',content:packed}]).length>0);
});

test('Modelo recebe memórias de pesquisas mesmo sem uma nova busca',async()=>{
  const original=globalThis.fetch;let body;
  const history=[{role:'user',content:'O que é MushMC?'},
    {role:'assistant',content:historyAnswer('É um servidor de Minecraft.','O que é MushMC?',sample)}];
  try{
    globalThis.fetch=async(_url,opts)=>{
      body=JSON.parse(opts.body);
      return {ok:true,json:async()=>({choices:[{message:{content:'O servidor tem modos de jogo mencionados pelas fontes.'}}]})};
    };
    await askCloudflare({accountId:'test',token:'test',question:'e quais os modos?',
      history,pastResearch:previousResearchNotes(history)});
    assert.match(body.messages[0].content,/PESQUISAS QUE JÁ FORAM FEITAS/);
    assert.match(body.messages[0].content,/MushMC/);
    assert.match(body.messages[0].content,/Não peça para pesquisar novamente/);
    assert.match(body.messages.at(-1).content,/e quais os modos/);
  }finally{globalThis.fetch=original;}
});
