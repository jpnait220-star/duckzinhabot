import {randomUUID} from 'node:crypto';
import {MessageFlags} from 'discord.js';
import {chooseQuestion,levelForStreak,LEVEL_NAMES,questionButtons} from './duck-quiz.mjs';
import {awardMinigameWin,winRewardLabel} from './duck-minigame-rewards.mjs';
import {replayRow} from './duck-replay.mjs';

export const PUBLIC_ROUND_MS=35_000;
export const PUBLIC_NEXT_MS=4_000;
export const PUBLIC_MAX_ROUNDS=30;
const privateReply=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
const listNames=ids=>ids.slice(0,25).map(id=>'<@'+id+'>').join(', ')+
  (ids.length>25?' e mais '+(ids.length-25)+' participantes':'');
export function publicQuestionText(round){
  const level=levelForStreak(round.number-1);
  return '🦆 **'+(round.room.championship?'CAMPEONATO DE QUIZ':'QUIZ DA GALERA')+' — RODADA '+round.number+'**\n'+
    '⭐ Dificuldade: **'+LEVEL_NAMES[level-1]+' ('+level+'/5)**\n'+
    (round.number===1?'👥 **Todos podem entrar nesta rodada!**':
      '👥 **'+round.eligible.size+'** pessoas passaram da rodada anterior.')+'\n'+
    '⏳ **'+Math.ceil(round.room.roundMs/1000)+' segundos** para responder, uma vez por pessoa.\n\n'+
    '📚 '+round.question.topic+'\n**'+round.question.text+'**\n\n'+
    'O quiz não fecha quando alguém responde. No fim revelo **quem passou**!';
}
export function publicResultText(round,winners,{last=false}={}){
  const level=levelForStreak(round.number-1);
  return '🦆 **'+(round.room.championship?'CAMPEONATO DE QUIZ':'QUIZ DA GALERA')+' — RODADA '+round.number+' ENCERRADA**\n'+
    '⭐ Nível: **'+LEVEL_NAMES[level-1]+'**\n'+
    '📚 '+round.question.text+'\n'+
    '✅ Resposta correta: **'+round.question.choices[round.question.right]+'**\n\n'+
    '🏅 **QUEM PASSOU ('+winners.length+'):**\n'+
    (winners.length?listNames(winners):'Ninguém passou desta rodada.')+'\n\n'+
    (winners.length&&!last?'🔥 Próxima pergunta em 4 segundos! Somente quem passou continua.':
      winners.length?'🏆 **Parabéns aos campeões! Partida concluída.**':
        '🏁 **Fim da partida!** Clique em Jogar novamente.');
}
export class DuckPublicQuiz {
  constructor({store,now=Date.now,random=Math.random,setTimer=setTimeout,
    clearTimer=clearTimeout,roundMs=PUBLIC_ROUND_MS,nextMs=PUBLIC_NEXT_MS,
    maxRounds=PUBLIC_MAX_ROUNDS}={}){
    Object.assign(this,{store,now,random,setTimer,clearTimer,roundMs,nextMs,maxRounds});
    this.rooms=new Map();this.rounds=new Map();this.best=new Map();
  }
  key(guild,channel){return guild+':'+channel;}
  score(user){return this.best.get(user)||0;}
  activeStreak(user){
    for(const room of this.rooms.values()){
      const r=room.current;
      if(r?.number>1&&r.eligible?.has(user))return r.number-1;
    }
    return 0;
  }
  resetUser(user){
    this.best.delete(user);
    for(const room of this.rooms.values()){
      room.current?.eligible?.delete(user);
      room.current?.answers?.delete(user);
    }
  }
  makeRound(room,eligible=null){
    const number=room.nextNumber++;
    const question=chooseQuestion(levelForStreak(number-1),room.used,this.random);
    room.used.push(question.key);
    if(room.used.length>60)room.used=room.used.slice(-60);
    return {id:randomUUID().slice(0,16),room,number,question,eligible,
      answers:new Map(),closed:false,deadline:this.now()+room.roundMs,message:null,timer:null};
  }
  payload(round){
    const rows=questionButtons(round.id,round.question);
    for(const row of rows)for(const button of row.components){
      button.setCustomId(button.data.custom_id.replace('duckgame:','duckpublic:'));
    }
    return {content:publicQuestionText(round),components:rows,allowedMentions:{parse:[]}};
  }
  arm(round){
    this.rounds.set(round.id,round);
    round.timer=this.setTimer(()=>{void this.closeRound(round).catch(error=>
      console.error('[Duckzinha] Quiz público: '+String(error?.message||error)));},round.room.roundMs);
    round.timer?.unref?.();
  }
  async start(interaction,{championship=false}={}){
    const key=this.key(interaction.guildId,interaction.channelId);
    if(this.rooms.has(key)){
      await interaction.reply(privateReply('🦆 Já existe um quiz público neste canal! Use os botões da pergunta atual.'));
      return false;
    }
    if(!interaction.channel?.send||!interaction.channelId){
      await interaction.reply(privateReply('Use /jogo quiz num canal de texto.'));
      return false;
    }
    const room={key,channel:interaction.channel,nextNumber:1,used:[],current:null,timer:null,
      championship,roundMs:this.roundMs};
    this.rooms.set(key,room);
    const round=this.makeRound(room);
    room.current=round;
    try{
      await interaction.reply(this.payload(round));
      round.message=await interaction.fetchReply();
      this.arm(round);
      return true;
    }catch(error){
      this.stopRoom(room);
      throw error;
    }
  }
  async answer(interaction){
    const [,id,option]=String(interaction.customId).split(':');
    const round=this.rounds.get(id);
    if(!round||round.closed||round.deadline<=this.now()){
      await interaction.reply(privateReply('⏳ Essa rodada acabou. Veja a próxima pergunta no canal.'));
      return;
    }
    const user=interaction.user.id;
    if(round.eligible&&!round.eligible.has(user)){
      await interaction.reply(privateReply('💛 Nesta rodada continuam apenas as pessoas que passaram da anterior.'));
      return;
    }
    if(round.answers.has(user)){
      await interaction.reply(privateReply('✅ Você já respondeu! Aguarde os outros participantes.'));
      return;
    }
    const selected=Number(option);
    if(!Number.isInteger(selected)||selected<0||selected>=round.question.choices.length){
      await interaction.reply(privateReply('Opção inválida.'));
      return;
    }
    // Não modifica a pergunta pública: outro jogador ainda consegue responder.
    round.answers.set(user,selected);
    try{
      await interaction.reply(privateReply('✅ Resposta registrada! O quiz continua aberto para todos. '+
        'No fim da rodada veremos quem passou. 🦆'));
    }catch(error){console.warn('[Duckzinha] Quiz: confirmação privada falhou: '+String(error?.message||error));}
  }
  stopRoom(room){
    if(room.current){
      room.current.closed=true;
      this.rounds.delete(room.current.id);
      if(room.current.timer!=null)this.clearTimer(room.current.timer);
    }
    if(room.timer!=null)this.clearTimer(room.timer);
    if(this.rooms.get(room.key)===room)this.rooms.delete(room.key);
  }
  async closeRound(round){
    if(round.closed)return;
    round.closed=true;
    const room=round.room;
    if(room.current!==round)return;
    this.rounds.delete(round.id);
    if(round.timer!=null)this.clearTimer(round.timer);
    const winners=[...round.answers].filter(([,choice])=>choice===round.question.right).map(([user])=>user);
    for(const user of winners)if(round.number>this.score(user))this.best.set(user,round.number);
    const last=round.number>=(room.championship?6:this.maxRounds);
    try{
      await round.message.edit({content:publicResultText(round,winners,{last}),
        components:(!winners.length||last)?[replayRow(room.championship?'championship':'quiz')]:[],
        allowedMentions:{parse:[]}});
    }catch(error){
      console.warn('[Duckzinha] Quiz: erro ao editar resultado: '+String(error?.message||error));
      this.stopRoom(room);
      return;
    }
    // Cada acerto em uma rodada vale 5 moedas. O RPC garante apenas
    // um pagamento por pessoa e por rodada, mesmo se houver uma repetição.
    if(winners.length&&this.store?.persistent){
      const credited=await Promise.all(winners.map(async user=>{
        const reward=await awardMinigameWin(this.store,user,'quiz:'+round.id);
        return reward?.credited===true;
      }));
      const rewarded=credited.filter(Boolean).length;
      if(rewarded){
        await round.message.edit({content:publicResultText(round,winners,{last})+
          '\n\n'+winRewardLabel+' para '+rewarded+' participante(s) que acertaram.',
          components:(!winners.length||last)?[replayRow(room.championship?'championship':'quiz')]:[],
          allowedMentions:{parse:[]}}).catch(error=>
          console.warn('[Duckzinha] Mensagem prêmio quiz: '+String(error?.message||error)));
      }
    }
    if(!winners.length||last){this.stopRoom(room);return;}
    // Uma nova pergunta pública; a anterior continua mostrando quem passou.
    room.timer=this.setTimer(()=>{void this.advance(room,round,new Set(winners)).catch(error=>{
      console.warn('[Duckzinha] Quiz: erro ao avançar: '+String(error?.message||error));
      this.stopRoom(room);
    });},this.nextMs);
    room.timer?.unref?.();
  }
  async advance(room,previous,eligible){
    if(this.rooms.get(room.key)!==room||room.current!==previous)return;
    room.timer=null;
    const round=this.makeRound(room,eligible);
    room.current=round;
    try{
      round.message=await room.channel.send(this.payload(round));
      this.arm(round);
    }catch(error){
      this.stopRoom(room);
      throw error;
    }
  }
  async stop(interaction){
    const room=this.rooms.get(this.key(interaction.guildId,interaction.channelId));
    if(!room){
      await interaction.reply(privateReply('Não há quiz em andamento neste canal.'));
      return;
    }
    const previous=room.current;
    this.stopRoom(room);
    if(previous?.message)await previous.message.edit({content:'🛑 **Quiz encerrado pela moderação.**',
      components:[],allowedMentions:{parse:[]}}).catch(()=>{});
    await interaction.reply(privateReply('Quiz público encerrado neste canal.'));
  }
  shutdown(){for(const room of [...this.rooms.values()])this.stopRoom(room);}
}
