import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES,MOVES,SHOP,TM_ITEMS,defaultMoves,normalizedPet,calculateHit,
  effectiveness,levelUp,xpNeeded,maxHP,MAX_LEVEL} from '../src/duck-battle-data.mjs';
import {DuckBattleArena} from '../src/duck-battle-arena.mjs';
import {newCommands,runNewCommand} from '../src/duck-features.mjs';

test('Duck RPG: six types, strengths and weaknesses are predictable',()=>{
 assert.equal(Object.keys(TYPES).length,6);
 assert.equal(effectiveness('agua','fogo'),1.5);
 assert.equal(effectiveness('fogo','agua'),.75);
 assert.equal(effectiveness('natureza','agua'),1.5);
 assert.equal(effectiveness('eletrico','agua'),1.5);
 assert.equal(effectiveness('gelo','natureza'),1.5);
 assert.equal(effectiveness('normal','eletrico'),1);
 assert.equal(defaultMoves('fogo')[2],'brasa');
 const hit=calculateHit({type:'agua',level:8},{type:'fogo',level:8},'jato',{random:()=>.8});
 assert.ok(hit.damage>15);assert.equal(hit.effect,1.5);
 const guarded=calculateHit({type:'agua',level:8},{type:'fogo',level:8},'jato',
   {guard:true,random:()=>.8});
 assert.ok(guarded.damage<hit.damage);
 const crit=calculateHit({type:'agua',level:8},{type:'fogo',level:8},'jato',
   {random:()=>0});
 assert.ok(crit.damage>hit.damage);
});

test('Duck RPG: shop and TMs are all valid and provide unique moves',()=>{
 for(const [item,move] of Object.entries(TM_ITEMS)){
  assert.ok(SHOP[item]);
  assert.equal(SHOP[item].move,move);
  assert.ok(MOVES[move].power>15);
 }
 assert.ok(SHOP.racao.cost<SHOP.super_racao.cost);
 assert.equal(SHOP.essencia.kind,'type');
 const p=normalizedPet({duck_type:'eletrico',moves:['bicada','asas_rapidas','faisca'],level:4});
 assert.deepEqual(p.moves,['bicada','asas_rapidas','faisca']);
 assert.equal(maxHP(p.level),82);
 assert.equal(xpNeeded(1),40);
 const raised=levelUp({level:1,xp:0},140);
 assert.equal(raised.level,3);
 assert.ok(raised.xp<xpNeeded(raised.level));
 assert.equal(levelUp({level:MAX_LEVEL,xp:0},999).level,MAX_LEVEL);
});

test('Discord /pato offers type, shop, buy, train and TM options',()=>{
 const spec=newCommands().find(c=>c.name==='pato');
 assert.ok(spec);
 const names=spec.options.map(x=>x.name);
 assert.deepEqual(names,['perfil','tipo','golpes','loja','comprar','usar','tm']);
 assert.equal(spec.options.find(x=>x.name==='tipo').options[0].choices.length,6);
 assert.equal(spec.options.find(x=>x.name==='comprar').options[0].choices.length,9);
 const tm=spec.options.find(x=>x.name==='tm');
 assert.equal(tm.options[1].min_value,1);
 assert.equal(tm.options[1].max_value,3);
 const battle=newCommands().find(c=>c.name==='batalha');
 assert.match(battle.description,/turnos/);
});

function fakeArena(){
 const responses=[],awards=[];
 const players=new Map([
  ['duck1',{duck_type:'agua',type_chosen:true,level:4,xp:0,moves:['bicada','asas_rapidas','jato']}],
  ['duck2',{duck_type:'fogo',type_chosen:true,level:3,xp:0,moves:['bicada','asas_rapidas','brasa']}]
 ]);
 let now=10_000;
 const timers=[];
 const arena=new DuckBattleArena({
  store:{persistent:true,getDuck:async id=>players.get(id),
    awardDuckBattleXp:async(id,key,xp)=>{awards.push({id,key,xp});return {ok:true};}},
  now:()=>now,random:()=>.8,
  setTimer:(fn,ms)=>{const timer={fn,ms,unref(){}};timers.push(timer);return timer;},
  clearTimer:()=>{}
 });
 const message={async edit(payload){responses.push({kind:'edit',payload});}};
 const challenger={
  guildId:'g',channelId:'ch',user:{id:'duck1'},guild:{members:{fetch:async()=>({})}},
  options:{getUser:()=>({id:'duck2',bot:false})},
  reply:async payload=>responses.push({kind:'challenge',payload}),
  fetchReply:async()=>message
 };
 return {
  arena,responses,awards,timers,challenger,
  button:(actor,button)=>({
   user:{id:actor},customId:'duckbattle:'+arena.active.get('duck1')+':'+button,
   deferUpdate:async()=>responses.push({kind:'defer'}),
   editReply:async payload=>responses.push({kind:'editReply',payload}),
   update:async payload=>responses.push({kind:'update',payload}),
   reply:async payload=>responses.push({kind:'private',payload})
  }),
  time:delta=>{now+=delta;}
 };
}

test('Challenge has one active battle, target accepts, players alternate and cannot hijack turns',async()=>{
 const t=fakeArena();
 await t.arena.challenge(t.challenger);
 assert.equal(t.arena.battles.size,1);
 assert.equal(t.arena.active.get('duck1'),t.arena.active.get('duck2'));
 const id=t.arena.active.get('duck1');
 await t.arena.action(t.button('duck1','accept'));
 assert.equal(t.responses.at(-1).kind,'private');
 assert.equal(t.arena.battles.get(id).phase,'inviting');
 await t.arena.action(t.button('duck2','accept'));
 let battle=t.arena.battles.get(id);
 assert.equal(battle.phase,'playing');
 assert.equal(battle.players[0].max,82);
 assert.equal(battle.turn,0);
 assert.equal(t.responses.at(-1).kind,'editReply');
 await t.arena.action(t.button('outsider','0'));
 assert.equal(t.responses.at(-1).kind,'private');
 await t.arena.action(t.button('duck1','2'));
 assert.equal(battle.turn,1);
 assert.ok(battle.players[1].hp<battle.players[1].max);
 assert.match(t.responses.at(-1).payload.content,/Jato de Água/);
 await t.arena.action(t.button('duck1','2'));
 assert.equal(t.responses.at(-1).kind,'private');
 await t.arena.action(t.button('duck2','guard'));
 assert.equal(battle.turn,0);
 assert.equal(battle.players[1].shield,true);
 const before=battle.players[1].hp;
 await t.arena.action(t.button('duck1','2'));
 assert.ok(before-battle.players[1].hp<19);
 assert.equal(battle.players[1].shield,false);
 t.arena.shutdown();
 assert.equal(t.arena.battles.size,0);
});

test('Battle ends by forfeiture without transferring coins',async()=>{
 const t=fakeArena();
 await t.arena.challenge(t.challenger);
 await t.arena.action(t.button('duck2','accept'));
 await t.arena.action(t.button('duck2','forfeit'));
 assert.equal(t.arena.battles.size,0);
 assert.equal(t.arena.active.size,0);
 assert.match(t.responses.at(-1).payload.content,/venceu/);
 assert.equal(t.awards.length,0);
});

test('Only one active challenge per member at once',async()=>{
 const t=fakeArena();
 await t.arena.challenge(t.challenger);
 await t.arena.challenge(t.challenger);
 assert.equal(t.arena.battles.size,1);
 assert.match(t.responses.at(-1).payload.content,/já está em outra batalha/);
 t.arena.shutdown();
});

test('/pato compra item through persistent store, not from user-supplied price',async()=>{
 let itemBought;
 const mock={
   inGuild:()=>true,guildId:'g',commandName:'pato',
   user:{id:'duck1'},options:{getSubcommand:()=> 'comprar',getString:()=> 'racao'},
   reply:async v=>{mock.sent=v}
 };
 const community={pato:async i=>{
   itemBought=SHOP[i.options.getString('item',true)].cost;
   await i.reply({content:'ok'});
 }};
 assert.equal(await runNewCommand(mock,{store:{guildId:'g'},community}),true);
 assert.equal(itemBought,18);
 assert.equal(mock.sent.content,'ok');
});
