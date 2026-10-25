import {randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} from 'discord.js';
import {DuckCoinflip} from './duck-coinflip.mjs';
import {DuckRockPaperScissors} from './duck-rps.mjs';
import {DuckTicTacToe} from './duck-tictactoe.mjs';
import {DuckBadgeShop} from './duck-badges.mjs';
import {EXTRA_MINIGAMES} from './duck-extra-minigames.mjs';
import {GUESS_GAMES} from './duck-guess-games.mjs';

const priv=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
export function naturalTeaching(text){
 const t=String(text||'').trim();
 if(t.length>270||/https?:\/\/|<@|@everyone|@here|\b(?:senha|token|cpf|endereço|telefone|pix|cart[aã]o|chave api)\b/i.test(t))return null;
 const m=t.match(/^(?:duckzinha[,]?\s*)?(?:(?:aprenda|aprende|guarda|lembra|lembre|anota)(?:\s+que)?|(?:vou\s+te\s+ensinar)(?:\s+que)?)\s+(.+)$/i);
 if(!m)return null;
 const body=m[1].replace(/[.!?]+$/,'').trim();
 const pair=body.match(/^(.{3,65}?)\s+(?:é|eh|significa|quer dizer|tem|fica em)\s+(.{4,175})$/i);
 if(!pair)return null;
 const topic=pair[1].trim().toLowerCase();
 const value=(pair[1]+' '+body.slice(pair[1].length).trim()).slice(0,240);
 if(/^(eu|meu|minha|sou|gosto|prefiro|o meu|a minha)\b/i.test(topic))return {kind:'personal',topic,value};
 if(!/^[\p{L}\p{N} _\-]{3,65}$/u.test(topic))return null;
 return {kind:'server',topic,value};
}
export const SAFE_GAMES=[
 {name:'verdadeiro-ou-falso',label:'Verdadeiro ou falso',question:'No Minecraft, 15 estantes permitem encantamentos no nível 30.',options:['Verdadeiro','Falso'],answer:0},
 {name:'adivinhe-o-mob',label:'Adivinhe o mob',question:'Sou verde, faço barulho e explodo quando chego perto. Quem sou?',options:['Zumbi','Creeper','Slime','Enderman'],answer:1},
 {name:'matematica',label:'Matemática rápida',question:'Quanto é (8 × 7) + 12?',options:['62','68','76','84'],answer:1},
 {name:'desafio-mine',label:'Minecraft',question:'Qual encantamento impulsiona o jogador na água com tridente?',options:['Lealdade','Canalização','Correnteza','Inquebrável'],answer:2},
 {name:'geografia',label:'Geografia',question:'Qual é a capital de Pernambuco?',options:['Salvador','Maceió','Recife','Natal'],answer:2},
 {name:'anime',label:'Desafio Anime',question:'Em Naruto, qual vila Naruto chama de lar?',options:['Vila da Areia','Vila da Folha','Vila da Névoa','Vila da Pedra'],answer:1},
 {name:'emoji',label:'Desafio Emoji',question:'Qual jogo é representado por ⛏️ 🧱 💎?',options:['Minecraft','Roblox','Among Us','Fortnite'],answer:0},
 {name:'logica',label:'Lógica Rápida',question:'Se 3 patos põem 3 ovos em 3 dias, quantos ovos 6 patos põem em 3 dias?',options:['3','6','9','12'],answer:1},
 ...EXTRA_MINIGAMES,
 ...GUESS_GAMES
];

export class DuckCommunity{
 constructor({store,extras}={}){this.store=store;this.extras=extras;this.coin=new DuckCoinflip({store});this.badges=new DuckBadgeShop({store});this.rps=new DuckRockPaperScissors();this.ttt=new DuckTicTacToe();this.games=new Map();this.recentMinigames=new Map();}
 async awardTalk(userId,eventKey){
   if(!this.store?.persistent)return null;
   try{return await this.store.awardCoins(userId,'conversa:'+eventKey,'conversa',3,30);}
   catch(err){console.warn('[Duckzinha] moedas conversa: '+err.message);return null;}
 }
 async awardTeach(userId,eventKey){
   if(!this.store?.persistent)return null;
   try{return await this.store.awardCoins(userId,'ensino:'+eventKey,'ensino',8,40);}
   catch(err){console.warn('[Duckzinha] moedas ensino: '+err.message);return null;}
 }
 async economy(interaction){
   if(!this.store?.persistent)return interaction.reply(priv('As moedas precisam do Supabase configurado.'));
   const sub=interaction.commandName==='moedas'?'saldo':'afk';
   if(sub==='saldo'){
     const n=await this.store.getBalance(interaction.user.id);
     return interaction.reply(priv('🪙 Você tem '+n+' moedas de pato. São pontos do bot, sem valor real ou apostas.'));
   }
   if(sub==='afk'){
     const stage=interaction.options.getString('acao',true);
     if(stage==='iniciar'){
       const started=await this.store.startAfk(interaction.user.id);
       return interaction.reply(priv(started?'💤 AFK iniciado. Após 10 minutos use /afk resgatar para ganhar 5 moedas.':'Seu AFK já está em andamento.'));
     }
     const result=await this.store.claimAfk(interaction.user.id);
     return interaction.reply(priv(result.ok?'🪙 Você recebeu 5 moedas de pato! Saldo: '+result.balance+'.':
       result.reason==='early'?'⏳ Ainda não passaram 10 minutos.':
       'Nenhuma recompensa disponível. Use /afk iniciar.'));
   }
 }
 async game(interaction){
   const id=randomUUID().slice(0,12);
   const kind=interaction.options.getString('tipo')||'aleatorio';
   if(kind==='pedra-papel-tesoura')return this.rps.start(interaction);
   if(kind==='jogo-da-velha')return this.ttt.start(interaction);
   if(kind==='quiz-streak'){
     if(!this.extras?.startGame)return interaction.reply(priv('O Quiz Streak não está disponível agora.'));
     return this.extras.startGame(interaction,{streakMode:true});
   }
   const key=interaction.guildId+':'+interaction.channelId;
   if(this.games.has(key)&&Date.now()-this.games.get(key).time<30000)
     return interaction.reply(priv('Já existe um minigame ativo neste canal.'));
   const available=kind==='aleatorio'?SAFE_GAMES:SAFE_GAMES.filter(x=>x.name===kind);
   if(!available.length)return interaction.reply(priv('Essa categoria ainda não está disponível.'));
   // As últimas 12 perguntas do canal ficam excluídas da seleção, até esgotar as alternativas.
   const recent=this.recentMinigames.get(key)||[];
   const unused=available.filter(item=>!recent.includes(item.name+':'+item.question));
   const selection=unused.length?unused:available;
   const q=selection[Math.floor(Math.random()*selection.length)];
   const used=[...recent,q.name+':'+q.question].slice(-12);
   this.recentMinigames.set(key,used);
   this.games.set(key,{id,q,time:Date.now(),answers:new Map()});
   const row=new ActionRowBuilder().addComponents(q.options.map((v,i)=>
     new ButtonBuilder().setCustomId('duckmini:'+key+':'+id+':'+i).setLabel(v).setStyle(ButtonStyle.Primary)));
   await interaction.reply({content:'🦆 '+q.label+'\n'+q.question+'\n⏳ 30 segundos. Todos podem participar!',components:[row],allowedMentions:{parse:[]}});
   const message=await interaction.fetchReply();
   const timer=setTimeout(async()=>{
     const current=this.games.get(key);if(current?.id!==id)return;
     this.games.delete(key);
     const winners=[...current.answers].filter(([,v])=>v===q.answer).map(([uid])=>'<@'+uid+'>');
     await message.edit({content:'🏁 Resultado: '+q.label+'\n✅ '+q.options[q.answer]+'\n🏆 Acertaram: '+
       (winners.length?winners.slice(0,20).join(', '):'ninguém'),components:[],allowedMentions:{parse:[]}}).catch(()=>{});
   },30000);timer.unref?.();
 }
 async rpsButton(interaction){return this.rps.choose(interaction);}
 async tttButton(interaction){return this.ttt.choose(interaction);}
 async gameButton(interaction){
   const parts=interaction.customId.split(':');
   const choice=Number(parts.pop()),id=parts.pop(),key=parts.slice(1).join(':');
   const game=this.games.get(key);
   if(!game||game.id!==id||Date.now()-game.time>30000)return interaction.reply(priv('Rodada encerrada.'));
   if(game.answers.has(interaction.user.id))return interaction.reply(priv('Você já respondeu!'));
   if(!Number.isInteger(choice)||choice<0||choice>=game.q.options.length)return interaction.reply(priv('Resposta inválida.'));
   game.answers.set(interaction.user.id,choice);
   return interaction.reply(priv('✅ Resposta registrada. O resultado sai no canal ao fim da rodada.'));
 }


 async coinFlip(interaction){return this.coin.challenge(interaction);}
 async coinButton(interaction){return this.coin.button(interaction);}
 async badgeButton(interaction){return this.badges.handleBuy(interaction);}
 async dailyButton(interaction){return this.badges.handleDaily(interaction);}
 async badgeCommand(interaction){
  const sub=interaction.options.getSubcommand();
  if(sub==='configurar')return this.badges.configure(interaction);
  if(sub==='publicar')return this.badges.publish(interaction);
  return this.badges.list(interaction);
 }
 async dailyCommand(interaction){return this.badges.publishDaily(interaction);}
 async transfer(interaction){
   if(!this.store?.persistent)return interaction.reply(priv('As moedas precisam do Supabase.'));
   const recipient=interaction.options.getUser('jogador',true);
   const amount=interaction.options.getInteger('valor',true);
   if(recipient.bot||recipient.id===interaction.user.id)
     return interaction.reply(priv('Escolha outra pessoa real para receber as moedas.'));
   if(!Number.isInteger(amount)||amount<1||amount>500)
     return interaction.reply(priv('Você pode enviar entre 1 e 500 moedas por vez.'));
   if(!await interaction.guild.members.fetch(recipient.id).catch(()=>null))
     return interaction.reply(priv('Essa pessoa não está no servidor.'));
   await interaction.deferReply({flags:MessageFlags.Ephemeral});
   const result=await this.store.transferCoins(interaction.user.id,recipient.id,amount,interaction.id);
   if(!result.ok){
     const reason=result.reason==='funds'?'Saldo insuficiente. Você tem '+result.balance+' moedas.':
       result.reason==='limit'?'Seu limite de envios de hoje (1000 moedas) foi atingido.':
       result.reason==='duplicate'?'Esta transferência já foi processada.':
       'Não foi possível realizar a transferência.';
     return interaction.editReply('🪙 '+reason);
   }
   await interaction.editReply('✅ Você enviou **'+amount+' moedas de pato** para <@'+recipient.id+
     '>!\nSeu saldo atual é **'+result.balance+' moedas**.');
 }
 shutdown(){this.coin.shutdown();this.rps.shutdown();this.ttt.shutdown();}
}
