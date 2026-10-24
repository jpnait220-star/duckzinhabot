import {randomInt,randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder,MessageFlags} from 'discord.js';
import {coinMp3} from './duck-coinflip-audio.mjs';
import {coinflipVideo} from './duck-coinflip-video.mjs';

const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
export class DuckCoinflip{
  constructor({randomSide=()=>randomInt(2),now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),renderVideo=coinflipVideo}={}){
    this.randomSide=randomSide;this.now=now;this.sleep=sleep;this.renderVideo=renderVideo;
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
      await interaction.reply({content:'🦆 **DESAFIO DE CARA OU COROA**\n'+
        '<@'+host+'> escolheu **CARA** e desafiou <@'+other.id+'> (**COROA**).\n'+
        'Serão **3 rodadas**, com um vídeo da moeda de pato girando em 3D e som sincronizado!\n'+
        '🎮 Apenas uma disputa divertida: **ninguém aposta ou perde moedas**.\n'+
        '⏳ O convite expira em 60 segundos.',
        components:[buttons],allowedMentions:{users:[host,other.id]}});
      game.message=await interaction.fetchReply();
      const timer=setTimeout(async()=>{
        if(game.closed||game.stage!=='invite')return;
        this.stop(game);
        await game.message.edit({content:'⌛ Convite do coinflip expirado.',
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
      return interaction.update({content:'🦆 Desafio recusado. Nenhuma moeda foi movimentada.',
        components:[],allowedMentions:{parse:[]}});
    }
    await interaction.update({content:'🪙 **Coinflip aceito!** A moeda de pato vai girar três vezes...',
      components:[],allowedMentions:{parse:[]}});
    void this.run(game).catch(async err=>{
      console.warn('[Duckzinha] Coinflip: '+String(err?.message||err));
      await game.channel.send({content:'Coinflip interrompido por erro de áudio ou mensagem. Ninguém perdeu moedas.',
        allowedMentions:{parse:[]}}).catch(()=>{});
      this.stop(game);
    });
  }
  async run(game){
    let heads=0,tails=0;
    for(let round=1;round<=3;round++){
      if(game.closed)return;
      const side=this.randomSide()===0?'cara':'coroa';
      if(side==='cara')heads++;else tails++;
      const label=side==='cara'?'🦆 **CARA**':'👑 **COROA**';
      const message='🪙 **MOEDA DE PATO • RODADA '+round+'/3**\n'+
        'A moeda girou e caiu em '+label+'!\n\n'+
        '🦆 <@'+game.host+'> (Cara): **'+heads+'** ponto(s)\n'+
        '👑 <@'+game.guest+'> (Coroa): **'+tails+'** ponto(s)';
      let file=[];
      try{
        const video=await this.renderVideo(side);
        file=[new AttachmentBuilder(video,{
          name:'duckzinha-coinflip-'+side+'-rodada-'+round+'.mp4',
          description:'Animação da moeda de pato girando em 3D com som e resultado '+side
        })];
      }catch(err){
        console.warn('[Duckzinha] Vídeo indisponível, usando MP3: '+String(err.message||err));
        try{
          file=[new AttachmentBuilder(await coinMp3(side),{
            name:'pato-moeda-'+side+'-rodada-'+round+'.mp3'
          })];
        }catch(error){console.warn('[Duckzinha] Efeito MP3: '+String(error.message||error));}
      }
      if(game.closed)return;
      await game.channel.send({content:message,files:file,allowedMentions:{parse:[]}});
      // O próprio MP4 contém a animação e o áudio. Não enviar dois anexos por rodada.
      if(round<3)await this.sleep(700);
    }
    if(game.closed)return;
    const winner=heads>tails?game.host:game.guest;
    await game.channel.send({content:'🏆 **RESULTADO DO COINFLIP (MELHOR DE 3)**\n'+
      '🦆 Cara: **'+heads+'** × **'+tails+'** :Coroa 👑\n'+
      '🎉 **Venceu <@'+winner+'>!**\n'+
      '💛 Nenhuma moeda foi apostada, transferida ou perdida.',
      allowedMentions:{parse:[]}});
    this.stop(game);
  }
}
