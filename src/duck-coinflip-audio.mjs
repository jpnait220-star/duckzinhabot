import {spawn} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

// Sintetiza dois efeitos curtos, distintos, como MP3 sem serviço externo ou ENV.
const cache=new Map();
export function coinPcm(side,{rate=16000}={}){
  if(!['cara','coroa'].includes(side))throw Error('Lado inválido');
  const duration=1.25,count=Math.ceil(rate*duration),pcm=Buffer.alloc(count*2);
  for(let i=0;i<count;i++){
    const t=i/rate;
    const spin=Math.sin(2*Math.PI*(1250+220*Math.sin(t*19))*t)*
      Math.exp(-9*t)*.22;
    let chime=0;
    const tones=side==='cara'?[690,1040,1380]:[540,390,275];
    for(let n=0;n<3;n++){
      const start=.28+n*.15,v=t-start;
      if(v>=0){
        chime+=Math.sin(2*Math.PI*tones[n]*v)*Math.exp(-8*v)*.25;
        chime+=Math.sin(2*Math.PI*tones[n]*2.5*v)*Math.exp(-17*v)*.04;
      }
    }
    const tail=t>.82?Math.sin(2*Math.PI*(side==='cara'?1320:310)*(t-.82))*
      Math.exp(-13*(t-.82))*.12:0;
    const fade=Math.min(1,t*40)*Math.min(1,(duration-t)*18);
    const value=Math.max(-.9,Math.min(.9,(spin+chime+tail)*fade));
    pcm.writeInt16LE(Math.round(value*32767),i*2);
  }
  return {pcm,rate};
}
export async function coinMp3(side,{binary=ffmpeg,spawnProcess=spawn}={}){
  if(!['cara','coroa'].includes(side))throw Error('Lado inválido');
  if(cache.has(side))return cache.get(side);
  if(!binary)throw Error('FFmpeg não está disponível');
  const {pcm,rate}=coinPcm(side);
  const encoded=await new Promise((resolve,reject)=>{
    const child=spawnProcess(binary,['-hide_banner','-loglevel','error','-nostdin',
      '-f','s16le','-ar',String(rate),'-ac','1','-i','pipe:0',
      '-c:a','libmp3lame','-b:a','48k','-f','mp3','pipe:1'],
    {stdio:['pipe','pipe','pipe']});
    let chunks=[],size=0,done=false,errOut='';
    const timeout=setTimeout(()=>{
      child.kill();finish(Error('Conversão de moeda demorou demais'));
    },12000);timeout.unref?.();
    function finish(err,val){
      if(done)return;done=true;clearTimeout(timeout);
      if(err)reject(err);else resolve(val);
    }
    child.on('error',finish);
    child.stderr.on('data',d=>{errOut=(errOut+String(d)).slice(-180);});
    child.stdout.on('data',chunk=>{
      size+=chunk.length;
      if(size>100000){child.kill();finish(Error('MP3 muito grande'));}
      else chunks.push(chunk);
    });
    child.stdin.on('error',finish);
    child.on('close',code=>{
      if(done)return;
      if(code!==0)return finish(Error('FFmpeg '+code+': '+errOut));
      const mp3=Buffer.concat(chunks);
      if(mp3.length<500)return finish(Error('MP3 vazio'));
      finish(null,mp3);
    });
    child.stdin.end(pcm);
  });
  cache.set(side,encoded);
  return encoded;
}
