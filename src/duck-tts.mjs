import {EdgeTTS,Constants} from '@andresaya/edge-tts';

// Cinco vozes efetivas do serviço Edge (três do Brasil, duas de Portugal)
// e presets de tom/velocidade. Presets reutilizam a voz original.
// Os IDs virtuais pt-BR-*Neural são chaves internas de seleção compatíveis com
// o formato existente no banco, NÃO nomes de modelos Edge; edgeId é o modelo real.
const rows=[
  ['Francisca • Natural','pt-BR-FranciscaNeural','pt-BR-FranciscaNeural',12,0,'Brasil • feminina'],
  ['Francisca • Fofinha','pt-BR-FranciscaFofaNeural','pt-BR-FranciscaNeural',35,4,'Brasil • mais aguda'],
  ['Francisca • Suave','pt-BR-FranciscaSuaveNeural','pt-BR-FranciscaNeural',18,-9,'Brasil • tranquila'],
  ['Francisca • Animada','pt-BR-FranciscaAnimadaNeural','pt-BR-FranciscaNeural',23,12,'Brasil • expressiva'],
  ['Thalita • Natural','pt-BR-ThalitaMultilingualNeural','pt-BR-ThalitaMultilingualNeural',10,0,'Brasil • feminina'],
  ['Thalita • Fofinha','pt-BR-ThalitaFofaNeural','pt-BR-ThalitaMultilingualNeural',32,5,'Brasil • mais aguda'],
  ['Thalita • Suave','pt-BR-ThalitaSuaveNeural','pt-BR-ThalitaMultilingualNeural',14,-10,'Brasil • tranquila'],
  ['Antônio','pt-BR-AntonioNeural','pt-BR-AntonioNeural',0,0,'Brasil • masculino'],
  ['Raquel • Portugal','pt-BR-RaquelPortugalNeural','pt-PT-RaquelNeural',12,0,'Portugal • feminina'],
  ['Raquel • Fofinha','pt-BR-RaquelFofaNeural','pt-PT-RaquelNeural',31,6,'Portugal • mais aguda'],
  ['Duarte • Portugal','pt-BR-DuartePortugalNeural','pt-PT-DuarteNeural',0,0,'Portugal • masculino']
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
  text,voice=DEFAULT_VOICE,ttsFactory,fallbackFetch
}={}){
  const selection=voiceMap.get(voice);
  if(!selection)throw Error('Voz indisponível no Edge TTS: '+voice);
  const content=String(text||'').trim().slice(0,340);
  if(!content)throw Error('Texto vazio para TTS');
  let edgeError;
  try{
    const tts=ttsFactory?ttsFactory():new EdgeTTS();
    const generated=await tts.generate(content,selection.edgeId,edgeVoiceOptions(voice));
    const audio=Buffer.from(generated?.audio||[]);
    if(audio.length<24||audio.length>3*1024*1024||
      audio[0]!==0x1a||audio[1]!==0x45||audio[2]!==0xdf||audio[3]!==0xa3)
      throw Error('Edge TTS não retornou WebM/Opus válido (formato: '+
        String(generated?.format||'?')+')');
    return audio;
  }catch(error){edgeError=error;}
  // Mocks de testes continuam sem chamadas externas, salvo injeção explícita.
  if(ttsFactory&&!fallbackFetch)throw edgeError;
  console.warn('[Duckzinha] Edge TTS indisponível ('+
    String(edgeError?.message||edgeError).slice(0,160)+
    '); tentando voz alternativa por HTTPS.');
  try{
    const audio=await googleSpeechFallback(content,voice,fallbackFetch||fetch);
    console.log('[Duckzinha] Google TTS gerou áudio alternativo MP3 ('+
      audio.length+' bytes).');
    return audio;
  }catch(fallbackError){
    throw Error('Edge TTS: '+String(edgeError?.message||edgeError).slice(0,160)+
      ' | Google TTS: '+String(fallbackError?.message||fallbackError).slice(0,160));
  }
}
