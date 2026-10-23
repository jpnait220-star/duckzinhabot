import {EdgeTTS,Constants} from '@andresaya/edge-tts';

// Cinco vozes efetivas do serviço Edge (três do Brasil, duas de Portugal)
// e presets de tom/velocidade. Presets reutilizam a voz original.
const rows=[
  ['Francisca • Natural','pt-BR-FranciscaNeural','pt-BR-FranciscaNeural',12,0,'Brasil • feminina'],
  ['Francisca • Fofinha','francisca-fofa','pt-BR-FranciscaNeural',35,4,'Brasil • mais aguda'],
  ['Francisca • Suave','francisca-suave','pt-BR-FranciscaNeural',18,-9,'Brasil • tranquila'],
  ['Francisca • Animada','francisca-animada','pt-BR-FranciscaNeural',23,12,'Brasil • expressiva'],
  ['Thalita • Natural','pt-BR-ThalitaMultilingualNeural','pt-BR-ThalitaMultilingualNeural',10,0,'Brasil • feminina'],
  ['Thalita • Fofinha','thalita-fofa','pt-BR-ThalitaMultilingualNeural',32,5,'Brasil • mais aguda'],
  ['Thalita • Suave','thalita-suave','pt-BR-ThalitaMultilingualNeural',14,-10,'Brasil • tranquila'],
  ['Antônio','pt-BR-AntonioNeural','pt-BR-AntonioNeural',0,0,'Brasil • masculino'],
  ['Raquel • Portugal','pt-PT-RaquelNeural','pt-PT-RaquelNeural',12,0,'Portugal • feminina'],
  ['Raquel • Fofinha','raquel-fofa','pt-PT-RaquelNeural',31,6,'Portugal • mais aguda'],
  ['Duarte • Portugal','pt-PT-DuarteNeural','pt-PT-DuarteNeural',0,0,'Portugal • masculino']
];
export const PT_BR_VOICES=Object.freeze(rows.map(([name,id,edgeId,pitch,rate,description])=>
  Object.freeze({name,id,edgeId,pitch,rate,description})));
export const DEFAULT_VOICE='pt-BR-FranciscaNeural';
const voiceMap=new Map(PT_BR_VOICES.map(x=>[x.id,x]));
export function validVoice(value){return voiceMap.has(value);}
export function voiceLabel(value){return voiceMap.get(value)?.name||'Francisca • Natural';}
export function voiceChoices(){return PT_BR_VOICES.map(x=>({name:x.name,value:x.id}));}
export function edgeSpeechReady(){return true;}

export function edgeVoiceOptions(value){
  const voice=voiceMap.get(value);
  if(!voice)throw Error('Voz ou estilo inválido para Edge TTS');
  return {
    pitch:(voice.pitch>=0?'+':'')+voice.pitch+'Hz',
    rate:(voice.rate>=0?'+':'')+voice.rate+'%',
    volume:'+0%',
    outputFormat:Constants.OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS,
    timeout:25000
  };
}

// Áudio WebM/Opus pronto para StreamType.WebmOpus do @discordjs/voice.
// É um serviço online não oficial, que pode falhar ou ter o acesso bloqueado.
export async function synthesizeDuckSpeech({text,voice=DEFAULT_VOICE,ttsFactory=()=>new EdgeTTS()}={}){
  const selection=voiceMap.get(voice);
  if(!selection)throw Error('Voz indisponível no Edge TTS: '+voice);
  const content=String(text||'').trim().slice(0,340);
  if(!content)throw Error('Texto vazio para TTS');
  const generated=await ttsFactory().generate(content,selection.edgeId,edgeVoiceOptions(voice));
  const audio=Buffer.from(generated?.audio||[]);
  if(audio.length<24||audio.length>3*1024*1024||
    audio[0]!==0x1a||audio[1]!==0x45||audio[2]!==0xdf||audio[3]!==0xa3)
    throw Error('Edge TTS não retornou WebM/Opus válido (formato: '+String(generated?.format||'?')+')');
  return audio;
}
