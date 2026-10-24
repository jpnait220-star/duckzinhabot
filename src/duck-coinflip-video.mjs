import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile,unlink} from 'node:fs/promises';
import ffmpegStatic from 'ffmpeg-static';
import {coinPcm} from './duck-coinflip-audio.mjs';

export const COIN_VIDEO={width:512,height:288,fps:20,seconds:3.4};
const {width:W,height:H,fps:FPS,seconds:DURATION}=COIN_VIDEO;
const TAU=Math.PI*2;
const clip=(x,min=0,max=255)=>Math.max(min,Math.min(max,x));
const smooth=t=>{t=clip(t,0,1);return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
const GOLD=[237,181,60];
const FONT={
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'B':['11110','10001','11110','10001','10001','10001','11110'],
 'C':['01111','10000','10000','10000','10000','10000','01111'],
 'D':['11110','10001','10001','10001','10001','10001','11110'],
 'E':['11111','10000','11110','10000','10000','10000','11111'],
 'F':['11111','10000','11110','10000','10000','10000','10000'],
 'G':['01111','10000','10000','10111','10001','10001','01110'],
 'H':['10001','10001','11111','10001','10001','10001','10001'],
 'I':['11111','00100','00100','00100','00100','00100','11111'],
 'J':['00111','00010','00010','00010','10010','10010','01100'],
 'K':['10001','10010','11100','11000','10100','10010','10001'],
 'L':['10000','10000','10000','10000','10000','10000','11111'],
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'N':['10001','11001','10101','10011','10001','10001','10001'],
 'O':['01110','10001','10001','10001','10001','10001','01110'],
 'P':['11110','10001','11110','10000','10000','10000','10000'],
 'Q':['01110','10001','10001','10001','10101','10010','01101'],
 'R':['11110','10001','11110','10100','10010','10001','10001'],
 'S':['01111','10000','01110','00001','00001','00001','11110'],
 'T':['11111','00100','00100','00100','00100','00100','00100'],
 'U':['10001','10001','10001','10001','10001','10001','01110'],
 'V':['10001','10001','10001','10001','10001','01010','00100'],
 'W':['10001','10001','10001','10101','10101','11011','10001'],
 'X':['10001','10001','01010','00100','01010','10001','10001'],
 'Y':['10001','10001','01010','00100','00100','00100','00100'],
 'Z':['11111','00001','00010','00100','01000','10000','11111'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00110','01000','10000','11111'],
 '3':['11110','00001','00110','00001','00001','10001','11110'],
 '/':['00001','00001','00010','00100','01000','10000','10000'],
 ' ':['00000','00000','00000','00000','00000','00000','00000']
};
function drawBuffer(width,height){
 const buf=Buffer.allocUnsafe(width*height*3);
 function pixel(x,y,rgb,opacity=1){
  x=Math.round(x);y=Math.round(y);
  if(x<0||y<0||x>=width||y>=height)return;
  const i=(y*width+x)*3;
  for(let k=0;k<3;k++)
   buf[i+k]=clip(Math.round(mix(buf[i+k],rgb[k],opacity)));
 }
 function circle(cx,cy,rx,ry,rgb,opacity=1){
  const lo=Math.max(0,Math.floor(cy-ry)),hi=Math.min(height-1,Math.ceil(cy+ry));
  for(let y=lo;y<=hi;y++){
   const dy=(y-cy)/ry,span=rx*Math.sqrt(Math.max(0,1-dy*dy));
   const left=Math.max(0,Math.floor(cx-span)),right=Math.min(width-1,Math.ceil(cx+span));
   for(let x=left;x<=right;x++)pixel(x,y,rgb,opacity);
  }
 }
 function line(x1,y1,x2,y2,color,thick=1,alpha=1){
  const steps=Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))*1.7);
  for(let i=0;i<=steps;i++){
   const t=i/Math.max(1,steps),x=mix(x1,x2,t),y=mix(y1,y2,t);
   circle(x,y,thick/2,thick/2,color,alpha);
  }
 }
 function polygon(vertices,color,opacity=1){
  const y0=Math.max(0,Math.floor(Math.min(...vertices.map(p=>p[1]))));
  const y1=Math.min(height-1,Math.ceil(Math.max(...vertices.map(p=>p[1]))));
  for(let y=y0;y<=y1;y++){
   const intersections=[];
   for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length];
    if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))
     intersections.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }
   intersections.sort((a,b)=>a-b);
   for(let k=0;k+1<intersections.length;k+=2)
    for(let x=Math.round(intersections[k]);x<=intersections[k+1];x++)
     pixel(x,y,color,opacity);
  }
 }
 function text(word,x,y,size=2,color=[255,244,199],spacing=1){
  let pos=x;
  for(const c of String(word).toUpperCase()){
   const grid=FONT[c]||FONT[' '];
   for(let j=0;j<7;j++)for(let i=0;i<5;i++)
    if(grid[j][i]==='1'){
     for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++)
      pixel(pos+i*size+dx,y+j*size+dy,color);
    }
   pos+=(5+spacing)*size;
  }
 }
 function star(x,y,r,color,alpha=.9){
  const v=[];
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4;
   const radius=i%2?r*.18:r;
   v.push([x+Math.cos(angle)*radius,y+Math.sin(angle)*radius]);
  }
  polygon(v,color,alpha);
 }
 return {buf,pixel,circle,line,polygon,text,star};
}

function makeTexture(side){
 const N=256,d=drawBuffer(N,N),cx=128,cy=128;
 const sun=[252,216,108],gold=[223,145,41],edge=[106,65,29];
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const px=(x-cx)/124,py=(y-cy)/124,r=Math.hypot(px,py);
  const idx=(y*N+x)*3;
  if(r>1){d.buf[idx]=0;d.buf[idx+1]=0;d.buf[idx+2]=0;continue;}
  const ring=r>.95?.45:r>.91?.86:r>.86?.56:r>.82?.91:r>.75?.18:.0;
  const light=clip(.55+(1-px)*.22+(1-py)*.13+Math.cos(r*80)*.026,0,1);
  const tint=r>.95?edge:ring>.7?sun:gold;
  for(let k=0;k<3;k++)d.buf[idx+k]=clip(Math.round(
   (mix(gold[k],sun[k],light)+ (tint[k]-gold[k])*ring*.35)
  ));
 }
 const D=[105,62,26],SH=[255,246,180],EM=[158,88,35],INK=[92,58,37];
 // Rebordo duplo, serrilhas e escrita em baixo relevo.
 for(let a=0;a<TAU;a+=.025){
  for(const r of [114,105,85]){
   const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
   d.circle(x,y,r===114?1.9:1,1.2,r===105?SH:D,r===114?.8:.75);
  }
 }
 for(let i=0;i<72;i++){
  const a=i/72*TAU;
  d.line(cx+Math.cos(a)*116,cy+Math.sin(a)*116,
   cx+Math.cos(a)*121,cy+Math.sin(a)*121,i%2?EM:SH,1,.83);
 }
 for(let i=0;i<12;i++){
  const a=i*TAU/12;
  d.star(cx+Math.cos(a)*94,cy+Math.sin(a)*94,i%3===0?4:2.6,SH,.7);
 }
 if(side==='cara'){
  // Pato em relevo: cabeça, topete, olhos, bico, asas e penas.
  d.circle(128,121,47,45,D,.2);
  d.circle(128,116,48,44,SH,.44);
  d.circle(129,119,43,41,GOLD,.92);
  d.circle(111,89,16,10,SH,.8);d.circle(138,87,16,11,SH,.7);
  d.circle(111,115,7.3,9,INK,.95);d.circle(146,115,7.3,9,INK,.95);
  d.circle(113,112,2.9,3.6,SH,.98);d.circle(148,112,2.9,3.6,SH,.98);
  d.circle(104,130,8,4,[243,161,102],.56);
  d.circle(153,130,8,4,[243,161,102],.56);
  d.circle(128,142,27,15,D,.46);
  d.circle(128,138,29,14,[245,155,65],.95);
  d.circle(121,132,13,4,SH,.6);
  d.circle(90,157,20,8,EM,.5);d.circle(167,157,20,8,EM,.5);
  d.line(88,158,106,163,D,3,.45);d.line(169,158,149,164,D,3,.45);
  d.text('DUCK',103,180,3,D);
 }else{
  // Coroa real de pato com pedras lapidadas e contornos de ouro.
  d.polygon([[79,156],[73,105],[94,127],[112,78],[130,118],[153,78],
    [165,126],[185,100],[175,157]],D,.48);
  d.polygon([[82,151],[79,110],[96,133],[112,85],[130,124],
    [152,86],[164,130],[179,110],[171,151]],SH,.95);
  d.polygon([[90,146],[88,122],[102,144],[114,101],[130,134],
    [150,99],[162,144],[171,123],[165,146]],[235,159,55],.99);
  d.line(84,149,173,149,EM,7,.8);
  d.line(86,146,172,146,SH,3,.88);
  for(const [x,y] of [[112,130],[131,138],[152,130]]){
   d.circle(x,y,6,8,D,.8);d.circle(x,y-2,4,6,[109,188,222],.96);
   d.star(x-1,y-4,2,SH,.97);
  }
  d.circle(130,88,9,10,D,.8);d.circle(130,84,6,7,[238,82,72],1);
  d.circle(131,81,2,3,SH,.9);
  d.text('COROA',87,180,3,D);
 }
 return d.buf;
}
const texCara=makeTexture('cara'),texCoroa=makeTexture('coroa');
function background(time){
 const d=drawBuffer(W,H);
 const t=time/DURATION;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const u=(x-W*.5)/W,v=(y-130)/H;
  const r=Math.hypot(u*1.5,v*1.55);
  const spot=Math.max(0,1-r);
  const dust=Math.sin((x*.21+y*.12))*1.3;
  const grain=(Math.sin(x*73.13+y*27.87)*.5+.5)*3;
  const i=(y*W+x)*3;
  d.buf[i]=clip(13+spot*22+grain);
  d.buf[i+1]=clip(18+spot*25+dust);
  d.buf[i+2]=clip(36+spot*37+grain);
 }
 // Colunas de luz, plataforma de exposição, reflexos e poeira mágica.
 for(let i=0;i<14;i++){
  const x=(i*89+31)%W,y=(i*53+17)%H;
  const x2=x+Math.sin(t*TAU+i)*8,y2=y+Math.cos(t*TAU+i)*3;
  d.circle(x2,y2,1.2+i%3,1.2+i%3,[252,213,127],.35+(i%4)*.12);
  if(i%4===0)d.star(x2,y2,5,[255,233,170],.7);
 }
 d.circle(256,247,165,19,[174,109,40],.12);
 d.circle(256,252,138,10,[14,10,23],.7);
 d.line(36,264,476,264,[201,149,74],1,.3);
 d.line(75,274,438,274,[119,92,70],1,.23);
 d.text('DUCKZINHA COINFLIP',147,13,3,[243,216,146]);
 d.text('3 RODADAS',215,39,2,[151,172,209]);
 return d;
}

function renderFrame(side,frame,{width=W,height=H,fps=FPS}={}){
 if(width!==W||height!==H||fps!==FPS)throw Error('Dimensões de vídeo não suportadas.');
 const t=frame/Math.max(1,Math.round(DURATION*FPS)-1);
 const d=background(frame/FPS);
 // Giro rápido, pouso com um rebote e oscilação até a face sorteada.
 const landing=smooth((t-.53)/.31);
 const finish=8*Math.PI+(side==='coroa'?Math.PI:0);
 const rotation=finish*(1-Math.pow(1-smooth(Math.min(1,t/.82)),1.18));
 const remaining=1-smooth((t-.74)/.26);
 const theta=rotation+remaining*Math.sin(t*63)*.08;
 const projected=Math.cos(theta),face=projected>=0?'cara':'coroa';
 const texture=face==='cara'?texCara:texCoroa;
 const flip=Math.abs(projected);
 const rx=6+82*flip,ry=83;
 const bounce=t<.72?Math.sin(Math.PI*t/.72)*66:Math.abs(Math.sin((t-.72)*Math.PI*11))*24*(1-smooth((t-.72)/.24));
 const xCenter=256+Math.sin(t*TAU*1.4)*6*(1-landing);
 const yCenter=157-bounce+(t<.19?17*(1-t/.19):0);
 const shadowWidth=115-bounce*.3;
 d.circle(256,244,shadowWidth,11,[0,0,0],.38);
 d.circle(256,242,shadowWidth*.7,6,[248,193,97],.12);
 // Faixa da moeda: espessura, microdentes e chanfro dourado.
 for(let layer=9;layer>=0;layer--){
  const yy=yCenter+layer*.64,shift=3+Math.sin(theta)*6;
  d.circle(xCenter+shift,yy,rx+layer*.24,ry,
    layer%3===0?[234,161,51]:layer<5?[133,79,27]:[187,111,36],.94);
 }
 d.circle(xCenter,yCenter,rx+3,ry+3,[72,42,17],1);
 d.circle(xCenter,yCenter,rx+1.6,ry+1.5,[255,225,135],.98);
 const lx=Math.floor(xCenter-rx),hx=Math.ceil(xCenter+rx);
 const ly=Math.floor(yCenter-ry),hy=Math.ceil(yCenter+ry);
 const absCos=Math.max(.001,flip);
 for(let y=Math.max(0,ly);y<Math.min(H,hy);y++){
  const v=(y-yCenter)/ry;
  for(let x=Math.max(0,lx);x<Math.min(W,hx);x++){
   const u=(x-xCenter)/rx;
   const q=u*u+v*v;
   if(q>=1)continue;
   const tx=clip(Math.floor((projected<0?1-u:u)*127.5),0,255);
   const ty=clip(Math.floor((v+1)*127.5),0,255);
   const k=(ty*256+tx)*3;
   const r=Math.sqrt(q);
   const edge=r>.95?1:r>.91?.75:r>.84?.3:0;
   const reflection=clip(.68+(1-u)*.15+(1-v)*.12+Math.sin(theta)*.08,0,1.2);
   const stripe=Math.pow(Math.max(0,Math.sin((u+.18)*9+theta*.6)),12)*.25;
   const rgb=[0,1,2].map(j=>clip(Math.round(
     (texture[k+j]*(reflection+stripe)+(j===0?38:j===1?20:3)*edge)*(.97-edge*.13))));
   d.pixel(x,y,rgb);
  }
 }
 if(flip<.20){
  d.line(xCenter,yCenter-76,xCenter,yCenter+74,[255,236,161],Math.max(2,rx*1.2),.72);
 }
 // Arcos luminosos de rotação e faíscas da queda da moeda.
 const sparks=landing;
 for(let i=0;i<12;i++){
  const a=i/12*TAU+frame*.07,rad=92+i%3*16;
  const sx=xCenter+Math.cos(a)*rad,sy=yCenter+Math.sin(a)*rad*.81;
  d.star(sx,sy,2.2+i%3,[255,223,137],(1-landing)*.24+.36);
 }
 if(t>.71){
  const flash=Math.max(0,1-Math.abs(t-.78)/.12);
  for(let i=0;i<18;i++){
   const a=i/18*TAU,r=94+flash*38;
   d.star(xCenter+Math.cos(a)*r,yCenter+Math.sin(a)*r*.7,2+i%4,
     [255,233,163],flash*.79);
  }
 }
 if(t>.78){
  const label=side==='cara'?'CARA':'COROA';
  const s=smooth((t-.78)/.12);
  const color=side==='cara'?[251,205,104]:[182,216,255];
  const xx=(W-label.length*27)/2;
  d.text(label,xx,258,4,color);
  d.line(176,248,338,248,color,2,s*.7);
 }
 return d.buf;
}
function resultAudio(side){
 const sampleRate=16000,count=Math.ceil(sampleRate*DURATION);
 const buffer=Buffer.alloc(count*2);
 const {pcm}=coinPcm(side);
 for(let i=0;i<count;i++){
  const t=i/sampleRate;
  const swell=Math.sin(2*Math.PI*(340+380*t*t)*t)*Math.sin(2*Math.PI*13*t)*
    Math.pow(Math.max(0,1-t/2.4),1.6)*.07;
  const impact=t>2.45?Math.sin(2*Math.PI*137*(t-2.45))*Math.exp(-(t-2.45)*21)*.2:0;
  let ding=0;
  const offset=i-Math.round(sampleRate*2.0);
  if(offset>=0&&offset*2<pcm.length)ding=pcm.readInt16LE(offset*2)/32768*.8;
  const fade=Math.min(1,t*30)*Math.min(1,(DURATION-t)*12);
  buffer.writeInt16LE(Math.round(clip((swell+impact+ding)*fade,-.94,.94)*32767),i*2);
 }
 return buffer;
}

const cache=new Map(),inflight=new Map();
export async function coinflipVideo(side,{
 binary=ffmpegStatic,spawnProcess=spawn,outputDir=tmpdir(),
 maxBytes=7*1024*1024,timeoutMs=40000
}={}){
 if(side!=='cara'&&side!=='coroa')throw Error('Lado de moeda inválido.');
 const useCache=binary===ffmpegStatic&&spawnProcess===spawn&&outputDir===tmpdir();
 if(useCache&&cache.has(side))return cache.get(side);
 if(useCache&&inflight.has(side))return inflight.get(side);
 const task=async()=>{
  if(!binary)throw Error('FFmpeg não disponível para vídeo.');
  const output=join(outputDir,'duckzinha-coin-'+randomUUID()+'.mp4');
  const args=['-hide_banner','-loglevel','error','-y','-nostdin',
    '-f','rawvideo','-pix_fmt','rgb24','-video_size',W+'x'+H,
    '-framerate',String(FPS),'-i','pipe:0',
    '-f','s16le','-ar','16000','-ac','1','-i','pipe:3',
    '-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','ultrafast',
    '-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','64k',
    '-t',String(DURATION),'-movflags','+faststart',output];
  try{
   await new Promise((resolve,reject)=>{
    const child=spawnProcess(binary,args,{stdio:['pipe','ignore','pipe','pipe']});
    let done=false,errorLog='';
    const timer=setTimeout(()=>{
     child.kill();finish(Error('Tempo limite para criar vídeo da moeda.'));
    },timeoutMs);
    timer.unref?.();
    function finish(error){
     if(done)return;done=true;clearTimeout(timer);
     if(error)reject(error);else resolve();
    }
    child.on('error',finish);
    child.stderr.on('data',buf=>{errorLog=(errorLog+String(buf)).slice(-1100);});
    child.stdin.on('error',err=>{if(err.code!=='EPIPE')finish(err);});
    child.stdio[3].on('error',err=>{if(err.code!=='EPIPE')finish(err);});
    child.on('close',code=>code===0?finish():finish(Error(
      'Não foi possível criar o vídeo (FFmpeg '+code+'): '+errorLog.slice(-250))));
    child.stdio[3].end(resultAudio(side));
    void (async()=>{
     try{
      for(let i=0;i<Math.round(FPS*DURATION);i++){
       if(done)break;
       const frame=renderFrame(side,i);
       if(!child.stdin.write(frame))await new Promise((res,rej)=>{
         child.stdin.once('drain',res);child.stdin.once('error',rej);
       });
      }
      child.stdin.end();
     }catch(err){child.kill();finish(err);}
    })();
   });
   const video=await readFile(output);
   if(video.length<2000||video.length>maxBytes)
    throw Error('Vídeo inválido ou excede o tamanho permitido.');
   if(video.toString('ascii',4,8)!=='ftyp')
    throw Error('O FFmpeg não gerou um MP4 válido.');
   if(useCache)cache.set(side,video);
   return video;
  }finally{await unlink(output).catch(()=>{});}
 };
 const promise=task();
 if(useCache)inflight.set(side,promise);
 try{return await promise;}
 finally{if(useCache)inflight.delete(side);}
}
export {renderFrame,resultAudio};
