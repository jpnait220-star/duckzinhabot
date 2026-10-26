import test from 'node:test';
import assert from 'node:assert/strict';
import {ApplicationCommandOptionType} from 'discord.js';
import {commandPayloads,embed} from '../src/commands.mjs';
import {MEMBER_HELP_COMMANDS,MEMBER_HELP_SECTIONS,memberHelpEmbeds} from '../src/duck-member-help.mjs';

// Validate every public slash-command path against /ajuda; new public commands
// must update the help. Admin-only commands must never appear in the help.
const adminCommands=new Set([
 'configurar','ensinar','ensinamentos','boxpvpadmin','painel',
 'falar','novidade','sugestao','modlog','diario','cargosreacao'
]);
const restrictedSubs=new Map([
 ['duckzinha',new Set(['reset','testevoz','voice'])],
 ['jogo',new Set(['parar'])],
 ['emblema',new Set(['configurar','publicar'])],
 ['evento',new Set(['criar','cancelar'])]
]);
const slashCommands=commandPayloads().filter(c=>!c.type||c.type===1);
const availablePaths=[];
const restrictedPaths=[];
for(const command of slashCommands){
 const subs=(command.options||[]).filter(opt=>
  opt.type===ApplicationCommandOptionType.Subcommand);
 const base='/'+command.name;
 if(adminCommands.has(command.name)){
  restrictedPaths.push(base,...subs.map(sub=>base+' '+sub.name));
 }else if(subs.length){
  for(const sub of subs){
   const path=base+' '+sub.name;
   if(restrictedSubs.get(command.name)?.has(sub.name))restrictedPaths.push(path);
   else availablePaths.push(path);
  }
 }else availablePaths.push(base);
}
test('/ajuda exibe todos os caminhos disponíveis para membros',()=>{
 const help=new Set(MEMBER_HELP_COMMANDS);
 assert.equal(help.size,MEMBER_HELP_COMMANDS.length,'Comando duplicado no /ajuda');
 assert.deepEqual([...help].sort(),[...availablePaths].sort(),
  'Um comando de membro foi adicionado/removido e /ajuda precisa acompanhar');
});
test('/ajuda não divulga comandos restritos de administração',()=>{
 const displayed=MEMBER_HELP_COMMANDS;
 for(const blocked of restrictedPaths){
  assert.ok(!displayed.includes(blocked),'Comando restrito no /ajuda: '+blocked);
 }
 for(const group of MEMBER_HELP_SECTIONS){
  assert.ok(group.commands.length>0);
  for(const [path,description] of group.commands)
   assert.ok(path.startsWith('/')&&description.length>=8);
 }
});
test('Discord aceita todos os quatro embeds do /ajuda sem exceder limites',()=>{
 const cards=memberHelpEmbeds(embed);
 assert.equal(cards.length,4);
 const total=cards.reduce((sum,x)=>sum+x.data.description.length+(x.data.title||'').length,0);
 assert.ok(total<6000,'A soma das descrições ultrapassaria o limite da mensagem');
 for(const card of cards){
  assert.ok(card.data.description.length<=4096,'Embed excede o limite');
  assert.ok(card.data.description.length>=150,'Embed vazio');
 }
 const summary=cards.map(x=>x.data.description).join('\n');
 for(const keyword of [
  'Jogar novamente','Jogo da Velha','Pedra-Papel-Tesoura',
  '/lembrete criar','/duckzinha entrar','/afk','/emblema loja',
  '20 moedas','5 moedas','/resumo','/sugerir','/evento listar'
 ])assert.ok(summary.includes(keyword),'Ajuda omitiu '+keyword);
 assert.ok(!summary.includes('**/diario publicar**'));
 assert.ok(!summary.includes('**/jogo parar**'));
});
