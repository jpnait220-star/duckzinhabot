// Vozes locais/auto-hospedadas. URL é o endpoint COMPLETO /v1/audio/speech.
// Nenhum fornecedor é chamado sem URL configurada. Nunca imprime tokens.
const ENGINES=[
  {name:'kokoro',url:'KOKORO_TTS_URL',token:'KOKORO_TTS_TOKEN',
   voice:'KOKORO_TTS_VOICE',defaultVoice:'pf_dora',model:'kokoro',format:'opus',timeout:20000},
  {name:'piper',url:'PIPER_TTS_URL',token:'PIPER_TTS_TOKEN',
   voice:'PIPER_TTS_VOICE',defaultVoice:'pt_BR-faber-medium',model:'tts-1',format:'wav',timeout:12000}
];
const failedUntil=new Map();
const MAX_AUDIO_BYTES=5*1024*1024;
const isOgg=audio=>audio.subarray(0,4).toString('ascii')==='OggS';
const isWebm=audio=>audio.length>4&&audio.readUInt32BE(0)===0x1a45dfa3;
const isWav=audio=>audio.length>44&&
  audio.subarray(0,4).toString('ascii')==='RIFF'&&
  audio.subarray(8,12).toString('ascii')==='WAVE';
const isMp3=audio=>audio.length>128&&(
  audio.subarray(0,3).toString('ascii')==='ID3'||
  (audio[0]===0xff&&(audio[1]&0xe0)===0xe0)
);
export function recognizedTtsAudio(audio){
  if(!Buffer.isBuffer(audio))return null;
  if(isOgg(audio))return 'ogg';
  if(isWebm(audio))return 'webm';
  if(isWav(audio))return 'wav';
  if(isMp3(audio))return 'mp3';
  return null;
}
function speechEndpoint(value){
  if(!value)return null;
  const url=new URL(String(value));
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))
    throw Error('Use HTTPS ou HTTP no localhost para o servidor TTS');
  if(url.username||url.password)throw Error('Não inclua credenciais na URL TTS');
  if(!url.pathname.endsWith('/v1/audio/speech'))
    throw Error('A URL TTS deve terminar em /v1/audio/speech');
  return url.toString();
}
async function limitedAudio(response){
  const statedSize=Number(response.headers?.get?.('content-length')||0);
  if(statedSize>MAX_AUDIO_BYTES)throw Error('Resposta TTS acima do limite');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<64||bytes.length>MAX_AUDIO_BYTES)throw Error('Tamanho do áudio TTS inválido');
  if(!recognizedTtsAudio(bytes))throw Error('TTS não devolveu formato de áudio suportado');
  return bytes;
}
/**
 * Ordem: Kokoro -> Piper -> null (chamador continua com Edge TTS).
 * Cada motor que falhar descansa 60 segundos para não atrasar todas as falas.
 * Serviços TTS só são usados se o administrador informar as URLs em .env.
 */
export async function tryOpenTtsSpeech(input,{env=process.env,fetchImpl=fetch,now=Date.now,cooldownMs=60000}={}){
  const text=String(input||'').trim().slice(0,340);
  if(!text)return null;
  for(const engine of ENGINES){
    const address=String(env[engine.url]||'').trim();
    if(!address)continue;
    const key=engine.name+'|'+address;
    if((failedUntil.get(key)||0)>now())continue;
    try{
      const url=speechEndpoint(address);
      const token=String(env[engine.token]||'').trim();
      const response=await fetchImpl(url,{
        method:'POST',
        headers:{'Content-Type':'application/json',
          ...(token?{'Authorization':'Bearer '+token}:{})},
        body:JSON.stringify({
          model:engine.model,input:text,
          voice:String(env[engine.voice]||engine.defaultVoice).trim(),
          response_format:engine.format,speed:1.0
        }),
        signal:AbortSignal.timeout(engine.timeout)
      });
      if(!response.ok)throw Error('HTTP '+response.status);
      const bytes=await limitedAudio(response);
      // Não aceitar formatos com transcodificação implícita nesta etapa.
      const type=recognizedTtsAudio(bytes);
      if(engine.name==='kokoro'&&!['ogg','webm'].includes(type))
        throw Error('Kokoro deve retornar Opus (Ogg/WebM)');
      if(engine.name==='piper'&&type!=='wav')
        throw Error('Piper deve retornar WAV PCM 16 bits');
      failedUntil.delete(key);
      Object.defineProperty(bytes,'duckTtsProvider',{value:engine.name});
      console.log('[Duckzinha] Voz aberta: '+engine.name+'.');
      return bytes;
    }catch(error){
      failedUntil.set(key,now()+cooldownMs);
      console.warn('[Duckzinha] TTS '+engine.name+' indisponível ('+
        String(error?.message||error).slice(0,150)+
        '); testando próxima voz.'); 
    }
  }
  return null;
}
