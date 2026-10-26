import {randomInt,randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} from 'discord.js';
import {awardMinigameWin,winRewardLabel} from './duck-minigame-rewards.mjs';
import {replayRow} from './duck-replay.mjs';
export const RPS_MOVES=[
 {name:'Pedra',emoji:'✊'},
 {name:'Papel',emoji:'✋'},
 {name:'Tesoura',emoji:'✌️'}
];
export function rockPaperScissorsResult(player,bot){
 if(![0,1,2].includes(player)||![0,1,2].includes(bot))throw Error('Jogada inválida');
 if(player===bot)return 'empate';
 return (player-bot+3)%3===1?'vitoria':'derrota';
}
const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
export class DuckRockPaperScissors{
 constructor({store,randomMove=()=>randomInt(3),now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  this.store=store;
  Object.assign(this,{randomMove,now,setTimer,clearTimer});this.games=new Map();
 }
 async start(interaction){
  const key=interaction.guildId+':'+interaction.channelId;
  const old=this.games.get(key);
  if(old&&this.now()-old.createdAt<30000)
   return interaction.reply(hidden('Já tem uma rodada ativa aqui!'));
  const game={key,id:randomUUID().slice(0,12),createdAt:this.now(),choices:new Map()};
  this.games.set(key,game);
  const buttons=new ActionRowBuilder().addComponents(RPS_MOVES.map((move,i)=>
   new ButtonBuilder().setCustomId('duckrps:'+game.id+':'+i)
    .setLabel(move.name).setEmoji(move.emoji).setStyle(ButtonStyle.Primary)));
  try{
   await interaction.reply({
    content:'## ✊✋✌️ Pedra, Papel e Tesoura\n'+
     'Escolha sua jogada e desafie a Duckzinha! 🦆\n\n'+
     '✊ Pedra vence tesoura\n✋ Papel vence pedra\n✌️ Tesoura vence papel\n\n'+
     '⏳ **30 segundos** • Uma tentativa por pessoa • Sem apostas.',
    components:[buttons],allowedMentions:{parse:[]}
   });
   const message=await interaction.fetchReply();
   game.timer=this.setTimer(async()=>{
    if(this.games.get(key)!==game)return;
    this.games.delete(key);
    const result=[...game.choices.values()];
    const wins=result.filter(x=>x==='vitoria').length;
    const losses=result.filter(x=>x==='derrota').length;
    const ties=result.filter(x=>x==='empate').length;
    await message.edit({content:'## 🏁 Pedra, Papel e Tesoura • Resultado\n'+
      '👥 **'+result.length+'** participantes\n'+
      '🏆 **'+wins+'** vitórias contra a Duckzinha\n'+
      '🦆 **'+losses+'** vitórias da Duckzinha\n'+
      '🤝 **'+ties+'** empates\n\nQuer revanche? Clique em **Jogar novamente**!',
      components:[replayRow('rps')],allowedMentions:{parse:[]}}).catch(()=>{});
   },30000);
   game.timer?.unref?.();
  }catch(error){this.games.delete(key);throw error;}
 }
 async choose(interaction){
  const parts=interaction.customId.split(':'),id=parts[1],choice=Number(parts[2]);
  const key=interaction.guildId+':'+interaction.channelId;
  const game=this.games.get(key);
  if(!game||game.id!==id||this.now()-game.createdAt>=30000)
    return interaction.reply(hidden('⏳ A rodada acabou. Inicie outra com /minigame.'));
  if(game.choices.has(interaction.user.id))
    return interaction.reply(hidden('Você já jogou nesta rodada!'));
  if(![0,1,2].includes(choice))return interaction.reply(hidden('Jogada inválida.'));
  const bot=this.randomMove();
  const outcome=rockPaperScissorsResult(choice,bot);
  game.choices.set(interaction.user.id,outcome);
  const label=outcome==='vitoria'?'🏆 Você ganhou! GG!':
    outcome==='derrota'?'🦆 A Duckzinha ganhou! Hehehe!':
      '🤝 Empate! Bora de novo!';
  // Publica o resultado no chat normal: o bot também consegue considerar
  // essa mensagem no contexto público recente da conversa.
  const content='## ✊✋✌️ Pedra, Papel e Tesoura\n'+
    '👤 **Jogador:** <@'+interaction.user.id+'>\n'+
    '**Sua jogada:** '+RPS_MOVES[choice].emoji+' '+RPS_MOVES[choice].name+'\n'+
    '🦆 **Duckzinha:** '+RPS_MOVES[bot].emoji+' '+RPS_MOVES[bot].name+
    '\n\n'+label;
  await interaction.reply({content,allowedMentions:{parse:[]}});
  if(outcome==='vitoria'){
    const reward=await awardMinigameWin(this.store,interaction.user.id,'rps:'+game.id);
    if(reward.credited&&typeof interaction.editReply==='function'){
      await interaction.editReply({content:content+'\n'+winRewardLabel,
        allowedMentions:{parse:[]}}).catch(error=>
          console.warn('[Duckzinha] Mensagem de prêmio RPS: '+String(error?.message||error)));
    }
  }
 }
 shutdown(){
  for(const game of this.games.values())if(game.timer)this.clearTimer(game.timer);
  this.games.clear();
 }
}
