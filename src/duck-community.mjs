import {randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} from 'discord.js';
import {DuckBattleArena} from './duck-battle-arena.mjs';
import {TYPES,SHOP,MOVES,normalizedPet,xpNeeded,MAX_LEVEL} from './duck-battle-data.mjs';

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
 constructor({store,extras}={}){this.store=store;this.extras=extras;this.arena=new DuckBattleArena({store});this.games=new Map();}
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

 async challenge(interaction){return this.arena.challenge(interaction);}
 async battleButton(interaction){return this.arena.action(interaction);}
 shutdown(){this.arena.shutdown();}
 async pato(interaction){
  if(!this.store?.persistent)return interaction.reply(priv('Ative o Supabase para usar o RPG de patinhos.'));
  const sub=interaction.options.getSubcommand();
  const user=interaction.user.id;
  if(sub==='perfil'||sub==='golpes'){
    const member=sub==='perfil'?interaction.options.getUser('usuario')||interaction.user:interaction.user;
    const [row,coins,items]=await Promise.all([
      this.store.getDuck(member.id),this.store.getBalance(member.id),this.store.getDuckItems(member.id)
    ]);
    const p=normalizedPet(row);
    const moves=p.moves.map((id,i)=>'**'+(i+1)+'.** '+MOVES[id].emoji+' '+MOVES[id].name+
      ' ('+MOVES[id].power+' poder)').join('\n');
    return interaction.reply(priv('🦆 **PATO DE '+member.username.slice(0,32)+'**\n'+
      TYPES[p.type].emoji+' Tipo: **'+TYPES[p.type].name+'**'+(p.chosen?'':' (ainda não escolhido)')+
      '\n🏅 Nível **'+p.level+'/'+MAX_LEVEL+'**'+
      (p.level<MAX_LEVEL?' • XP '+p.xp+'/'+xpNeeded(p.level):' • nível máximo')+
      '\n🪙 Moedas: **'+coins+'**\n⚔️ **Golpes:**\n'+moves+
      '\n🎒 Itens: '+(items.length?items.map(i=>(SHOP[i.item_key]?.name||i.item_key)+' ×'+i.quantity).join(', ').slice(0,640):'nenhum')+
      '\n\nTreine usando /pato usar, ensine TM com /pato tm e desafie usando /batalha.'));
  }
  if(sub==='loja'){
    const coins=await this.store.getBalance(user);
    return interaction.reply(priv('🛍️ **LOJA DOS PATOS** • Você tem '+coins+' moedas\n'+
      Object.entries(SHOP).map(([key,item])=>'• **'+item.name+'** — **'+item.cost+' 🪙**'+
      '\n  '+item.desc+' • código: '+key).join('\n').slice(0,1700)+
      '\n\nUse /pato comprar para adquirir itens. Não há apostas ou dinheiro real.'));
  }
  if(sub==='tipo'){
    const type=interaction.options.getString('elemento',true);
    const result=await this.store.chooseDuckType(user,type);
    const msg=result.ok?TYPES[type].emoji+' Seu pato agora é do tipo **'+TYPES[type].name+'**!'+
      (result.consumed?' Uma Essência Elemental foi consumida.':' Primeira escolha grátis!'):
      result.reason==='same'?'Seu pato já tem esse tipo.':
      result.reason==='essencia'?'Para trocar de tipo, compre uma **Essência Elemental** na loja.':'Tipo inválido.';
    return interaction.reply(priv(msg));
  }
  if(sub==='comprar'){
    const item=interaction.options.getString('item',true);
    const bought=await this.store.buyDuckItem(user,item);
    return interaction.reply(priv(bought.ok?'🛍️ Você comprou **'+SHOP[item].name+'** por '+SHOP[item].cost+
      ' moedas! Saldo: **'+bought.balance+'**.':
      bought.reason==='coins'?'🪙 Moedas insuficientes! Precisa de '+bought.price+' e tem '+bought.balance+'.':
      bought.reason==='full'?'Seu inventário deste item está cheio (99).':'Item indisponível.'));
  }
  if(sub==='usar'){
    const item=interaction.options.getString('item',true);
    const outcome=await this.store.feedDuck(user,item);
    return interaction.reply(priv(outcome.ok?'🍽️ Seu pato ganhou **'+outcome.earned+' XP**! Nível: **'+
      outcome.level+'** • XP restante: '+outcome.xp+'.':
      outcome.reason==='missing'?'Você ainda não tem essa ração. Compre na /pato loja.':
      outcome.reason==='max'?'Seu pato já está no nível máximo!':'Não consegui alimentar o pato.'));
  }
  if(sub==='tm'){
    const item=interaction.options.getString('item',true);
    const slot=interaction.options.getInteger('slot',true);
    const result=await this.store.teachDuckMove(user,item,slot);
    return interaction.reply(priv(result.ok?'📀 TM aplicada! O golpe **'+MOVES[result.replaced].name+
      '** virou **'+MOVES[result.learned].name+'** no espaço '+slot+'.':
      result.reason==='missing'?'Você precisa comprar essa TM na loja.':
      result.reason==='already'?'Seu pato já conhece esse golpe.':'Não foi possível aplicar essa TM.'));
  }
 }
}
