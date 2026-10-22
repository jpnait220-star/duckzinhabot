import test from 'node:test';
import assert from 'node:assert/strict';
import {researchTopic,wikipediaResearch} from '../src/research.mjs';

test('Pesquisa nomes e assuntos factuais, mas não cumprimentos',()=>{
  assert.equal(researchTopic('quem é Neymarjr?'),'Neymar Jr');
  assert.equal(researchTopic('@Duckzinha quem foi Ayrton Senna?'),'Ayrton Senna');
  assert.equal(researchTopic('pesquise sobre a Amazônia'),'Amazônia');
  assert.equal(researchTopic('oi tudo bem?'),null);
});

test('Pesquisa pública retorna resumo e endereço seguro sem precisar de chave',async()=>{
  const previous=globalThis.fetch;
  let called='';
  globalThis.fetch=async(url,options)=>{
    called=String(url);
    assert.match(options.headers['User-Agent'],/DuckzinhaDiscordBot/);
    return {ok:true,json:async()=>({query:{pages:[{
      title:'Neymar',
      extract:'Neymar da Silva Santos Júnior é um futebolista brasileiro.',
      index:1,
      fullurl:'https://pt.wikipedia.org/wiki/Neymar'
    }]}})};
  };
  try{
    const result=await wikipediaResearch('quem é Neymarjr?');
    assert.equal(result?.title,'Neymar');
    assert.match(result.summary,/futebolista brasileiro/);
    assert.equal(result.url,'https://pt.wikipedia.org/wiki/Neymar');
    assert.match(called,/gsrsearch=Neymar\+Jr/);
  }finally{
    globalThis.fetch=previous;
  }
});
