import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags,PermissionFlagsBits} from 'discord.js';
import {newCommands,runNewCommand} from '../src/duck-features.mjs';
import {DuckCoinflip} from '../src/duck-coinflip.mjs';
import {coinMp3,coinPcm} from '../src/duck-coinflip-audio.mjs';
import {BADGES,safeBadgeRole,badgePanel,dailyPanel,publishedPanel,DuckBadgeShop}
  from '../src/duck-badges.mjs';

test('RPG removido; coinflip sem campo de aposta, transferências e loja disponíveis',()=>{
 const commands=newCommands();
 assert.equal(commands.some(x=>x.name==='pato'||x.name==='batalha'),false);
 const coin=commands.find(x=>x.name==='coinflip');
 assert.ok(coin);
 assert.deepEqual(coin.options.map(o=>o.name),['jogador']);
 assert.match(coin.description,/sem apostas/);
 const transfer=commands.find(x=>x.name==='enviar');
 assert.deepEqual(transfer.options.map(o=>o.name),['jogador','valor']);
 assert.equal(transfer.options[1].min_value,1);
 assert.equal(transfer.options[1].max_value,500);
 const badges=commands.find(x=>x.name==='emblema');
 assert.deepEqual(badges.options.map(o=>o.name),['loja','publicar','configurar']);
 assert.ok(commands.some(x=>x.name==='diario'));
});

test('efeitos de moeda geram WAV PCM diferentes por lado e MP3 válido',async()=>{
 const heads=coinPcm('cara'),tails=coinPcm('coroa');
 assert.equal(heads.rate,16000);assert.equal(heads.pcm.length,tails.pcm.length);
 assert.notDeepEqual(heads.pcm,tails.pcm);
 const a=await coinMp3('cara'),b=await coinMp3('coroa');
 assert.ok(a.length>500);assert.ok(b.length>500);
 assert.notDeepEqual(a,b);
 assert.ok(a.subarray(0,3).toString('ascii')==='ID3'||a[0]===0xff);
 assert.equal(await coinMp3('cara'),a);
});

test('Coinflip envia três resultados em texto, sem imagens, e botão Jogar novamente',async()=>{
 const replies=[],updates=[],calls=[];
 const message={edit:async payload=>{updates.push(payload);return message;}};
 const game=new DuckCoinflip({
  store:{persistent:true,startCoinflip:async(id,host,guest)=>{
    calls.push(['start',id,host,guest]);return {ok:true};
  },finishCoinflip:async(id,winner)=>{
    calls.push(['finish',id,winner]);return {ok:true,credited:true,balance:115};
  }},
  randomSide:(()=>{let i=0;return ()=>[0,1,0][i++];})(),
  renderImage:()=>{throw Error('não gerar imagem')}
 });
 const interaction={
  user:{id:'111111111111111111'},guildId:'333333333333333333',
  guild:{members:{fetch:async()=>({})}},
  options:{getUser:()=>({id:'222222222222222222',bot:false})},
  reply:async payload=>{replies.push(payload);},
  fetchReply:async()=>message
 };
 await game.challenge(interaction);
 assert.match(replies[0].content,/Melhor de 3 rodadas/);
 assert.match(replies[0].content,/15 moedas/);
 assert.equal(replies[0].components.length,1);
 const id=[...game.games.keys()][0];
 await game.button({
  user:{id:'222222222222222222'},customId:'duckcoin:'+id+':yes',
  update:async payload=>{updates.push(payload);},
  reply:async()=>{throw Error('não deveria responder');}
 });
 assert.equal(replies.length,1);
 assert.equal(updates.some(x=>x.files?.length),false);
 const result=updates.find(x=>x.content?.includes('PLACAR FINAL'));
 assert.equal(result.components[0].components[0].data.custom_id,
  'duckagain:coin:111111111111111111:222222222222222222');
 assert.match(result.content,/1ª rodada/);
 assert.match(result.content,/2ª rodada/);
 assert.match(result.content,/3ª rodada/);
 assert.match(result.content,/15 moedas/);
 assert.doesNotMatch(updates.map(x=>x.content).join(''),/girando|vai girar em \*\*[123]\*\*/i);
 assert.deepEqual(calls[1],['finish',id,'111111111111111111']);
 assert.equal(game.games.size,0);
 assert.equal(game.players.size,0);
});

test('desafio recusado não registra partida, e visitantes não podem aceitar',async()=>{
 let answer;
 const game=new DuckCoinflip({store:{persistent:true}});
 await game.challenge({
  user:{id:'111111111111111111'},guildId:'333333333333333333',
  guild:{members:{fetch:async()=>({})}},
  options:{getUser:()=>({id:'222222222222222222',bot:false})},
  reply:async()=>{},fetchReply:async()=>({edit:async()=>{}})
 });
 const id=[...game.games.keys()][0];
 await game.button({user:{id:'444444444444444444'},customId:'duckcoin:'+id+':yes',
  reply:async msg=>{answer=msg;}});
 assert.match(answer.content,/Somente a pessoa desafiada/);
 assert.equal(answer.flags,MessageFlags.Ephemeral);
 await game.button({user:{id:'222222222222222222'},customId:'duckcoin:'+id+':no',
  update:async()=>{}});
 assert.equal(game.games.size,0);
});

test('limite de partidas impede prêmio e oferece revanche, sem imagem',async()=>{
 const changes=[],calls=[];
 const game=new DuckCoinflip({
  store:{persistent:true,startCoinflip:async()=>({ok:false,reason:'host_limit'}),
    finishCoinflip:async()=>{calls.push('reward');}},
  renderImage:()=>{throw Error('não pode gerar imagem se bloqueado');}
 });
 const message={edit:async change=>{changes.push(change);return message}};
 await game.challenge({
  user:{id:'111111111111111111'},guildId:'333333333333333333',
  guild:{members:{fetch:async()=>({})}},
  options:{getUser:()=>({id:'222222222222222222',bot:false})},
  reply:async()=>{},fetchReply:async()=>message
 });
 const id=[...game.games.keys()][0];
 await game.button({user:{id:'222222222222222222'},customId:'duckcoin:'+id+':yes',
  update:async()=>{}});
 assert.match(changes.at(-1).content,/Limite de Coinflip/);
 assert.equal(changes.at(-1).components[0].components[0].data.label,'Jogar novamente');
 assert.equal(calls.length,0);
 assert.equal(game.players.size,0);
});
test('painéis de loja e diário usam IDs permanentes nos botões',()=>{
 const badges=[
 {badge_key:'bronze',label:'Emblema Bronze',price:100,role_id:'666666666666666666'},
 {badge_key:'ouro',label:'Emblema Ouro',price:300,role_id:'777777777777777777'}];
 const shop=badgePanel(badges);
 assert.equal(shop.components.length,1);
 assert.equal(shop.components[0].components[0].data.custom_id,'duckbadge:bronze');
 assert.equal(shop.components[0].components[1].data.custom_id,'duckbadge:ouro');
 assert.match(shop.content,/cargo exclusivo/);
 assert.match(shop.content,/Loja de Emblemas/);
 assert.doesNotMatch(shop.content,/LOJA DE EMBLEMAS DA DUCKZINHA/i);
 assert.doesNotMatch(shop.content,/@everyone/);
 assert.deepEqual(shop.allowedMentions,{parse:[]});
 assert.equal(dailyPanel().components[0].components[0].data.custom_id,'duckdaily:claim');
 assert.match(dailyPanel().content,/20 moedas/);
 assert.match(dailyPanel().content,/Recompensa Diária/);
 assert.doesNotMatch(dailyPanel().content,/@everyone/);
 assert.deepEqual(dailyPanel().allowedMentions,{parse:[]});
 const onPublish=publishedPanel(shop);
 assert.match(onPublish.content,/\n\n@everyone$/);
 assert.deepEqual(onPublish.allowedMentions,{parse:['everyone']});
 assert.equal(onPublish.components[0].components[0].data.custom_id,'duckbadge:bronze');
 assert.equal(publishedPanel(dailyPanel()).allowedMentions.parse[0],'everyone');
 assert.match(publishedPanel(dailyPanel()).content,/\n\n@everyone$/);
 assert.equal(Object.keys(BADGES).length,4);
});

test('cargos de administração não podem ser vendidos',()=>{
 const guild={id:'333333333333333333'};
 const role=(privileged)=>({
  id:'555555555555555555',guild,managed:false,name:'Role',
  permissions:{has:flag=>privileged&&flag===PermissionFlagsBits.Administrator}
 });
 const me={permissions:{has:flag=>flag===PermissionFlagsBits.ManageRoles},
  roles:{highest:{comparePositionTo:()=>5}}};
 assert.equal(safeBadgeRole(guild,role(true),me).ok,false);
 assert.equal(safeBadgeRole(guild,role(false),me).ok,true);
 assert.equal(safeBadgeRole(guild,role(false),{...me,roles:{highest:{comparePositionTo:()=>0}}}).ok,false);
 assert.equal(safeBadgeRole(guild,role(false),{...me,permissions:{has:()=>false}}).ok,false);
});

test('o usuário recebe 20 moedas uma vez ao dia pelo botão',async()=>{
 let reply;
 const shop=new DuckBadgeShop({store:{persistent:true,claimDaily:async()=>({ok:true,earned:20,balance:120})}});
 await shop.handleDaily({user:{id:'u'},reply:async p=>{reply=p;}});
 assert.match(reply.content,/20 moedas/);
 assert.match(reply.content,/120 moedas/);
 assert.equal(reply.flags,MessageFlags.Ephemeral);
});
