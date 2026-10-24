import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags,PermissionFlagsBits} from 'discord.js';
import {newCommands,runNewCommand} from '../src/duck-features.mjs';
import {DuckCoinflip} from '../src/duck-coinflip.mjs';
import {coinMp3,coinPcm} from '../src/duck-coinflip-audio.mjs';
import {BADGES,safeBadgeRole,badgePanel,dailyPanel,DuckBadgeShop}
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

test('a partida de três rodadas é de quem aceita e não debita moedas',async()=>{
 const messages=[];
 const games=new DuckCoinflip({randomSide:(()=>{let n=0;return ()=>[0,1,0][n++];})(),sleep:async()=>{},
   renderVideo:async side=>Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.from(side)])});
 const interaction={
  user:{id:'111111111111111111'},guildId:'333333333333333333',
  guild:{members:{fetch:async()=>({})}},
  options:{getUser:()=>({id:'222222222222222222',bot:false})},
  channel:{send:async msg=>{messages.push(msg);return msg;}},
  reply:async msg=>{messages.push(msg);},
  fetchReply:async()=>({edit:async()=>{}})
 };
 await games.challenge(interaction);
 assert.equal(games.games.size,1);
 const id=[...games.games.keys()][0];
 const challenge=messages[0].content;
 assert.match(challenge,/três|3 rodadas/i);
 assert.match(challenge,/ninguém aposta/i);
 let outcome;
 const approved={
  user:{id:interaction.options.getUser().id},
  customId:'duckcoin:'+id+':yes',
  update:async content=>{outcome=content;},
  reply:async content=>{outcome=content;}
 };
 const run=games.run.bind(games);
 let finalized;
 games.run=async game=>{finalized=await run(game);};
 await games.button(approved);
 for(let i=0;i<60&&!messages.some(x=>/RESULTADO DO COINFLIP/.test(x.content));i++)
   await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(messages.filter(x=>/RODADA \d\/3/.test(x.content)).length,3);
 const videos=messages.filter(x=>/RODADA \d\/3/.test(x.content));
 assert.equal(videos.every(x=>x.files?.length===1&&x.files[0]?.name.endsWith('.mp4')),true);
 assert.ok(videos[0].files[0].name.includes('-cara-'));
 assert.ok(videos[1].files[0].name.includes('-coroa-'));
 assert.ok(videos[2].files[0].name.includes('-cara-'));
 assert.equal(videos.every(x=>!x.content.includes('apostou')),true);
 assert.match(messages.at(-1).content,/\*\*2\*\* × \*\*1\*\*/);
 assert.match(messages.at(-1).content,/Nenhuma moeda foi apostada/);
 assert.equal(games.games.size,0);
 assert.equal(games.players.size,0);
 assert.ok(finalized===undefined);
 games.shutdown();
});

test('não pode aceitar desafio de outra pessoa',async()=>{
 let received;
 const flip=new DuckCoinflip();
 const host={user:{id:'111111111111111111'},guildId:'333333333333333333',
  guild:{members:{fetch:async()=>({})}},
  options:{getUser:()=>({id:'222222222222222222',bot:false})},
  channel:{send:async()=>{}},reply:async()=>{},fetchReply:async()=>({edit:async()=>{}})};
 await flip.challenge(host);
 const id=[...flip.games.keys()][0];
 await flip.button({user:{id:'444444444444444444'},customId:'duckcoin:'+id+':yes',
 reply:async msg=>{received=msg;}});
 assert.match(received.content,/Somente a pessoa desafiada/);
 assert.equal(received.flags,MessageFlags.Ephemeral);
 flip.shutdown();
});

test('painéis de loja e diário usam IDs permanentes nos botões',()=>{
 const badges=[
 {badge_key:'bronze',label:'Emblema Bronze',price:100,role_id:'666666666666666666'},
 {badge_key:'ouro',label:'Emblema Ouro',price:300,role_id:'777777777777777777'}];
 const shop=badgePanel(badges);
 assert.equal(shop.components.length,1);
 assert.equal(shop.components[0].components[0].data.custom_id,'duckbadge:bronze');
 assert.equal(shop.components[0].components[1].data.custom_id,'duckbadge:ouro');
 assert.match(shop.content,/canais exclusivos/);
 assert.equal(dailyPanel().components[0].components[0].data.custom_id,'duckdaily:claim');
 assert.match(dailyPanel().content,/20 moedas/);
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
