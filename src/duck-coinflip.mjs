import {randomInt,randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder,MessageFlags} from 'discord.js';
import {coinflipVideo,COIN_VIDEO} from './duck-coinflip-video.mjs';

export const COINFLIP_LIMIT=5;
export const COINFLIP_WINDOW_MS=2*60*60*1000;
export const COINFLIP_REWARD=15;
const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});

export class DuckCoinflip {
 constructor({store,randomSide=()=>randomInt(2),now=Date.now,
   sleep=ms=>new Promise(r=>setTimeout(r,ms)),renderVideo=coinflipVideo}={}){
  this.store=store;
  this.randomSide=randomSide;this.now=now;this.sleep=sleep;this.renderVideo=renderVideo;
  this.games=new Map();this.players=new Map();this.cooldowns=new Map();
  this.videosPromise=null;
 }
 async prepareVideos(){
  if(!this.videosPromise){
   // Gerar os dois lados ANTES do 3, 2, 1: nada de FFmpeg depois da contagem.
   // Um vídeo de cada vez reduz a sobrecarga de CPU da FadeHost.
   this.videosPromise=(async()=>({
     cara:await this.renderVideo('cara'),
     coroa:await this.renderVideo('coroa')
   }))().catch(e=>{this.videosPromise=null;throw e});
  }
  return this.videosPromise;
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
   // Começar a preparar o vídeo enquanto o convite está aberto.
   void this.prepareVideos().catch(e=>
     console.warn('[Duckzinha] Pré-renderização do Coinflip: '+String(e?.message||e)));
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
  await interaction.update({content:'## 🪙 Duckzinha • Coinflip\n'+
    '✨ **Desafio aceito!** Preparando a moeda para começar sem atraso...',
    components:[],allowedMentions:{parse:[]}});
  try{
   const videos=await this.prepareVideos();
   if(game.closed)return;
   const quota=await this.store.startCoinflip(game.id,game.host,game.guest);
   if(!quota?.ok){
    this.stop(game);
    const reason=quota?.reason==='host_limit'?'quem enviou o desafio':
      quota?.reason==='guest_limit'?'quem aceitou o desafio':'a partida';
    return game.message.edit({content:'⏳ **Limite de Coinflip!**\n'+
      'O limite de 5 partidas em 2 horas foi alcançado para '+reason+
      '. Tente novamente quando o período de 2 horas liberar espaço.',
      components:[],allowedMentions:{parse:[]}});
   }
   game.stage='running';
   await this.run(game,videos);
  }catch(error){
   console.warn('[Duckzinha] Coinflip: '+String(error?.message||error));
   if(!game.closed){
    await game.message?.edit({content:'⚠️ **Coinflip indisponível**\n'+
      'Não consegui preparar a moeda ou registrar a partida. Ninguém perdeu moedas.',
      attachments:[],components:[],allowedMentions:{parse:[]}}).catch(()=>{});
    this.stop(game);
   }
  }
 }
 async run(game,videos){
  let heads=0,tails=0;
  for(let round=1;round<=3;round++){
   if(game.closed)return;
   // Renderização terminou ANTES de exibir 3, 2, 1.
   for(let sec=3;sec>=1;sec--){
    if(game.closed)return;
    await game.message.edit({
     content:'## 🪙 Duckzinha • Cara ou Coroa\n'+
       '**RODADA '+round+'/3**\n\n'+
       '⏳ A moeda vai girar em **'+sec+'**...\n\n'+
       '🦆 Cara **'+heads+'**  ×  **'+tails+'** Coroa 👑',
     components:[],attachments:[],allowedMentions:{parse:[]}
    });
    await this.sleep(1000);
   }
   if(game.closed)return;
   const side=this.randomSide()===0?'cara':'coroa';
   const file=new AttachmentBuilder(videos[side],{
     name:'duckzinha-moeda-'+side+'-rodada-'+round+'.mp4',
     description:'Moeda 3D girando e parando em '+side
   });
   await game.message.edit({content:'## 🪙 Duckzinha • Cara ou Coroa\n'+
     '🎬 **RODADA '+round+'/3 • GIRANDO!**\n'+
     '🦆 '+heads+'  ×  '+tails+' 👑',
     files:[file],attachments:[],components:[],allowedMentions:{parse:[]}
   });
   // Mantém o vídeo inteiro antes de alterar a mensagem.
   await this.sleep(Math.ceil(COIN_VIDEO.seconds*1000)+350);
   if(game.closed)return;
   if(side==='cara')heads++;else tails++;
   await game.message.edit({content:'## 🪙 Resultado • Rodada '+round+'/3\n'+
     (side==='cara'?'🦆 **CARA!**':'👑 **COROA!**')+'\n\n'+
     '**PLACAR**\n🦆 <@'+game.host+'>: **'+heads+'**\n'+
     '👑 <@'+game.guest+'>: **'+tails+'**',
     components:[],allowedMentions:{parse:[]}
   });
   if(round<3)await this.sleep(750);
  }
  if(game.closed)return;
  const winner=heads>tails?game.host:game.guest;
  // Recompensa idempotente: não duplica moedas se ocorrer reconexão.
  let result;
  try{result=await this.store.finishCoinflip(game.id,winner);}
  catch(e){console.warn('[Duckzinha] Erro ao creditar vitória: '+String(e?.message||e));}
  await game.message.edit({content:'## 🏆 Duckzinha • Temos um vencedor!\n'+
    '🎉 **<@'+winner+'> venceu o Coinflip!**\n\n'+
    '🦆 Cara **'+heads+'**  ×  **'+tails+'** Coroa 👑\n\n'+
    (result?.ok?'🎁 **+'+COINFLIP_REWARD+' moedas de pato** para o vencedor!':
      '⚠️ Não consegui confirmar as moedas. A staff pode verificar o registro.')+
    '\n*Sem apostas ou perda de saldo.*',
    attachments:[],components:[],allowedMentions:{parse:[]}
  });
  this.stop(game);
 }
}
