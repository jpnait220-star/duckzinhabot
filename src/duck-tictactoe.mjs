import {randomInt,randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} from 'discord.js';
import {awardMinigameWin,winRewardLabel} from './duck-minigame-rewards.mjs';
const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function tictactoeOutcome(board){
 if(!Array.isArray(board)||board.length!==9||board.some(x=>!['','X','O'].includes(x)))
  throw Error('Tabuleiro inválido');
 for(const [a,b,c] of LINES)if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];
 return board.every(Boolean)?'draw':null;
}
export function chooseDuckMove(board,random=()=>randomInt(999999)){
 if(tictactoeOutcome(board))return -1;
 const available=board.map((v,i)=>v===''?i:-1).filter(i=>i>=0);
 for(const piece of ['O','X']){
  for(const pos of available){
   const simulated=[...board];simulated[pos]=piece;
   if(tictactoeOutcome(simulated)===piece)return pos;
  }
 }
 if(available.includes(4))return 4;
 const corners=available.filter(i=>[0,2,6,8].includes(i));
 const pool=corners.length?corners:available;
 return pool[Math.max(0,Math.floor(Number(random())||0))%pool.length];
}
export function tictactoeButtons(game){
 const rows=[];
 for(let r=0;r<3;r++){
  const row=new ActionRowBuilder();
  for(let col=0;col<3;col++){
   const pos=r*3+col,symbol=game.board[pos];
   row.addComponents(new ButtonBuilder()
    .setCustomId('duckttt:'+game.id+':'+pos)
    .setLabel(symbol==='X'?'X':symbol==='O'?'O':'·')
    .setStyle(symbol==='X'?ButtonStyle.Danger:symbol==='O'?ButtonStyle.Success:ButtonStyle.Secondary)
    .setDisabled(Boolean(symbol||game.closed)));
  }
  rows.push(row);
 }
 return rows;
}
function scoreText(game,result=''){
 const status=game.closed
  ?(result==='X'?'🏆 **Você venceu a Duckzinha! GG!** 🦆':
    result==='O'?'🦆 **A Duckzinha venceu!** Hehehe!':
    result==='draw'?'🤝 **Deu velha! Empatamos!**':'⌛ **Jogo encerrado por inatividade.**')
  :'🎮 **Vez de <@'+game.userId+'>!** Você é ❌ e a Duckzinha é ⭕.';
 return '## ❌⭕ Jogo da Velha • Duckzinha\n'+
  '👤 **Jogador:** <@'+game.userId+'>\n'+status+'\n\n'+
  (game.closed?'Jogue novamente usando /minigame tipo:Jogo da Velha.':
    'Clique em uma casa vazia. ⏳ 90 segundos por jogada.');
}
export class DuckTicTacToe{
 constructor({store,now=Date.now,random=()=>randomInt(999999),
  setTimer=setTimeout,clearTimer=clearTimeout,timeoutMs=90000}={}){
  Object.assign(this,{store,now,random,setTimer,clearTimer,timeoutMs});
  this.games=new Map();
 }
 key(interaction){return interaction.guildId+':'+interaction.channelId;}
 arm(game){
  if(game.timer)this.clearTimer(game.timer);
  game.lastMoveAt=this.now();
  game.timer=this.setTimer(async()=>{
   if(this.games.get(game.key)!==game)return;
   this.games.delete(game.key);
   game.closed=true;
   try{
    await game.message?.edit({content:scoreText(game,'timeout'),
     components:tictactoeButtons(game),allowedMentions:{parse:[]}});
   }catch(e){console.warn('[Duckzinha] Jogo da Velha: encerramento '+String(e?.message||e));}
  },this.timeoutMs);
  game.timer?.unref?.();
 }
 stop(game){
  if(game.timer)this.clearTimer(game.timer);
  game.closed=true;
  if(this.games.get(game.key)===game)this.games.delete(game.key);
 }
 async start(interaction){
  const key=this.key(interaction);
  if(this.games.has(key))
   return interaction.reply(hidden('❌⭕ Já existe uma partida de Jogo da Velha neste canal. Termine a atual primeiro.'));
  const game={
   key,id:randomUUID().slice(0,16),userId:interaction.user.id,
   board:Array(9).fill(''),closed:false,timer:null,message:null,lastMoveAt:this.now()
  };
  this.games.set(key,game);
  try{
   await interaction.reply({
    content:scoreText(game),components:tictactoeButtons(game),allowedMentions:{parse:[]}
   });
   game.message=await interaction.fetchReply();
   if(this.games.get(key)===game)this.arm(game);
  }catch(error){this.stop(game);throw error;}
 }
 async choose(interaction){
  const [,id,rawPosition]=String(interaction.customId||'').split(':');
  const key=this.key(interaction),game=this.games.get(key),position=Number(rawPosition);
  if(!game||game.closed||game.id!==id||this.now()-game.lastMoveAt>=this.timeoutMs)
   return interaction.reply(hidden('⌛ Essa partida terminou. Abra outra com /minigame.'));
  if(interaction.user.id!==game.userId)
   return interaction.reply(hidden('Essa partida pertence a outro jogador! Abra seu jogo quando terminar. 🦆'));
  if(!/^[0-8]$/.test(rawPosition)||!Number.isInteger(position)||game.board[position])
   return interaction.reply(hidden('Essa casa não está disponível. Escolha outra!'));
  game.board[position]='X';
  let result=tictactoeOutcome(game.board);
  if(!result){
   const botPos=chooseDuckMove(game.board,this.random);
   if(botPos>=0)game.board[botPos]='O';
   result=tictactoeOutcome(game.board);
  }
  if(result)this.stop(game);
  else this.arm(game);
  const resultText=scoreText(game,result||'');
  await interaction.update({
   content:resultText,components:tictactoeButtons(game),allowedMentions:{parse:[]}
  });
  if(result==='X'){
   const reward=await awardMinigameWin(this.store,game.userId,'ttt:'+game.id);
   if(reward.credited&&typeof interaction.editReply==='function'){
    await interaction.editReply({content:resultText+'\n'+winRewardLabel,
      allowedMentions:{parse:[]}}).catch(error=>
        console.warn('[Duckzinha] Mensagem de prêmio Jogo da Velha: '+String(error?.message||error)));
   }
  }
 }
 shutdown(){for(const game of [...this.games.values()])this.stop(game);}
}
