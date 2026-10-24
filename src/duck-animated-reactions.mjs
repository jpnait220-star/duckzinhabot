import {renderAvatar} from './duck-avatar.mjs';
import {runFfmpeg} from './duck-voice-message.mjs';

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
 const gif=await runFfmpeg(data,['-f','image2pipe','-vcodec','png','-framerate','3',
 '-i','pipe:0','-vf','scale=192:192:flags=lanczos','-loop','0','-f','gif','pipe:1'],
 {timeoutMs:25000,maxBytes:2*1024*1024});
 if(gif.subarray(0,3).toString('ascii')!=='GIF')throw Error('GIF inválido');
 cache.set(type,gif);
 return gif;
}
