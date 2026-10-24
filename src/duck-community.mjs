import {randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} from 'discord.js';

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
 {name:'geografia',label:'Geografia',question:'Qual é a capital de Pernambuco?',options:['Salvador','Maceió','Recife','Natal'],answer:2}
];

export class DuckCommunity{
 constructor({store,extras}={}){this.store=store;this.extras=extras;this.battles=new Map();this.games=new Map();}
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
   const sub=interaction.options.getSubcommand();
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
   const available=kind==='aleatorio'?SAFE_GAMES:SAFE_GAMES.filter(x=>x.name===kind);
   const q=available[Math.floor(Math.random()*available.length)];
   const key=interaction.guildId+':'+interaction.channelId;
   if(this.games.has(key)&&Date.now()-this.games.get(key).time<30000)
     return interaction.reply(priv('Já existe um minigame ativo neste canal.'));
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
 async challenge(interaction){
   const target=interaction.options.getUser('pessoa',true);
   if(target.bot||target.id===interaction.user.id)return interaction.reply(priv('Escolha outro membro real para uma batalha.'));
   const id=randomUUID().slice(0,14);
   const actions=new ActionRowBuilder().addComponents(
     new ButtonBuilder().setCustomId('duckbattle:'+id+':accept').setLabel('Aceitar desafio').setEmoji('🦆').setStyle(ButtonStyle.Success),
     new ButtonBuilder().setCustomId('duckbattle:'+id+':decline').setLabel('Recusar').setStyle(ButtonStyle.Secondary));
   this.battles.set(id,{challenger:interaction.user.id,target:target.id,expires:Date.now()+60000});
   await interaction.reply({content:'⚔️ Batalha de Patinhos\n<@'+interaction.user.id+'> desafiou <@'+target.id+
     '>!\nBatalha divertida sem apostas — habilidades sorteadas.',components:[actions],
     allowedMentions:{users:[interaction.user.id,target.id]}});
 }
 async battleButton(interaction){
   const [,id,action]=interaction.customId.split(':');
   const b=this.battles.get(id);
   if(!b||b.expires<Date.now())return interaction.reply(priv('Esse desafio expirou.'));
   if(interaction.user.id!==b.target)return interaction.reply(priv('Apenas a pessoa desafiada pode responder.'));
   this.battles.delete(id);
   if(action==='decline')return interaction.update({content:'🦆 Desafio recusado.',components:[],allowedMentions:{parse:[]}});
   const moves=['Escudo de penas 🛡️','Redemoinho de água 🌊','Asas velozes 💨','Quack supremo ✨'];
   const one=moves[Math.floor(Math.random()*moves.length)],two=moves[Math.floor(Math.random()*moves.length)];
   const winner=Math.random()<.5?b.challenger:b.target;
   return interaction.update({content:'⚔️ BATALHA DE PATINHOS\n<@'+b.challenger+'>: '+one+
      '\n<@'+b.target+'>: '+two+'\n🏆 Vencedor: <@'+winner+'>!\n💛 Só diversão, sem moedas em risco.',
      components:[],allowedMentions:{parse:[]}});
 }
}
