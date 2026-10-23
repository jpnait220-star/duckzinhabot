import {randomUUID} from 'node:crypto';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,PermissionFlagsBits} from 'discord.js';

export const MOODS=['auto','animada','calma','curiosa','sonolenta'];
export const DEFAULT_SETTINGS=Object.freeze({mood:'auto',emotionalVoice:true,specialReactions:true});
export function normalizeSettings(raw){
  const data=raw&&typeof raw==='object'?raw:{};
  return {
    mood:MOODS.includes(data.mood)?data.mood:'auto',
    emotionalVoice:data.emotionalVoice!==false,
    specialReactions:data.specialReactions!==false
  };
}
export function moodFromText(text,override='auto'){
  if(override!=='auto'&&MOODS.includes(override))return override;
  const s=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/\b(erro|triste|doente|preocupad|ajuda|perdi|luto|ansios|medo|serio)\b/.test(s))return 'calma';
  if(/\b(quem|como|porque|qual|curios|sera|explica)\b/.test(s))return 'curiosa';
  if(/\b(kkk|haha|gg|ganhei|consegui|parabens|vitoria|incrivel|oba)\b/.test(s))return 'animada';
  if(/\b(boa noite|sono|dormir|cansad)\b/.test(s))return 'sonolenta';
  return 'calma';
}
export function moodInstruction(mood){
  const guidance={
    animada:'Fale com energia leve e entusiasmo, sem exagerar.',
    calma:'Fale de modo claro, educado e sereno. Em assuntos sérios, evite brincadeiras.',
    curiosa:'Demonstre curiosidade natural e explique com simplicidade.',
    sonolenta:'Use um ritmo tranquilo e um humor leve, sem fingir ter necessidades humanas.'
  };
  return 'ESTADO TEMPORÁRIO DE EXPRESSÃO: '+(guidance[mood]||guidance.calma)+
    ' Não anuncie seu estado, não invente sentimentos reais, não faça flerte e não altere fatos.';
}
const emotionMap={
  'pt-BR-FranciscaNeural':{
    animada:'pt-BR-FranciscaAnimadaNeural',
    calma:'pt-BR-FranciscaSuaveNeural',
    sonolenta:'pt-BR-FranciscaSuaveNeural',
    curiosa:'pt-BR-FranciscaFofaNeural'
  },
  'pt-BR-ThalitaMultilingualNeural':{
    animada:'pt-BR-ThalitaFofaNeural',
    calma:'pt-BR-ThalitaSuaveNeural',
    sonolenta:'pt-BR-ThalitaSuaveNeural',
    curiosa:'pt-BR-ThalitaFofaNeural'
  }
};
export function expressiveVoice(current,mood,enabled=true){
  return enabled?(emotionMap[current]?.[mood]||current):current;
}

const QUESTIONS=[
  {question:'Qual mob deixa cair linhas ao ser derrotado no Minecraft?',options:['Aranha','Ovelha','Galinha'],answer:0},
  {question:'Qual é o nome do minério vermelho usado em circuitos?',options:['Quartzo','Redstone','Lápis-lazúli'],answer:1},
  {question:'Qual item é usado para domesticar lobos?',options:['Ossos','Pão','Sementes'],answer:0},
  {question:'Qual dimensão é acessada com o portal de obsidiana?',options:['End','Nether','Overworld'],answer:1},
  {question:'Qual é a capital da Bahia?',options:['Salvador','Recife','Fortaleza'],answer:0},
  {question:'Qual planeta é conhecido como planeta vermelho?',options:['Marte','Vênus','Júpiter'],answer:0},
  {question:'Quanto é 9 × 8?',options:['63','81','72'],answer:2}
];
export class DuckExtras{
  constructor({store}={}){
    this.store=store;
    this.settings={...DEFAULT_SETTINGS};
    this.gameSessions=new Map();
    this.gameScore=new Map();
    this.lastGame=new Map();
    this.lastImage=new Map();
  }
  async load(){
    if(!this.store?.persistent)return;
    try{this.settings=normalizeSettings(await this.store.getFeatureSettings());}
    catch(err){console.warn('[Duckzinha] Painel sem configuração persistente: '+err.message);}
  }
  async update(key,value,adminId){
    const next=normalizeSettings({...this.settings,[key]:value});
    this.settings=next;
    try{
      if(this.store?.persistent){
        await this.store.setFeatureSettings(next,adminId);
        return true;
      }
    }catch(err){console.warn('[Duckzinha] Painel: configurações apenas em RAM ('+err.message+')');}
    return false;
  }
  mood(text){return moodFromText(text,this.settings.mood);}
  score(userId){return this.gameScore.get(userId)||0;}
  resetUser(userId){this.gameScore.delete(userId);this.lastGame.delete(userId);}
  panelPayload(){
    const s=this.settings;
    return {
      content:'🦆 **Painel da Duckzinha**\nConfigurações para administradores.\n\n'+
      'Humor: **'+s.mood+'**\n'+
      'Voz expressiva: **'+(s.emotionalVoice?'ligada':'desligada')+'**\n'+
      'Reações especiais: **'+(s.specialReactions?'ligadas':'desligadas')+'**\n\n'+
      'Estas preferências só continuam após reinício se a migração do Supabase estiver aplicada.',
      components:[
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('duckpanel:mood:auto').setLabel('Humor automático').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('duckpanel:mood:animada').setLabel('Animada').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('duckpanel:mood:calma').setLabel('Calma').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('duckpanel:mood:curiosa').setLabel('Curiosa').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('duckpanel:mood:sonolenta').setLabel('Sonolenta').setStyle(ButtonStyle.Secondary)),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('duckpanel:toggle:emotionalVoice').setLabel('Alternar voz expressiva').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('duckpanel:toggle:specialReactions').setLabel('Alternar reações').setStyle(ButtonStyle.Secondary))
      ],flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}
    };
  }
  async panelButton(interaction){
    if(!interaction.inGuild()||!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)){
      await interaction.reply({content:'Painel somente para administradores.',flags:MessageFlags.Ephemeral});return;
    }
    const [,kind,value]=interaction.customId.split(':');
    let saved=false;
    if(kind==='mood'&&MOODS.includes(value))saved=await this.update('mood',value,interaction.user.id);
    else if(kind==='toggle'&&['emotionalVoice','specialReactions'].includes(value))
      saved=await this.update(value,!this.settings[value],interaction.user.id);
    else return;
    const p=this.panelPayload();
    p.content+='\n\n'+(saved?'✅ Configuração salva no Supabase.':'⚠️ Ativo apenas até reiniciar (rode a migração SQL).');
    await interaction.update(p);
  }
  startGame(interaction){
    const now=Date.now(),user=interaction.user.id;
    if(now-(this.lastGame.get(user)||0)<12000)
      return {content:'Espere 12 segundos antes de jogar novamente.',flags:MessageFlags.Ephemeral};
    this.lastGame.set(user,now);
    const q=QUESTIONS[Math.floor(Math.random()*QUESTIONS.length)];
    const id=randomUUID().slice(0,12);
    this.gameSessions.set(id,{user,question:q,expires:now+90_000});
    if(this.gameSessions.size>200){
      for(const [key,s] of this.gameSessions)if(s.expires<now)this.gameSessions.delete(key);
    }
    return {
      content:'🎮 **Quiz da Duckzinha**\n'+q.question+'\nEscolha uma resposta (90 segundos):',
      components:[new ActionRowBuilder().addComponents(q.options.map((label,index)=>
        new ButtonBuilder().setCustomId('duckgame:'+id+':'+index).setLabel(label).setStyle(ButtonStyle.Primary)))],
      flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}
    };
  }
  async gameButton(interaction){
    const [,id,index]=interaction.customId.split(':');
    const session=this.gameSessions.get(id);
    if(!session||session.expires<Date.now()){
      await interaction.reply({content:'Este quiz expirou. Use /jogo novamente.',flags:MessageFlags.Ephemeral});return;
    }
    if(session.user!==interaction.user.id){
      await interaction.reply({content:'Esse quiz pertence a outra pessoa.',flags:MessageFlags.Ephemeral});return;
    }
    this.gameSessions.delete(id);
    const correct=Number(index)===session.question.answer;
    if(correct)this.gameScore.set(session.user,this.score(session.user)+1);
    await interaction.update({
      content:(correct?'✅ Acertou!':'💛 Não foi dessa vez!')+' Resposta: **'+
        session.question.options[session.question.answer]+'**.\n'+
        'Acertos nesta sessão do bot: '+this.score(session.user)+'.',
      components:[],allowedMentions:{parse:[]}
    });
  }
}
