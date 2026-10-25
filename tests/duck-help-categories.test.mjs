import test from 'node:test';
import assert from 'node:assert/strict';
import {ApplicationCommandOptionType} from 'discord.js';
import {commandPayloads,embed,runCommand} from '../src/commands.mjs';
import {
  MEMBER_HELP_SECTIONS,MEMBER_HELP_CATEGORIES,MEMBER_HELP_COMMANDS,memberHelpEmbeds
} from '../src/duck-member-help.mjs';

test('/ajuda mantém visão completa para membros como padrão',()=>{
 const embeds=memberHelpEmbeds(embed);
 assert.equal(embeds.length,MEMBER_HELP_SECTIONS.length);
 assert.equal(embeds.length,4);
 const content=embeds.map(e=>e.data.description).join('\n');
 for(const name of MEMBER_HELP_COMMANDS){
   assert.ok(content.includes('**'+name+'**'),'Comando ausente: '+name);
 }
 assert.match(content,/comandos que membros podem usar/);
 assert.match(content,/categoria/i);
 assert.doesNotMatch(content,/\*\*\/configurar\*\*|\*\*\/jogo parar\*\*|\*\*\/boxpvpadmin\*\*/);
});

test('/ajuda categoria tem quatro filtros e todas as escolhas reais',()=>{
 const registered=commandPayloads().find(x=>x.name==='ajuda');
 const option=registered.options?.find(x=>x.name==='categoria');
 assert.equal(option?.type,ApplicationCommandOptionType.String);
 assert.equal(option?.required,false);
 assert.deepEqual(option.choices.map(x=>x.value),MEMBER_HELP_CATEGORIES.map(x=>x.value));
 const ids=MEMBER_HELP_CATEGORIES.map(x=>x.value);
 assert.deepEqual(ids,['todas','informacoes','perfil','jogos','comunidade']);
 for(let i=1;i<ids.length;i++){
  const cards=memberHelpEmbeds(embed,ids[i]);
  assert.equal(cards.length,1);
  const body=cards[0].data.description;
  for(const [command] of MEMBER_HELP_SECTIONS[i-1].commands){
    assert.ok(body.includes('**'+command+'**'),ids[i]+' omitiu '+command);
  }
  assert.ok(body.length<=4096,'Embed excedeu limite');
 }
});

test('/ajuda sem opção retorna quatro embeds, com filtro retorna um',async()=>{
 const responses=[];
 const store={guildId:'111111111111111111'};
 const base={guildId:store.guildId,commandName:'ajuda',inGuild:()=>true,
  reply:async payload=>{responses.push(payload);}};
 await runCommand({...base,options:{getString:()=>null}},
  {store});
 assert.equal(responses.at(-1).embeds.length,4);
 assert.deepEqual(responses.at(-1).allowedMentions,{parse:[]});
 assert.ok(!('flags' in responses.at(-1)),'Comando /ajuda deve ser visível ao público');
 await runCommand({...base,options:{getString:()=> 'jogos'}},{store});
 assert.equal(responses.at(-1).embeds.length,1);
 assert.match(responses.at(-1).embeds[0].data.title,/Jogos/);
});
