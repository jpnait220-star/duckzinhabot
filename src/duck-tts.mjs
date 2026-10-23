import {EdgeTTS,Constants} from '@andresaya/edge-tts';

// O Edge Read Aloud disponibiliza somente um subconjunto das vozes Azure.
export const PT_BR_VOICES=Object.freeze([
  Object.freeze({name:'Francisca',id:'pt-BR-FranciscaNeural',description:'Feminina, natural'}),
  Object.freeze({name:'Thalita (multilíngue)',id:'pt-BR-ThalitaMultilingualNeural',description:'Feminina, delicada'}),
  Object.freeze({name:'Antônio',id:'pt-BR-AntonioNeural',description:'Masculina'})
]);
export const DEFAULT_VOICE='pt-BR-FranciscaNeural';
const available=new Set(PT_BR_VOICES.map(voice=>voice.id));

export function validVoice(value){return available.has(value);}
export function voiceLabel(value){return PT_BR_VOICES.find(voice=>voice.id===value)?.name||'Francisca';}
export function voiceChoices(){return PT_BR_VOICES.map(voice=>({name:voice.name,value:voice.id}));}
export function edgeSpeechReady(){return true;}

export function edgeVoiceOptions(voice){
  if(!validVoice(voice))throw Error('Voz inválida para Edge TTS');
  return {
    pitch:voice==='pt-BR-AntonioNeural'?'+0Hz':'+12Hz',
    rate:'+0%',
    volume:'+0%',
    outputFormat:Constants.OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS,
    timeout:18000
  };
}

// Áudio WebM/Opus pronto para StreamType.WebmOpus do @discordjs/voice.
// Serviço online não oficial, sem chave; pode mudar ou bloquear requisições.
export async function synthesizeDuckSpeech({text,voice=DEFAULT_VOICE,ttsFactory=()=>new EdgeTTS()}={}){
  if(!validVoice(voice))throw Error('Voz pt-BR indisponível no Edge TTS');
  const content=String(text||'').trim().slice(0,420);
  if(!content)throw Error('Texto vazio para TTS');
  const result=await ttsFactory().generate(content,voice,edgeVoiceOptions(voice));
  const audio=Buffer.from(result?.audio||[]);
  if(audio.length<24||audio.length>1024*1024||
    audio[0]!==0x1a||audio[1]!==0x45||audio[2]!==0xdf||audio[3]!==0xa3)
    throw Error('Edge TTS não retornou WebM/Opus válido');
  return audio;
}
