import {inflateSync,deflateSync} from 'node:zlib';
import {renderAvatar,normalizeAvatar} from './duck-avatar.mjs';
const W=720,H=360;
const crcTable=Uint32Array.from({length:256},(_,n)=>{
 let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
function chunk(type,data){
 const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 let crc=0xffffffff;
 for(const b of Buffer.concat([Buffer.from(type),data]))crc=crcTable[(crc^b)&255]^(crc>>>8);
 const out=Buffer.alloc(4);out.writeUInt32BE((crc^0xffffffff)>>>0);
 return Buffer.concat([len,Buffer.from(type),data,out]);
}
function encode(pixels,w,h){
 const raw=Buffer.alloc(h*(w*4+1));
 for(let i=0;i<h;i++)pixels.copy(raw,i*(w*4+1)+1,i*w*4,(i+1)*w*4);
 const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
 chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);
}
export function avatarPixels(avatar){
 const png=renderAvatar(avatar);
 const w=png.readUInt32BE(16),h=png.readUInt32BE(20);
 const chunks=[];let p=8;
 while(p+12<=png.length){
  const n=png.readUInt32BE(p),kind=png.toString('ascii',p+4,p+8);
  if(kind==='IDAT')chunks.push(png.subarray(p+8,p+8+n));
  p+=12+n;if(kind==='IEND')break;
 }
 const raw=inflateSync(Buffer.concat(chunks));
 const pix=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++)raw.copy(pix,y*w*4,y*(w*4+1)+1,(y+1)*(w*4+1));
 return {pixels:pix,w,h};
}
const FONT={
 A:['01110','10001','10001','11111','10001','10001','10001'],
 B:['11110','10001','11110','10001','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','11110','10000','10000','10000','11111'],
 F:['11111','10000','11110','10000','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01110'],
 H:['10001','10001','11111','10001','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 J:['00111','00010','00010','00010','10010','10010','01100'],
 K:['10001','10010','11100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'],
 N:['10001','11001','10101','10011','10001','10001','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','11110','10000','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'],
 R:['11110','10001','11110','10100','10010','10001','10001'],
 S:['01111','10000','01110','00001','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],
 V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10101','10101','11011','10001'],
 X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 Z:['11111','00001','00010','00100','01000','10000','11111'],
 0:['01110','10011','10101','10101','11001','10001','01110'],
 1:['00100','01100','00100','00100','00100','00100','01110'],
 2:['01110','10001','00001','00010','00100','01000','11111'],
 3:['11110','00001','00110','00001','00001','10001','01110'],
 4:['00010','00110','01010','10010','11111','00010','00010'],
 5:['11111','10000','11110','00001','00001','10001','01110'],
 6:['01110','10000','11110','10001','10001','10001','01110'],
 7:['11111','00001','00010','00100','01000','01000','01000'],
 8:['01110','10001','01110','10001','10001','10001','01110'],
 9:['01110','10001','10001','01111','00001','00001','01110'],
 ':':['00000','00100','00100','00000','00100','00100','00000'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 ' ':['00000','00000','00000','00000','00000','00000','00000']
};
export function renderProfileCard({name='Pato',avatar={},coins=0,streak=0,title='Explorador'}={}){
 const buffer=Buffer.alloc(W*H*4);
 const pixel=(x,y,color)=>{
  if(x<0||y<0||x>=W||y>=H)return;
  const i=(y*W+x)*4;buffer[i]=color[0];buffer[i+1]=color[1];buffer[i+2]=color[2];buffer[i+3]=255;
 };
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const glow=Math.max(0,1-Math.hypot((x-540)/580,(y-35)/420));
  pixel(x,y,[Math.round(21+glow*23),Math.round(22+glow*18),Math.round(39+glow*36)]);
 }
 const square=(x,y,w,h,rgb)=>{
  for(let j=Math.max(0,y);j<Math.min(H,y+h);j++)
   for(let i=Math.max(0,x);i<Math.min(W,x+w);i++)pixel(i,j,rgb);
 };
 square(20,20,310,320,[44,40,59]);
 const art=avatarPixels(normalizeAvatar(avatar));
 for(let y=0;y<304;y++)for(let x=0;x<304;x++){
  const i=(Math.floor(y*art.h/304)*art.w+Math.floor(x*art.w/304))*4;
  pixel(23+x,28+y,[art.pixels[i],art.pixels[i+1],art.pixels[i+2]]);
 }
 const letters=(text,x,y,scale=3,color=[249,243,232])=>{
  const normalized=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  let pos=x;
  for(const ch of normalized.slice(0,26)){
   const glyph=FONT[ch]||FONT[' '];
   for(let row=0;row<7;row++)for(let col=0;col<5;col++){
    if(glyph[row][col]==='1')square(pos+col*scale,y+row*scale,scale,scale,color);
   }
   pos+=6*scale;
   if(pos>W-22)break;
  }
 };
 letters('DUCKZINHA STUDIO',302,38,2,[252,211,104]);
 letters(name.slice(0,17),304,104,4,[255,252,240]);
 letters('TITULO: '+title,304,169,2,[214,205,238]);
 letters('MOEDAS: '+Math.max(0,Number(coins)||0),304,211,3,[255,223,141]);
 letters('QUIZ: '+Math.max(0,Number(streak)||0),304,253,3,[175,234,250]);
 square(352,306,324,2,[100,90,124]);
 letters('DUCKZINCOMMUNITY',353,322,2,[161,159,191]);
 return encode(buffer,W,H);
}
