import {randomInt,randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder,MessageFlags} from 'discord.js';
import {coinflipImage} from './duck-coinflip-image.mjs';

export const COINFLIP_LIMIT=5;
export const COINFLIP_WINDOW_MS=2*60*60*1000;
export const COINFLIP_REWARD=15;
const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});

export class DuckCoinflip {
 constructor({store,randomSide=()=>randomInt(2),now=Date.now,
    renderImage=coinflipImage}={}){
  this.store=store;this.randomSide=randomSide;this.now=now;this.renderImage=renderImage;
  this.games=new Map();this.players=new Map();this.cooldowns=new Map();
 }
 stop(game){
  game.closed=true;this.games.delete(game.id);
  if(game.timer)clearTimeout(game.timer);
  for(const id of [game.host,game.guest])
   if(this.players.get(id)===game.id)this.players.delete(id);
 }
 shutdown(){for(const game of [...this.games.values()])this.stop(game)}
 async challenge(interaction){
  const host=interaction.user.id,other=interaction.options.getUser('jogador',true);
  if(other.bot||other.id===host)
   return interaction.reply(hidden('Escolha outra pessoa real do servidor.'));
  if(!await interaction.guild.members.fetch(other.id).catch(()=>null))
   return interaction.reply(hidden('Essa pessoa não está no servidor.'));
  if(!this.store?.persistent)
   return interaction.reply(hidden('🪙 Para receber moedas e guardar as 5 partidas por 2 horas, preciso do Supabase e da migração coinflip configurados.'));
  if(this.players.has(host)||this.players.has(other.id))
   return interaction.reply(hidden('Alguém já está participando de outro Coinflip.'));
  if(this.now()-(this.cooldowns.get(host)||0)<15000)
   return interaction.reply(hidden('Espere 15 segundos para enviar outro desafio.'));
  const game={id:randomUUID().slice(0,16),guild:interaction.guildId,
   host,guest:other.id,channel:interaction.channel,stage:'invite',
   closed:false,created:this.now()};
  this.games.set(game.id,game);
  this.players.set(host,game.id);this.players.set(other.id,game.id);
  this.cooldowns.set(host,this.now());
  const buttons=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId('duckcoin:'+game.id+':yes')
     .setLabel('Aceitar desafio').setEmoji('🪙').setStyle(ButtonStyle.Success),
   new ButtonBuilder().setCustomId('duckcoin:'+game.id+':no')
     .setLabel('Recusar').setStyle(ButtonStyle.Secondary)
  );
  try{
   await interaction.reply({content:'## 🪙 Duckzinha • Cara ou Coroa\n'+
     '**Desafio enviado!**\n\n'+
     '🦆 **CARA** · <@'+host+'>\n'+
     '👑 **COROA** · <@'+other.id+'>\n\n'+
     '🏆 **Melhor de 3 rodadas**\n'+
     '🎁 **Prêmio: '+COINFLIP_REWARD+' moedas de pato para quem vencer**\n'+
     '🎮 **Limite: '+COINFLIP_LIMIT+' partidas a cada 2 horas por pessoa**\n'+
     '⏳ **60 segundos** para aceitar\n\n'+
     '*Sem apostas, sem taxa de entrada e sem perder moedas.*',
     components:[buttons],allowedMentions:{users:[host,other.id]}});
   game.message=await interaction.fetchReply();
   const timer=setTimeout(async()=>{
    if(game.closed||game.stage!=='invite')return;
    this.stop(game);
    await game.message.edit({content:'⌛ **Desafio expirado!**\nO tempo para aceitar acabou. 🦆',
      components:[],allowedMentions:{parse:[]}}).catch(()=>{});
   },60000);
   timer.unref?.();game.timer=timer;
  }catch(err){this.stop(game);throw err;}
 }
 async button(interaction){
  const [,id,action]=String(interaction.customId).split(':');
  const game=this.games.get(id);
  if(!game||game.closed||game.stage!=='invite')
   return interaction.reply(hidden('Este desafio não está mais disponível.'));
  if(interaction.user.id!==game.guest)
   return interaction.reply(hidden('Somente a pessoa desafiada pode aceitar.'));
  if(!['yes','no'].includes(action))
   return interaction.reply(hidden('Ação inválida.'));
  game.stage='preparing';
  if(game.timer)clearTimeout(game.timer);
  if(action==='no'){
   this.stop(game);
   return interaction.update({content:'🦆 **Desafio recusado!**\nFica para a próxima!',
     components:[],allowedMentions:{parse:[]}});
  }
  await interaction.update({
   content:'## 🪙 Duckzinha • Coinflip\n'+
    '✅ Desafio aceito! Sorteando três rodadas... 🦆',
   components:[],allowedMentions:{parse:[]}
  });
  try{
   const quota=await this.store.startCoinflip(game.id,game.host,game.guest);
   if(!quota?.ok){
    const who=quota?.reason==='host_limit'?'quem desafiou':
      quota?.reason==='guest_limit'?'quem aceitou':'a partida';
    await game.message.edit({
     content:'⏳ **Limite de Coinflip!**\n'+
       'As 5 partidas por pessoa nas últimas 2 horas foram usadas por '+who+
       '. Tente novamente depois.',
     components:[],allowedMentions:{parse:[]}
    });
    return;
   }
   game.stage='running';
   await this.run(game);
  }catch(error){
   console.warn('[Duckzinha] Coinflip: '+String(error?.message||error));
   await game.message?.edit({
    content:'⚠️ **Coinflip indisponível**\n'+
     'Não consegui registrar a partida. Nenhuma moeda foi descontada.',
    components:[],allowedMentions:{parse:[]}
   }).catch(()=>{});
  }finally{
   this.stop(game);
  }
 }
 async run(game){
  // Uma única imagem da moeda para toda a partida, sem vídeos nem contagens lentas.
  const rounds=Array.from({length:3},()=>this.randomSide()===0?'cara':'coroa');
  const heads=rounds.filter(s=>s==='cara').length;
  const tails=3-heads;
  const winner=heads>tails?game.host:game.guest;
  let result=null;
  try{
   result=await this.store.finishCoinflip(game.id,winner);
  }catch(err){
   console.warn('[Duckzinha] Recompensa do Coinflip: '+String(err?.message||err));
  }
  let image=null;
  try{image=this.renderImage();}
  catch(err){console.warn('[Duckzinha] Imagem do Coinflip: '+String(err?.message||err));}
  const roundsText=rounds.map((side,i)=>
   '**'+(i+1)+'ª rodada:** '+(side==='cara'?'🦆 Cara':'👑 Coroa')).join('\n');
  await game.message.edit({
   content:'## 🏆 Duckzinha • Cara ou Coroa\n'+
    '✨ **Partida encerrada!**\n\n'+roundsText+'\n\n'+
    '**PLACAR FINAL**\n'+
    '🦆 <@'+game.host+'>: **'+heads+'**\n'+
    '👑 <@'+game.guest+'>: **'+tails+'**\n\n'+
    '🎉 **<@'+winner+'> venceu!**\n'+
    (result?.ok?(result.credited===false?
      '🪙 Prêmio desta partida já registrado.':
      '🎁 **+'+COINFLIP_REWARD+' moedas de pato** para o vencedor!'):
     '⚠️ A recompensa não foi confirmada. A staff pode consultar o registro.')+
    '\n\n*Sem apostas ou desconto de moedas.*',
   ...(image?{files:[new AttachmentBuilder(image,{
    name:'duckzinha-cara-e-coroa.png',
    description:'Uma imagem estática mostrando os dois lados da moeda da Duckzinha'
   })]}:{}),
   components:[],allowedMentions:{parse:[]}
  });
 }
}
