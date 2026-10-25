import {EdgeTTS,Constants} from '@andresaya/edge-tts';
import {styleGoogleSpeechMp3} from './google-voice-style.mjs';

// Cinco vozes-base do serviço Edge (três do Brasil, duas de Portugal),
// com estilos de tom e velocidade, incluindo variações mais animadas.
// Esses estilos NÃO são novos timbres/modelos; reutilizam as vozes-base.
// Os IDs virtuais pt-BR-*Neural são chaves internas de seleção compatíveis com
// o formato existente no banco, NÃO nomes de modelos Edge; edgeId é o modelo real.
const rows=[
  ['Francisca • Natural','pt-BR-FranciscaNeural','pt-BR-FranciscaNeural',12,0,'Brasil • feminina'],
  ['Francisca • Fofinha','pt-BR-FranciscaFofaNeural','pt-BR-FranciscaNeural',35,4,'Brasil • mais aguda'],
  ['Francisca • Suave','pt-BR-FranciscaSuaveNeural','pt-BR-FranciscaNeural',18,-9,'Brasil • tranquila'],
  ['Francisca • Animada','pt-BR-FranciscaAnimadaNeural','pt-BR-FranciscaNeural',23,12,'Brasil • expressiva'],
  ['Francisca • Bem Animada','pt-BR-FranciscaBemAnimadaNeural','pt-BR-FranciscaNeural',28,20,'Brasil • alegre e rápida'],
  ['Francisca • Super Animada','pt-BR-FranciscaSuperAnimadaNeural','pt-BR-FranciscaNeural',38,28,'Brasil • muita energia'],
  ['Francisca • Fofinha Animada','pt-BR-FranciscaFofaAnimadaNeural','pt-BR-FranciscaNeural',40,16,'Brasil • aguda e divertida'],
  ['Thalita • Natural','pt-BR-ThalitaMultilingualNeural','pt-BR-ThalitaMultilingualNeural',10,0,'Brasil • feminina'],
  ['Thalita • Fofinha','pt-BR-ThalitaFofaNeural','pt-BR-ThalitaMultilingualNeural',32,5,'Brasil • mais aguda'],
  ['Thalita • Suave','pt-BR-ThalitaSuaveNeural','pt-BR-ThalitaMultilingualNeural',14,-10,'Brasil • tranquila'],
  ['Thalita • Animada','pt-BR-ThalitaAnimadaNeural','pt-BR-ThalitaMultilingualNeural',23,16,'Brasil • alegre'],
  ['Thalita • Super Animada','pt-BR-ThalitaSuperAnimadaNeural','pt-BR-ThalitaMultilingualNeural',33,26,'Brasil • muito expressiva'],
  ['Antônio','pt-BR-AntonioNeural','pt-BR-AntonioNeural',0,0,'Brasil • masculino'],
  ['Antônio • Animado','pt-BR-AntonioAnimadoNeural','pt-BR-AntonioNeural',16,17,'Brasil • mais animado'],
  ['Raquel • Portugal','pt-BR-RaquelPortugalNeural','pt-PT-RaquelNeural',12,0,'Portugal • feminina'],
  ['Raquel • Fofinha','pt-BR-RaquelFofaNeural','pt-PT-RaquelNeural',31,6,'Portugal • mais aguda'],
  ['Raquel • Animada','pt-BR-RaquelAnimadaNeural','pt-PT-RaquelNeural',21,15,'Portugal • expressiva'],
  ['Raquel • Super Animada','pt-BR-RaquelSuperAnimadaNeural','pt-PT-RaquelNeural',31,24,'Portugal • entusiasmada'],
  ['Duarte • Portugal','pt-BR-DuartePortugalNeural','pt-PT-DuarteNeural',0,0,'Portugal • masculino'],
  ['Duarte • Animado','pt-BR-DuarteAnimadoNeural','pt-PT-DuarteNeural',15,16,'Portugal • mais animado'],
  ['Brenda • Brasil','pt-BR-BrendaNeural','pt-BR-BrendaNeural',10,0,'Brasil • voz feminina diferente'],
  ['Giovanna • Brasil','pt-BR-GiovannaNeural','pt-BR-GiovannaNeural',10,0,'Brasil • voz feminina diferente'],
  ['Leila • Brasil','pt-BR-LeilaNeural','pt-BR-LeilaNeural',10,0,'Brasil • voz feminina diferente'],
  ['Manuela • Brasil','pt-BR-ManuelaNeural','pt-BR-ManuelaNeural',10,0,'Brasil • voz feminina diferente'],
  ['Yara • Brasil','pt-BR-YaraNeural','pt-BR-YaraNeural',10,0,'Brasil • voz feminina diferente']
];
export const PT_BR_VOICES=Object.freeze(rows.map(([name,id,edgeId,pitch,rate,description])=>
  Object.freeze({name,id,edgeId,pitch,rate,description})));
export const DEFAULT_VOICE='pt-BR-FranciscaNeural';
const voiceMap=new Map(PT_BR_VOICES.map(x=>[x.id,x]));
export function validVoice(value){return voiceMap.has(value);}
export function voiceLabel(value){return voiceMap.get(value)?.name||'Francisca • Natural';}
export function voiceChoices(){return PT_BR_VOICES.map(x=>({name:x.name,value:x.id}));}
export function edgeSpeechReady(){return true;}

export const VOICE_MOOD_ADJUSTMENTS=Object.freeze({
  auto:{pitch:0,rate:0},
  animada:{pitch:18,rate:20},
  calma:{pitch:-15,rate:-19},
  curiosa:{pitch:12,rate:10},
  sonolenta:{pitch:-20,rate:-25}
});
export function edgeVoiceOptions(value,mood='auto'){
  const voice=voiceMap.get(value);
  if(!voice)throw Error('Voz ou estilo inválido para Edge TTS');
  const adjust=VOICE_MOOD_ADJUSTMENTS[mood]||VOICE_MOOD_ADJUSTMENTS.auto;
  const pitch=Math.max(-45,Math.min(75,voice.pitch+adjust.pitch));
  const rate=Math.max(-38,Math.min(48,voice.rate+adjust.rate));
  return {
    pitch:(pitch>=0?'+':'')+pitch+'Hz',
    rate:(rate>=0?'+':'')+rate+'%',
    volume:'+0%',
    outputFormat:Constants.OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS,
    timeout:25000
  };
}

// O Edge gera WebM/Opus diretamente, sem transcodificação.
// Se sua conexão WebSocket for recusada (ex.: HTTP 200 em vez de 101),
// tentamos o Google Tradutor TTS por HTTPS (MP3), sem tokens ou novas ENVs.
// Ambos os serviços são não oficiais: podem falhar ou limitar o acesso.
function splitSpeech(text,max=180){
  const chunks=[];
  let current='';
  for(const word of text.split(/\s+/)){
    if(!word)continue;
    if(word.length>max){
      if(current){chunks.push(current);current='';}
      for(let i=0;i<word.length;i+=max)chunks.push(word.slice(i,i+max));
      continue;
    }
    if(current&&current.length+1+word.length>max){
      chunks.push(current);
      current=word;
    }else current+=(current?' ':'')+word;
  }
  if(current)chunks.push(current);
  return chunks;
}

function looksLikeMp3(bytes){
  return bytes.length>128&&(
    bytes.subarray(0,3).toString('ascii')==='ID3'||
    (bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)
  );
}

export async function googleSpeechFallback(text,voice=DEFAULT_VOICE,fetchImpl=fetch){
  const locale=voiceMap.get(voice)?.edgeId.startsWith('pt-PT-')?'pt-PT':'pt-BR';
  const fragments=[];
  for(const chunk of splitSpeech(text)){
    const url=new URL('https://translate.google.com/translate_tts');
    url.search=new URLSearchParams({
      ie:'UTF-8',client:'tw-ob',tl:locale,q:chunk
    }).toString();
    const response=await fetchImpl(url.toString(),{
      headers:{'User-Agent':'Mozilla/5.0','Accept':'audio/mpeg,*/*'},
      signal:AbortSignal.timeout(12000)
    });
    if(!response.ok)throw Error('Google TTS HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(!looksLikeMp3(bytes)||bytes.length>1024*1024){
      throw Error('Google TTS devolveu resposta sem áudio MP3 (HTTP '+response.status+')');
    }
    fragments.push(bytes);
  }
  const audio=Buffer.concat(fragments);
  if(!looksLikeMp3(audio)||audio.length>3*1024*1024)
    throw Error('Google TTS retornou arquivo inválido ou muito grande');
  return audio;
}

export async function synthesizeDuckSpeech({
  text,voice=DEFAULT_VOICE,mood='auto',ttsFactory,fallbackFetch,fallbackStyler=styleGoogleSpeechMp3
}={}){
  const selection=voiceMap.get(voice);
  if(!selection)throw Error('Voz indisponível no Edge TTS: '+voice);
  const content=String(text||'').trim().slice(0,340);
  if(!content)throw Error('Texto vazio para TTS');
  let edgeError;
  try{
    const tts=ttsFactory?ttsFactory():new EdgeTTS();
    const generated=await tts.generate(content,selection.edgeId,edgeVoiceOptions(voice,mood));
    const audio=Buffer.from(generated?.audio||[]);
    if(audio.length<24||audio.length>3*1024*1024||
      audio[0]!==0x1a||audio[1]!==0x45||audio[2]!==0xdf||audio[3]!==0xa3)
      throw Error('Edge TTS não retornou WebM/Opus válido (formato: '+
        String(generated?.format||'?')+')');
    Object.defineProperty(audio,'duckTtsProvider',{value:'edge'});
    return audio;
  }catch(error){edgeError=error;}
  // Mocks de testes continuam sem chamadas externas, salvo injeção explícita.
  if(ttsFactory&&!fallbackFetch)throw edgeError;
  console.warn('[Duckzinha] Edge TTS indisponível ('+
    String(edgeError?.message||edgeError).slice(0,160)+
    '); tentando voz alternativa por HTTPS.');
  try{
    const mp3=await googleSpeechFallback(content,voice,fallbackFetch||fetch);
    let audio=mp3,provider='google';
    try{
      audio=await fallbackStyler(mp3,voice,{tone:mood});
      if(!Buffer.isBuffer(audio)||audio.length<24||
        audio[0]!==0x1a||audio[1]!==0x45||audio[2]!==0xdf||audio[3]!==0xa3)
        throw Error('Filtro de estilo não retornou WebM/Opus válido');
      provider='google-styled';
    }catch(styleError){
      // Mesmo se o FFmpeg falhar, a Duckzinha ainda pode usar a fala base.
      console.warn('[Duckzinha] Estilo Google indisponível: '+
        String(styleError?.message||styleError).slice(0,180)+
        '. Usando voz Google sem filtro.');
    }
    Object.defineProperty(audio,'duckTtsProvider',{value:provider});
    console.log('[Duckzinha] Voz alternativa ('+provider+'): '+
      audio.length+' bytes, preset '+selection.name+', emoção '+mood+'.');
    return audio;
  }catch(fallbackError){
    throw Error('Edge TTS: '+String(edgeError?.message||edgeError).slice(0,160)+
      ' | Google TTS: '+String(fallbackError?.message||fallbackError).slice(0,160));
  }
}
