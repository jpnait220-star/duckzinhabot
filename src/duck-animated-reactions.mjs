import {renderAvatar} from './duck-avatar.mjs';
import {spawn} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const sequences={
 ola:[['acenando','feliz'],['normal','feliz'],['acenando','piscando'],['normal','feliz']],
 riso:[['comemorando','feliz'],['normal','feliz'],['comemorando','feliz'],['normal','piscando']],
 fofo:[['coracao','feliz'],['coracao','piscando'],['coracao','feliz'],['normal','feliz']],
 gg:[['comemorando','determinado'],['comemorando','feliz'],['acenando','feliz'],['comemorando','feliz']],
 surpresa:[['normal','normal'],['de_lado','normal'],['normal','feliz'],['de_lado','piscando']]
};
const cache=new Map();
export function reactionFrames(type){
 const seq=sequences[type];
 if(!seq)return null;
 return seq.map(([pose,olhos])=>renderAvatar({pose,olhos,corpo:'amarelo',
   roupa:'moletom',aura:type==='gg'?'estrelas':type==='fofo'?'coracoes':'brilho',
   fundo:type==='surpresa'?'lilas':'ceu'}));
}
export async function animatedDuckReaction(type){
 if(cache.has(type))return cache.get(type);
 const frames=reactionFrames(type);
 if(!frames)return null;
 // Compõe um GIF real e repetível usando ffmpeg-static já instalado no projeto.
 const data=Buffer.concat(frames);
 const gif=await new Promise((resolve,reject)=>{
   if(!ffmpeg)return reject(Error('FFmpeg indisponível'));
   const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostdin',
     '-f','image2pipe','-vcodec','png','-framerate','3','-i','pipe:0',
     '-vf','scale=192:192:flags=lanczos','-loop','0','-f','gif','pipe:1'],
     {stdio:['pipe','pipe','pipe']});
   const chunks=[];let bytes=0,stderr='',done=false;
   const finish=(err,buffer)=>{if(done)return;done=true;clearTimeout(timer);if(err)reject(err);else resolve(buffer);};
   const timer=setTimeout(()=>{child.kill();finish(Error('GIF demorou demais'));},25000);
   timer.unref?.();
   child.stdout.on('data',b=>{
      bytes+=b.length;
      if(bytes>2*1024*1024){child.kill();finish(Error('GIF excede 2 MB'));}
      else chunks.push(b);
   });
   child.stderr.on('data',b=>{stderr=(stderr+String(b)).slice(-400);});
   child.on('error',e=>finish(e));
   child.on('close',code=>code===0?finish(null,Buffer.concat(chunks)):
     finish(Error('Falha FFmpeg '+code+': '+stderr)));
   child.stdin.on('error',e=>finish(e));
   child.stdin.end(data);
 });
 if(gif.subarray(0,3).toString('ascii')!=='GIF')throw Error('GIF inválido');
 cache.set(type,gif);
 return gif;
}
