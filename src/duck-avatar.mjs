import {deflateSync} from 'node:zlib';

export const COLORS=Object.freeze({
  corpo:['amarelo','branco','creme','marrom','rosa','azul'],
  fundo:['ceu','lilas','menta','noite','rosa'],
  acessorio:['nenhum','oculos','coroa','fone','bone','laco'],
  roupa:['nenhuma','moletom','cachecol','jaqueta'],
  olhos:['normal','feliz','sonolento']
});
export const DEFAULT_AVATAR=Object.freeze({corpo:'amarelo',fundo:'ceu',acessorio:'nenhum',roupa:'moletom',olhos:'normal'});
export function normalizeAvatar(input){
  const obj=input&&typeof input==='object'?input:{};
  return Object.fromEntries(Object.entries(COLORS).map(([k,values])=>[
    k,values.includes(obj[k])?obj[k]:DEFAULT_AVATAR[k]
  ]));
}
const palettes={
  amarelo:'#ffd74e',branco:'#f2f5f9',creme:'#ffdfb5',
  marrom:'#c58e62',rosa:'#ffb4c5',azul:'#b4dcff'
};
const backgrounds={ceu:'#8ed8f8',lilas:'#c9b5fb',menta:'#a6e7c6',noite:'#2e395c',rosa:'#ffcadb'};
const ink='#3d3443',light='#ffffff',beak='#f28d3f';
function rgba(hex,a=255){return [...hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)),a];}
function hexColor(v){return rgba(v.slice(1))}
const W=256,H=256;
function painter(){
  const p=Buffer.alloc(W*H*4);
  function point(x,y,c){
    x=Math.floor(x);y=Math.floor(y);
    if(x<0||x>=W||y<0||y>=H)return;
    const j=(y*W+x)*4; p[j]=c[0];p[j+1]=c[1];p[j+2]=c[2];p[j+3]=c[3]??255;
  }
  function rect(x,y,w,h,color){
    const c=hexColor(color);
    for(let j=Math.max(0,Math.floor(y));j<Math.min(H,Math.ceil(y+h));j++)
      for(let i=Math.max(0,Math.floor(x));i<Math.min(W,Math.ceil(x+w));i++)point(i,j,c);
  }
  function ellipse(cx,cy,rx,ry,color){
    const c=hexColor(color);
    for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(H,Math.ceil(cy+ry));y++)
      for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(W,Math.ceil(cx+rx));x++)
        if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)point(x,y,c);
  }
  function line(x1,y1,x2,y2,width,color){
    const steps=Math.ceil(Math.hypot(x2-x1,y2-y1)*2);
    for(let i=0;i<=steps;i++){
      const t=i/(steps||1);
      ellipse(x1+(x2-x1)*t,y1+(y2-y1)*t,width/2,width/2,color);
    }
  }
  return {p,rect,ellipse,line};
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{
  let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
function chunk(name,data){
  const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
  const tag=Buffer.from(name,'ascii');
  let c=0xffffffff;
  for(const b of Buffer.concat([tag,data]))c=crcTable[(c^b)&255]^(c>>>8);
  const crc=Buffer.alloc(4);crc.writeUInt32BE((c^0xffffffff)>>>0);
  return Buffer.concat([len,tag,data,crc]);
}
function encodePng(p){
  const raw=Buffer.alloc(H*(1+W*4));
  for(let y=0;y<H;y++){
    const dest=y*(1+W*4);
    raw[dest]=0;
    p.copy(raw,dest+1,y*W*4,(y+1)*W*4);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))
  ]);
}
export function renderAvatar(data={}){
  const a=normalizeAvatar(data);
  const {p,rect,ellipse,line}=painter();
  rect(0,0,W,H,backgrounds[a.fundo]);
  for(let i=0;i<8;i++){
    const x=23+(i*43)%230,y=15+(i*67)%190;
    ellipse(x,y,2+(i%3),2+(i%3),a.fundo==='noite'?'#f5d788':'#ffffff');
  }
  ellipse(128,250,80,19,a.fundo==='noite'?'#202943':'#9baabd');
  // Silhueta com contorno escuro para boa leitura mesmo em tamanhos pequenos.
  ellipse(128,179,83,82,ink);
  ellipse(128,177,77,75,palettes[a.corpo]);
  ellipse(60,176,25,37,ink);ellipse(196,176,25,37,ink);
  ellipse(62,175,21,32,palettes[a.corpo]);ellipse(194,175,21,32,palettes[a.corpo]);
  ellipse(128,112,73,71,ink);
  ellipse(128,108,67,65,palettes[a.corpo]);
  ellipse(104,122,13,16,light);ellipse(152,122,13,16,light);
  if(a.olhos==='normal'){
    ellipse(106,125,8,11,ink);ellipse(154,125,8,11,ink);
    ellipse(108,122,3,4,light);ellipse(156,122,3,4,light);
  }else if(a.olhos==='feliz'){
    line(94,126,106,120,5,ink);line(106,120,118,126,5,ink);
    line(142,126,154,120,5,ink);line(154,120,166,126,5,ink);
  }else{
    line(96,128,116,129,5,ink);line(144,129,164,128,5,ink);
  }
  ellipse(84,147,11,6,'#f1a4ac');ellipse(172,147,11,6,'#f1a4ac');
  ellipse(128,150,24,15,ink);ellipse(128,146,20,12,beak);
  ellipse(128,154,15,5,'#dc7633');
  if(a.roupa!=='nenhuma'){
    if(a.roupa==='cachecol'){
      ellipse(128,191,71,15,ink);ellipse(128,188,67,11,'#e66b78');
      rect(146,185,21,53,'#e66b78');rect(146,229,21,5,ink);
    }else{
      const color=a.roupa==='moletom'?'#f5bd34':'#586f9c';
      ellipse(128,212,77,50,ink);ellipse(128,208,73,48,color);
      ellipse(128,175,24,15,'#fff9df');
      rect(121,194,14,6,'#e8e6da');
      if(a.roupa==='moletom'){line(107,183,104,210,3,light);line(150,183,153,210,3,light);}
      if(a.roupa==='jaqueta'){line(128,185,128,255,4,'#d2e4fa');}
    }
  }
  if(a.acessorio==='oculos'){
    ellipse(105,122,25,22,ink);ellipse(153,122,25,22,ink);
    ellipse(105,122,20,17,'#badfea');ellipse(153,122,20,17,'#badfea');
    line(126,117,132,117,6,ink);line(66,116,81,116,6,ink);line(178,116,190,116,6,ink);
  }else if(a.acessorio==='coroa'){
    rect(91,48,74,28,'#d8972f');
    rect(97,37,15,36,'#ffe079');rect(121,26,15,43,'#ffe079');rect(145,37,15,36,'#ffe079');
    ellipse(128,60,7,7,'#e35b71');
  }else if(a.acessorio==='fone'){
    ellipse(128,95,75,77,ink);
    ellipse(128,100,68,72,palettes[a.corpo]);
    line(64,110,64,94,15,'#333a65');line(64,94,80,70,15,'#333a65');
    line(192,110,192,94,15,'#333a65');line(192,94,176,70,15,'#333a65');
    rect(57,112,18,40,'#5b74ad');rect(181,112,18,40,'#5b74ad');
  }else if(a.acessorio==='bone'){
    ellipse(127,61,65,24,ink);ellipse(127,58,61,21,'#566d9f');
    rect(73,59,108,19,'#566d9f');
    ellipse(168,76,55,13,'#566d9f');
  }else if(a.acessorio==='laco'){
    ellipse(167,61,19,15,'#e8769e');ellipse(194,61,19,15,'#e8769e');
    ellipse(181,65,8,8,'#fbd7e1');
  }
  return encodePng(p);
}
