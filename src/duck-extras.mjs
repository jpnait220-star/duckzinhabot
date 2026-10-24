import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,PermissionFlagsBits} from 'discord.js';
import {DuckPublicQuiz} from './duck-public-quiz.mjs';

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
    animada:'pt-BR-ThalitaAnimadaNeural',
    calma:'pt-BR-ThalitaSuaveNeural',
    sonolenta:'pt-BR-ThalitaSuaveNeural',
    curiosa:'pt-BR-ThalitaFofaNeural'
  },
  'pt-BR-RaquelPortugalNeural':{
    animada:'pt-BR-RaquelAnimadaNeural',
    curiosa:'pt-BR-RaquelFofaNeural'
  },
  'pt-BR-AntonioNeural':{
    animada:'pt-BR-AntonioAnimadoNeural'
  },
  'pt-BR-DuartePortugalNeural':{
    animada:'pt-BR-DuarteAnimadoNeural'
  }
};
export function expressiveVoice(current,mood,enabled=true){
  return enabled?(emotionMap[current]?.[mood]||current):current;
}

export class DuckExtras{
  constructor({store}={}){
    this.store=store;
    this.settings={...DEFAULT_SETTINGS};
    this.quiz=new DuckPublicQuiz();
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
        // Preservar opções de outros painéis (como o canal de logs).
        const existing=await this.store.getFeatureSettings();
        await this.store.setFeatureSettings({...existing,...next},adminId);
        return true;
      }
    }catch(err){console.warn('[Duckzinha] Painel: configurações apenas em RAM ('+err.message+')');}
    return false;
  }
  mood(text){return moodFromText(text,this.settings.mood);}
  score(userId){return this.quiz.score(userId);}
  streak(userId){return this.quiz.activeStreak(userId);}
  resetUser(userId){this.quiz.resetUser(userId);}
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
  startGame(interaction,options){return this.quiz.start(interaction,options);}
  stopGame(interaction){return this.quiz.stop(interaction);}
  shutdown(){this.quiz.shutdown();}

  async gameButton(interaction){return this.quiz.answer(interaction);}
}
