import {deflateSync} from 'node:zlib';
import {avatarPixels} from './duck-profile-card.mjs';
import {normalizeAvatar} from './duck-avatar.mjs';
const W=880,H=460;
const CRC=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function chunk(name,data){
 const n=Buffer.alloc(4);n.writeUInt32BE(data.length);
 let c=0xffffffff;for(const v of Buffer.concat([Buffer.from(name),data]))c=CRC[(c^v)&255]^(c>>>8);
 const check=Buffer.alloc(4);check.writeUInt32BE((c^0xffffffff)>>>0);
 return Buffer.concat([n,Buffer.from(name),data,check]);
}
function png(pixel){
 const raw=Buffer.alloc(H*(W*4+1));
 for(let y=0;y<H;y++)pixel.copy(raw,y*(W*4+1)+1,y*W*4,(y+1)*W*4);
 const info=Buffer.alloc(13);info.writeUInt32BE(W,0);info.writeUInt32BE(H,4);info[8]=8;info[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',info),
   chunk('IDAT',deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);
}
function paint(p,x,y,c){
 if(x<0||y<0||x>=W||y>=H)return;
 const j=(y*W+x)*4;p[j]=c[0];p[j+1]=c[1];p[j+2]=c[2];p[j+3]=255;
}
function block(p,x,y,w,h,c){
 for(let j=Math.max(0,Math.floor(y));j<Math.min(H,Math.ceil(y+h));j++)
 for(let i=Math.max(0,Math.floor(x));i<Math.min(W,Math.ceil(x+w));i++)paint(p,i,j,c);
}
function oval(p,x,y,rx,ry,c){
 for(let j=Math.max(0,Math.floor(y-ry));j<Math.min(H,Math.ceil(y+ry));j++)
 for(let i=Math.max(0,Math.floor(x-rx));i<Math.min(W,Math.ceil(x+rx));i++)
 if(((i-x)/rx)**2+((j-y)/ry)**2<=1)paint(p,i,j,c);
}
function sprite(p,avatar,x,y,w,{facingBack=false}={}){
 // Os sprites partem do mesmo renderizador do /avatar e mantêm as personalizações.
 const a=normalizeAvatar(avatar);
 const src=avatarPixels(a);
 const scale=w/src.w,h=Math.round(src.h*scale);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   const sx=Math.min(src.w-1,Math.floor(i/scale)),sy=Math.min(src.h-1,Math.floor(j/scale));
   // Cropping de fundo por diferença cromática não é necessário: o cenário
   // usa os próprios retratos quadrados com borda de carta consistente.
   const k=(sy*src.w+sx)*4;
   const c=[src.pixels[k],src.pixels[k+1],src.pixels[k+2]];
   paint(p,x+i,y+j,c);
 }
 // Indicador discreto de posição, sem alterar roupas ou rosto do jogador.
 if(facingBack){block(p,x+6,y+h-13,w-12,6,[77,61,108]);}
}
function bar(p,x,y,w,value,max){
 block(p,x-2,y-2,w+4,20,[20,23,36]);block(p,x,y,w,16,[76,70,95]);
 block(p,x,y,Math.round(w*Math.max(0,Math.min(1,value/Math.max(1,max)))),16,
   value/max>.5?[99,215,129]:value/max>.24?[249,201,89]:[239,103,102]);
}
const SKY=[172,223,243],DARK=[30,35,56],CREAM=[248,238,213],SEA=[110,180,192];
export function renderBattleScene({players=[],turn=0,movesTaken=0,scene='turn'}={}){
 const pixels=Buffer.alloc(W*H*4);
 for(let y=0;y<H;y++){
   const t=y/H;
   const c=y<285?[Math.round(SKY[0]*(1-t*.3)),Math.round(SKY[1]*(1-t*.13)),Math.round(SKY[2]*(1-t*.1))]:
     [Math.round(123+t*55),Math.round(184+t*40),Math.round(122+t*45)];
   block(pixels,0,y,W,1,c);
 }
 oval(pixels,730,81,65,65,[255,249,214]);
 for(const [x,y,w] of [[80,100,150],[320,55,190],[570,125,145]]){
   oval(pixels,x,y,w*.55,21,[241,251,251]);oval(pixels,x+22,y-11,w*.31,23,[241,251,251]);
 }
 oval(pixels,220,310,200,42,[92,149,114]);oval(pixels,670,264,180,35,[93,154,127]);
 oval(pixels,220,294,174,30,CREAM);oval(pixels,670,250,160,25,CREAM);
 const a=players[0],b=players[1];
 if(a?.avatar)sprite(pixels,a.avatar,65,154,255,{facingBack:true});
 if(b?.avatar)sprite(pixels,b.avatar,563,70,240);
 block(pixels,16,14,375,60,CREAM);block(pixels,20,18,367,52,DARK);
 block(pixels,489,14,375,60,CREAM);block(pixels,493,18,367,52,DARK);
 bar(pixels,38,52,325,a?.hp??1,a?.max??1);
 bar(pixels,515,52,325,b?.hp??1,b?.max??1);
 // Caixa fixa inferior estilo aventura em turnos.
 block(pixels,16,368,848,79,[239,223,191]);
 block(pixels,22,374,836,67,[42,45,67]);
 block(pixels,29,382,Math.min(800,Math.max(65,movesTaken*14)),5,[246,209,110]);
 // Estado do turno indicado no marcador superior esquerdo/direito.
 oval(pixels,turn===0?407:474,35,14,14,[255,216,108]);
 if(scene==='victory')oval(pixels,437,345,40,16,[255,222,107]);
 return png(pixels);
}
