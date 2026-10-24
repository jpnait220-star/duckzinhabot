import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile,unlink} from 'node:fs/promises';
import ffmpegStatic from 'ffmpeg-static';
import {COIN_VIDEO,renderFrame} from './duck-coinflip-video.mjs';

// GIF se reproduz automaticamente na mensagem do Discord, sem áudio.
const cache=new Map(),inflight=new Map();
export async function coinflipGif(side,{
  binary=ffmpegStatic,spawnProcess=spawn,outputDir=tmpdir(),
  maxBytes=8*1024*1024,timeoutMs=60000
}={}){
  if(side!=='cara'&&side!=='coroa')throw Error('Lado de moeda inválido.');
  const useCache=binary===ffmpegStatic&&spawnProcess===spawn&&outputDir===tmpdir();
  if(useCache&&cache.has(side))return cache.get(side);
  if(useCache&&inflight.has(side))return inflight.get(side);
  const task=async()=>{
    if(!binary)throw Error('FFmpeg não encontrado na FadeHost.');
    const output=join(outputDir,'duckzinha-coin-'+randomUUID()+'.gif');
    const args=[
      '-hide_banner','-loglevel','error','-y','-nostdin',
      '-f','rawvideo','-pix_fmt','rgb24',
      '-video_size',COIN_VIDEO.width+'x'+COIN_VIDEO.height,
      '-framerate',String(COIN_VIDEO.fps),'-i','pipe:0',
      '-filter_complex',
      '[0:v]fps=12,scale=384:-1:flags=neighbor,split[s0][s1];'+
      '[s0]palettegen=stats_mode=diff[p];'+
      '[s1][p]paletteuse=dither=bayer:bayer_scale=4[v]',
      '-map','[v]','-loop','0',output
    ];
    try{
      await new Promise((resolve,reject)=>{
        const child=spawnProcess(binary,args,{stdio:['pipe','ignore','pipe']});
        let done=false,errorLog='';
        const timer=setTimeout(()=>{
          child.kill();
          finish(new Error('Tempo limite ao gerar GIF da moeda.'));
        },timeoutMs);
        timer.unref?.();
        function finish(error){
          if(done)return;
          done=true;
          clearTimeout(timer);
          if(error)reject(error);else resolve();
        }
        child.on('error',finish);
        child.stderr.on('data',buf=>{errorLog=(errorLog+String(buf)).slice(-900);});
        child.stdin.on('error',err=>{
          if(err.code!=='EPIPE')finish(err);
        });
        child.on('close',code=>code===0?finish():finish(new Error(
          'FFmpeg falhou ao criar GIF ('+code+'): '+errorLog.slice(-250))));
        void (async()=>{
          try{
            const total=Math.round(COIN_VIDEO.fps*COIN_VIDEO.seconds);
            for(let i=0;i<total;i++){
              if(done)return;
              const frame=renderFrame(side,i);
              if(!child.stdin.write(frame)){
                await new Promise((res,rej)=>{
                  child.stdin.once('drain',res);
                  child.stdin.once('error',rej);
                });
              }
            }
            child.stdin.end();
          }catch(error){
            child.kill();
            finish(error);
          }
        })();
      });
      const gif=await readFile(output);
      if(gif.length<500||gif.length>maxBytes||
        !['GIF89a','GIF87a'].includes(gif.toString('ascii',0,6))){
        throw Error('GIF inválido ou maior que o limite do Discord.');
      }
      if(useCache)cache.set(side,gif);
      return gif;
    }finally{
      await unlink(output).catch(()=>{});
    }
  };
  const promise=task();
  if(useCache)inflight.set(side,promise);
  try{return await promise;}
  finally{if(useCache)inflight.delete(side);}
}
