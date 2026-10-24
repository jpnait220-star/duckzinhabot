import {randomInt,randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder,MessageFlags} from 'discord.js';
import {coinflipGif} from './duck-coinflip-gif.mjs';
import {COIN_VIDEO} from './duck-coinflip-video.mjs';

const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
export class DuckCoinflip{
  constructor({randomSide=()=>randomInt(2),now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),renderGif=coinflipGif}={}){
    this.randomSide=randomSide;this.now=now;this.sleep=sleep;this.renderGif=renderGif;
    this.games=new Map();this.players=new Map();this.cooldowns=new Map();
  }
  stop(game){
    game.closed=true;this.games.delete(game.id);
    for(const id of [game.host,game.guest])
      if(this.players.get(id)===game.id)this.players.delete(id);
  }
  shutdown(){for(const game of [...this.games.values()])this.stop(game);}
  async challenge(interaction){
    const host=interaction.user.id,other=interaction.options.getUser('jogador',true);
    if(other.bot||other.id===host)return interaction.reply(hidden('Escolha outra pessoa real do servidor.'));
    if(!await interaction.guild.members.fetch(other.id).catch(()=>null))
      return interaction.reply(hidden('Essa pessoa não está no servidor.'));
    if(this.players.has(host)||this.players.has(other.id))
      return interaction.reply(hidden('Alguém já está participando de outro coinflip.'));
    if(this.now()-(this.cooldowns.get(host)||0)<15000)
      return interaction.reply(hidden('Espere 15 segundos para iniciar outro coinflip.'));
    const game={id:randomUUID().slice(0,16),guild:interaction.guildId,
      host,guest:other.id,channel:interaction.channel,stage:'invite',closed:false,created:this.now()};
    this.games.set(game.id,game);this.players.set(host,game.id);this.players.set(other.id,game.id);
    this.cooldowns.set(host,this.now());
    const buttons=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('duckcoin:'+game.id+':yes').setLabel('Aceitar').setEmoji('🪙').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('duckcoin:'+game.id+':no').setLabel('Recusar').setStyle(ButtonStyle.Secondary)
    );
    try{
      await interaction.reply({content:'## 🪙 Duckzinha • Cara ou Coroa\n'+
        '**Um novo desafio foi lançado!**\n\n'+
        '🦆 **CARA**  ·  <@'+host+'>\n'+
        '👑 **COROA**  ·  <@'+other.id+'>\n\n'+
        '🎯 **Melhor de 3 rodadas**\n'+
        '⏳ **60 segundos** para aceitar\n\n'+
        '*✨ É só pela diversão: ninguém aposta nem perde moedas.*',
        components:[buttons],allowedMentions:{users:[host,other.id]}});
      game.message=await interaction.fetchReply();
      const timer=setTimeout(async()=>{
        if(game.closed||game.stage!=='invite')return;
        this.stop(game);
        await game.message.edit({content:'⌛ **Convite encerrado**\nO tempo para aceitar o desafio terminou.',
          components:[],allowedMentions:{parse:[]}}).catch(()=>{});
      },60000);
      timer.unref?.();game.timer=timer;
    }catch(err){this.stop(game);throw err;}
  }
  async button(interaction){
    const [,id,action]=String(interaction.customId).split(':');
    const game=this.games.get(id);
    if(!game||game.closed||game.stage!=='invite')
      return interaction.reply(hidden('Este coinflip não está mais disponível.'));
    if(interaction.user.id!==game.guest)
      return interaction.reply(hidden('Somente a pessoa desafiada pode aceitar.'));
    if(!['yes','no'].includes(action))
      return interaction.reply(hidden('Ação inválida.'));
    game.stage='running';
    if(game.timer)clearTimeout(game.timer);
    if(action==='no'){
      this.stop(game);
      return interaction.update({content:'🦆 **Desafio recusado**\nA partida foi cancelada. Até a próxima!',
        components:[],allowedMentions:{parse:[]}});
    }
    await interaction.update({content:'## 🪙 Duckzinha • Cara ou Coroa\n✨ **Desafio aceito!** Preparando a primeira rodada...',
      components:[],allowedMentions:{parse:[]}});
    void this.run(game).catch(async err=>{
      console.warn('[Duckzinha] Coinflip: '+String(err?.message||err));
      await game.message?.edit({content:'⚠️ **Coinflip interrompido**\nHouve um problema ao atualizar a partida. Nenhuma moeda foi movimentada.',
        attachments:[],components:[],allowedMentions:{parse:[]}}).catch(()=>{});
      this.stop(game);
    });
  }
  async run(game){
    let heads=0,tails=0;
    const roundCount=3;
    for(let round=1;round<=roundCount;round++){
      if(game.closed)return;
      // Aguardamos 3 segundos ANTES de começar cada giro.
      for(let seconds=3;seconds>=1;seconds--){
        if(game.closed)return;
        await game.message.edit({
          content:'## 🪙 Duckzinha • Cara ou Coroa\n'+
            '**RODADA '+round+'/3**\n\n'+
            '⏳ A moeda vai girar em **'+seconds+'**...\n\n'+
            '**PLACAR ATUAL**\n'+
            '🦆 Cara · <@'+game.host+'>  **'+heads+'**\n'+
            '👑 Coroa · <@'+game.guest+'>  **'+tails+'**',
          components:[],attachments:[],allowedMentions:{parse:[]}
        });
        await this.sleep(1000);
      }
      if(game.closed)return;
      const side=this.randomSide()===0?'cara':'coroa';
      const label=side==='cara'?'🦆 **CARA**':'👑 **COROA**';
      let files=[];
      try{
        const gif=await this.renderGif(side);
        files=[new AttachmentBuilder(gif,{
          name:'duckzinha-coinflip-'+side+'-rodada-'+round+'.gif',
          description:'Moeda de pato girando, resultado '+side
        })];
      }catch(err){
        console.warn('[Duckzinha] GIF indisponível: '+String(err?.message||err));
      }
      if(game.closed)return;
      if(side==='cara')heads++;else tails++;
      await game.message.edit({
        content:'## 🪙 Duckzinha • Cara ou Coroa\n'+
          '**RODADA '+round+'/3**  ·  '+label+'\n\n'+
          '**PLACAR**\n'+
          '🦆 Cara · <@'+game.host+'>  **'+heads+'**\n'+
          '👑 Coroa · <@'+game.guest+'>  **'+tails+'**',
        files,attachments:[],components:[],allowedMentions:{parse:[]}
      });
      // Não interromper o GIF enquanto a moeda ainda gira.
      await this.sleep(Math.ceil(COIN_VIDEO.seconds*1000));
    }
    if(game.closed)return;
    const winner=heads>tails?game.host:game.guest;
    await game.message.edit({
      content:'## 🏆 Duckzinha • Vitória!\n'+
        '🎉 **<@'+winner+'> venceu o desafio!**\n\n'+
        '**PLACAR FINAL · MELHOR DE 3**\n'+
        '🦆 Cara: **'+heads+'** × **'+tails+'** :Coroa 👑\n\n'+
        '✨ Partida encerrada! Nenhuma moeda foi apostada ou perdida.',
      attachments:[],components:[],allowedMentions:{parse:[]}
    });
    this.stop(game);
  }
}
