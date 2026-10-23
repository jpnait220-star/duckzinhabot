// Vozes pt-BR confirmadas na documentação oficial do Azure Speech.
export const PT_BR_VOICES=Object.freeze([
  ['Letícia','pt-BR-LeticiaNeural','Feminina, mais jovem'],
  ['Giovanna','pt-BR-GiovannaNeural','Feminina'],
  ['Yara','pt-BR-YaraNeural','Feminina'],
  ['Manuela','pt-BR-ManuelaNeural','Feminina'],
  ['Francisca','pt-BR-FranciscaNeural','Feminina'],
  ['Brenda','pt-BR-BrendaNeural','Feminina'],
  ['Elza','pt-BR-ElzaNeural','Feminina'],
  ['Leila','pt-BR-LeilaNeural','Feminina'],
  ['Thalita','pt-BR-ThalitaNeural','Feminina'],
  ['Thalita (multilíngue)','pt-BR-ThalitaMultilingualNeural','Feminina, multilíngue'],
  ['Antônio','pt-BR-AntonioNeural','Masculina'],
  ['Donato','pt-BR-DonatoNeural','Masculina'],
  ['Fábio','pt-BR-FabioNeural','Masculina'],
  ['Humberto','pt-BR-HumbertoNeural','Masculina'],
  ['Júlio','pt-BR-JulioNeural','Masculina'],
  ['Nicolau','pt-BR-NicolauNeural','Masculina'],
  ['Valério','pt-BR-ValerioNeural','Masculina'],
  ['Macério (multilíngue)','pt-BR-MacerioMultilingualNeural','Masculina, multilíngue']
].map(([name,id,description])=>Object.freeze({name,id,description})));
export const DEFAULT_VOICE='pt-BR-LeticiaNeural';
const allowed=new Set(PT_BR_VOICES.map(x=>x.id));
export function validVoice(value){return allowed.has(value);}
export function voiceLabel(value){return PT_BR_VOICES.find(x=>x.id===value)?.name||'Letícia';}
export function voiceChoices(){
  return PT_BR_VOICES.map(x=>({name:x.name,value:x.id}));
}
export function azureSpeechReady({key,region}={}){
  return Boolean(typeof key==='string'&&key.trim()&&/^[a-z0-9-]{2,40}$/.test(String(region||'')));
}
export function xmlEscape(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
export function voiceSSML(text,voiceId=DEFAULT_VOICE){
  if(!validVoice(voiceId))throw Error('Voz pt-BR inválida');
  const safe=xmlEscape(String(text||'').trim().slice(0,440));
  if(!safe)throw Error('Texto vazio');
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR">'+
    '<voice name="'+voiceId+'">'+safe+'</voice></speak>';
}
// Retorna OGG/Opus que o @discordjs/voice pode tocar sem ffmpeg.
export async function synthesizeDuckSpeech({text,voice=DEFAULT_VOICE,key,region,fetcher=fetch}){
  if(!azureSpeechReady({key,region}))throw Error('Azure Speech não configurado');
  const ssml=voiceSSML(text,voice);
  const response=await fetcher('https://'+region+'.tts.speech.microsoft.com/cognitiveservices/v1',{
    method:'POST',signal:AbortSignal.timeout(18000),
    headers:{
      'Ocp-Apim-Subscription-Key':key,
      'Content-Type':'application/ssml+xml',
      'X-Microsoft-OutputFormat':'ogg-24khz-16bit-mono-opus',
      'User-Agent':'DuckzinhaBot'
    },
    body:ssml
  });
  if(!response.ok)throw Error('Azure Speech HTTP '+response.status);
  const size=Number(response.headers?.get?.('content-length'));
  if(size>1024*1024)throw Error('Áudio TTS maior que o permitido');
  const audio=Buffer.from(await response.arrayBuffer());
  if(audio.length<24||audio.length>1024*1024||audio.toString('ascii',0,4)!=='OggS')
    throw Error('Azure Speech retornou áudio inválido');
  return audio;
}
