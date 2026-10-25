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

test('coinflip prepara novo vídeo antes do 3-2-1, 3 rodadas e recompensa de 15 moedas',async()=>{
 const sent=[],edits=[],waits=[],calls=[],rendered=[];
 const message={edit:async payload=>{edits.push(payload);return message;}};
 const store={persistent:true,startCoinflip:async(game,host,guest)=>{
   calls.push(['start',game,host,guest]);return {ok:true};
 },finishCoinflip:async(game,winner)=>{
   calls.push(['finish',game,winner]);return {ok:true,credited:true,balance:150};
 }};
 const coin=new DuckCoinflip({
   store,randomSide:(()=>{let i=0;return ()=>[0,1,0][i++];})(),
   sleep:async ms=>{waits.push(ms);},
   renderVideo:async side=>{rendered.push(side);return Buffer.from('MP4'+side);}
 });
 const interaction={
   user:{id:'111111111111111111'},guildId:'333333333333333333',
   guild:{members:{fetch:async()=>({})}},
   options:{getUser:()=>({id:'222222222222222222',bot:false})},
   channel:{send:async payload=>{sent.push(payload);}},
   reply:async payload=>{sent.push(payload);},
   fetchReply:async()=>message
 };
 await coin.challenge(interaction);
 const id=[...coin.games.keys()][0];
 assert.match(sent[0].content,/Melhor de 3 rodadas/);
 assert.match(sent[0].content,/15 moedas/);
 assert.match(sent[0].content,/5 partidas a cada 2 horas/);
 await coin.button({
   user:{id:'222222222222222222'},
   customId:'duckcoin:'+id+':yes',
   update:async payload=>{edits.push(payload);},
   reply:async()=>{throw Error('Não deveria responder');}
 });
 assert.equal(sent.length,1,'apenas o convite cria mensagem');
 assert.deepEqual(rendered,['cara','coroa']);
 assert.equal(edits.filter(x=>/vai girar em \*\*[123]\*\*/.test(x.content)).length,9);
 assert.equal(waits.filter(x=>x===1000).length,9);
 const videoPosts=edits.filter(x=>x.files?.length===1);
 assert.equal(videoPosts.length,3);
 assert.ok(videoPosts.every(x=>x.files[0].name.endsWith('.mp4')));
 assert.ok(videoPosts[0].files[0].name.includes('-cara-'));
 assert.ok(videoPosts[1].files[0].name.includes('-coroa-'));
 assert.ok(videoPosts[2].files[0].name.includes('-cara-'));
 assert.equal(waits.filter(x=>x>=3000).length,3);
 assert.equal(calls[0][0],'start');
 assert.deepEqual(calls[1],['finish',id,'111111111111111111']);
 assert.match(edits.at(-1).content,/15 moedas/);
 assert.match(edits.at(-1).content,/2\*\*  ×  \*\*1/);
 assert.equal(coin.games.size,0);
 assert.equal(coin.players.size,0);
});

test('recusa não consome partidas e usuário de fora não pode aceitar',async()=>{
 let received;
 const game=new DuckCoinflip({
   store:{persistent:true},
   renderVideo:async()=>Buffer.from('mp4')
 });
 const host={user:{id:'111111111111111111'},guildId:'333333333333333333',
  guild:{members:{fetch:async()=>({})}},
  options:{getUser:()=>({id:'222222222222222222',bot:false})},
  channel:{send:async()=>{}},reply:async()=>{},
  fetchReply:async()=>({edit:async()=>{}})};
 await game.challenge(host);
 const id=[...game.games.keys()][0];
 await game.button({user:{id:'444444444444444444'},customId:'duckcoin:'+id+':yes',
 reply:async msg=>{received=msg;}});
 assert.match(received.content,/Somente a pessoa desafiada/);
 assert.equal(received.flags,MessageFlags.Ephemeral);
 await game.button({user:{id:'222222222222222222'},customId:'duckcoin:'+id+':no',
 update:async()=>{}});
 assert.equal(game.games.size,0);
});

test('quota de 2 horas impede começar a partida e não dá recompensa',async()=>{
 const messages=[],calls=[];
 const game=new DuckCoinflip({store:{persistent:true,
   startCoinflip:async()=>({ok:false,reason:'host_limit'}),
   finishCoinflip:async()=>{calls.push('reward');}},
   renderVideo:async side=>Buffer.from(side),sleep:async()=>{}});
 const message={edit:async p=>{messages.push(p);return message}};
 const interaction={
   user:{id:'111111111111111111'},guildId:'333333333333333333',
   guild:{members:{fetch:async()=>({})}},
   options:{getUser:()=>({id:'222222222222222222',bot:false})},
   reply:async()=>{},fetchReply:async()=>message
 };
 await game.challenge(interaction);
 const id=[...game.games.keys()][0];
 await game.button({user:{id:'222222222222222222'},customId:'duckcoin:'+id+':yes',
   update:async()=>{}});
 assert.match(messages.at(-1).content,/Limite de Coinflip/);
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
