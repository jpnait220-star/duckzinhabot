import test from 'node:test';
import assert from 'node:assert/strict';
import {formatChannelContext} from '../src/brain.mjs';
import {coinflipImage} from '../src/duck-coinflip-image.mjs';
import {
 publicMessageText,isContextualResearchRequest,resolveResearchSubject
} from '../src/duck-channel-context.mjs';

const now=Date.parse('2026-10-25T18:00:00Z');
const member=(id,content,time,options={})=>({
 id:options.id||id+time,author:{id,username:options.username||id,bot:Boolean(options.bot)},
 createdTimestamp:now+time,content,embeds:options.embeds||[],
 interactionMetadata:options.interactionMetadata
});
test('contexto público inclui membros, resposta da Duckzinha, outros bots e embed de comandos',()=>{
 const messages=[
  member('userA','Você conhece o DuckCapture?',-22000),
  member('Duckzinha','Não tenho informações sobre a versão mais nova.',-17000,{bot:true}),
  member('outroBot','',-12000,{bot:true,
   embeds:[{title:'📦 Atualização do DuckCapture',description:'Disponível para baixar no site.'}],
   interactionMetadata:{name:'novidades'}}),
  member('userB','Podemos conferir isso?',-6000)
 ];
 const text=formatChannelContext(messages,'Duckzinha',now);
 assert.match(text,/Você conhece o DuckCapture/);
 assert.match(text,/Duckzinha \(Duckzinha\)/);
 assert.match(text,/Atualização do DuckCapture/);
 assert.match(text,/comando \/novidades/);
 assert.match(text,/userB/);
});
test('pedido curto pesquisar isso retoma a pergunta anterior do mesmo membro',()=>{
 const messages=[
  member('userA','O que é o mod DuckModels?',-13000),
  member('Duckzinha','Não sei ao certo, quer que eu pesquise?',-11000,{bot:true}),
  member('userB','Alguém sabe como instalar?',-6000)
 ];
 for(const phrase of ['pesquisa','pesquise isso','pode pesquisar isso','busca sobre isso','procura aí']){
  assert.equal(isContextualResearchRequest(phrase),true,phrase);
  assert.equal(resolveResearchSubject(phrase,messages,{
    authorId:'userA',botId:'Duckzinha',now
  }),'O que é o mod DuckModels?',phrase);
 }
 assert.equal(isContextualResearchRequest('pesquise os shaders do Minecraft'),false);
});
test('sem tópico não pesquisa palavra isso',()=>{
 const s=resolveResearchSubject('pesquisa isso',[],{authorId:'u',botId:'b',now});
 assert.equal(s,'');
});
test('mensagens com embeds são transformadas em contexto, com dados limitados e sem pings',()=>{
 const message=member('bot','','-10',{bot:true,embeds:[{
  title:'Título de atualização',description:'@everyone '+
    'x'.repeat(800),fields:[{name:'Status',value:'Disponível'}]
 }]});
 const content=publicMessageText(message);
 assert.ok(content.length<=420);
 assert.doesNotMatch(content,/@everyone/);
 assert.match(content,/Status/);
});
test('coinflip renderiza uma PNG estática válida com ambos os lados',()=>{
 const a=coinflipImage(),b=coinflipImage();
 assert.equal(a,b,'cache da mesma imagem');
 assert.equal(a.toString('hex',0,8),'89504e470d0a1a0a');
 assert.equal(a.readUInt32BE(16),1024);
 assert.equal(a.readUInt32BE(20),288);
 assert.ok(a.length>1024&&a.length<4*1024*1024);
});
