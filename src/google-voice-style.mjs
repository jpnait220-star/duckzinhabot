import {spawn} from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

// Quando o Edge está indisponível, o Google TTS só fornece uma voz por idioma.
// Esses ajustes de áudio são presets de tom/ritmo, não vozes neurais diferentes.
const PRESETS={
  'pt-BR-FranciscaNeural':[1.05,1.01],
  'pt-BR-FranciscaFofaNeural':[1.27,1.09],
  'pt-BR-FranciscaSuaveNeural':[1.08,0.87],
  'pt-BR-FranciscaAnimadaNeural':[1.18,1.20],
  'pt-BR-FranciscaBemAnimadaNeural':[1.23,1.28],
  'pt-BR-FranciscaSuperAnimadaNeural':[1.31,1.38],
  'pt-BR-FranciscaFofaAnimadaNeural':[1.34,1.24],
  'pt-BR-ThalitaMultilingualNeural':[0.98,0.98],
  'pt-BR-ThalitaFofaNeural':[1.21,1.12],
  'pt-BR-ThalitaSuaveNeural':[0.94,0.88],
  'pt-BR-ThalitaAnimadaNeural':[1.12,1.20],
  'pt-BR-ThalitaSuperAnimadaNeural':[1.21,1.32],
  'pt-BR-AntonioNeural':[0.78,0.93],
  'pt-BR-AntonioAnimadoNeural':[0.88,1.16],
  'pt-BR-RaquelPortugalNeural':[1.07,0.97],
  'pt-BR-RaquelFofaNeural':[1.24,1.10],
  'pt-BR-RaquelAnimadaNeural':[1.15,1.19],
  'pt-BR-RaquelSuperAnimadaNeural':[1.23,1.29],
  'pt-BR-DuartePortugalNeural':[0.77,0.92],
  'pt-BR-DuarteAnimadoNeural':[0.86,1.15],
  'pt-BR-BrendaNeural':[1.02,1.0],
  'pt-BR-GiovannaNeural':[1.03,1.0],
  'pt-BR-LeilaNeural':[1.01,1.0],
  'pt-BR-ManuelaNeural':[0.99,1.0],
  'pt-BR-YaraNeural':[1.04,1.0]
};
export function googleVoicePreset(voice,tone='auto'){
  const item=PRESETS[voice];
  if(!item)throw Error('Estilo de voz desconhecido: '+String(voice));
  const variation={
    auto:[1,1],animada:[1.10,1.13],calma:[0.92,0.84],
    curiosa:[1.06,1.06],sonolenta:[0.90,0.79]
  }[tone]||[1,1];
  return {
    pitch:Math.min(1.52,Math.max(0.72,item[0]*variation[0])),
    speed:Math.min(1.50,Math.max(0.72,item[1]*variation[1]))
  };
}
export function googleVoiceFilter(voice,tone='auto'){
  const {pitch,speed}=googleVoicePreset(voice,tone);
  // O Google retorna MP3. A taxa é primeiro normalizada para evitar
  // que variações no arquivo de entrada afetem a afinação.
  const sampleRate=Math.round(24000*pitch);
  const tempo=(speed/pitch).toFixed(5);
  return 'aresample=24000,asetrate='+sampleRate+
    ',aresample=48000,atempo='+tempo;
}

export async function styleGoogleSpeechMp3(mp3,voice,{
  ffmpeg=ffmpegStatic,spawnProcess=spawn,timeoutMs=12000,tone='auto'
}={}){
  if(!Buffer.isBuffer(mp3)||mp3.length<128)throw Error('MP3 de entrada inválido');
  if(!ffmpeg)throw Error('ffmpeg-static indisponível nesta hospedagem');
  const args=[
    '-hide_banner','-loglevel','error','-nostdin',
    '-i','pipe:0','-vn','-af',googleVoiceFilter(voice,tone),
    '-c:a','libopus','-b:a','48k','-f','webm','pipe:1'
  ];
  return new Promise((resolve,reject)=>{
    let child;
    try{child=spawnProcess(ffmpeg,args,{stdio:['pipe','pipe','pipe']});}
    catch(err){reject(err);return;}
    const chunks=[];
    let size=0,stderr='',finished=false;
    const timer=setTimeout(()=>{
      fail(new Error('Processamento local da voz demorou demais'));
      child.kill();
    },timeoutMs);
    timer.unref?.();
    function finish(error,audio){
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      if(error)reject(error);else resolve(audio);
    }
    function fail(error){finish(error);}
    child.on('error',fail);
    child.stderr.on('data',part=>{stderr=(stderr+String(part)).slice(-400);});
    child.stdout.on('data',part=>{
      size+=part.length;
      if(size>3*1024*1024){
        fail(new Error('Áudio convertido excedeu 3MB'));
        child.kill();
      }else chunks.push(part);
    });
    child.on('close',code=>{
      if(finished)return;
      const out=Buffer.concat(chunks);
      if(code!==0)return fail(new Error('FFmpeg encerrou com código '+code+': '+stderr.slice(-160)));
      if(out.length<24||out[0]!==0x1a||out[1]!==0x45||out[2]!==0xdf||out[3]!==0xa3)
        return fail(new Error('FFmpeg não gerou WebM/Opus válido'));
      finish(null,out);
    });
    child.stdin.on('error',fail);
    child.stdin.end(mp3);
  });
}
