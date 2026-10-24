import {deflateSync} from 'node:zlib';

// O avatar é desenhado no servidor, sem imagens externas ou pacotes nativos.
// Cada cosmético ocupa uma camada própria para permitir combinações.
export const COLORS=Object.freeze({
  corpo:['amarelo','creme','branco','rosa','menta','azul','lilas','marrom','caramelo'],
  fundo:['ceu','lilas','menta','noite','rosa','por_do_sol','neon','cafe','espaco'],
  chapeu:['nenhum','bone','coroa','fone','laco','touca','coelho','sombrero','chines','cartola','tiara','natal'],
  rosto:['nenhum','oculos','escuros','visor','monoculo'],
  roupa:['nenhuma','moletom','cachecol','jaqueta','kimono','capa','uniforme','sueter','terno','armadura','praia'],
  maos:['nenhuma','garras','punhos_gelo','punhos_fogo','punhos_corrompidos'],
  aura:['nenhuma','brilho','estrelas','coracoes','fogo','gelo','eletrica','dinheiro'],
  pet:['nenhum','fantasma','estrela','mini_pato','ceifador','borboleta'],
  olhos:['normal','feliz','sonolento','piscando','determinado']
});
export const DEFAULT_AVATAR=Object.freeze({
  corpo:'amarelo',fundo:'ceu',chapeu:'nenhum',rosto:'nenhum',
  roupa:'moletom',maos:'nenhuma',aura:'brilho',pet:'nenhum',olhos:'normal'
});
const legacyAccessory={oculos:['rosto','oculos'],coroa:['chapeu','coroa'],bone:['chapeu','bone'],
  fone:['chapeu','fone'],laco:['chapeu','laco']};
export function normalizeAvatar(input){
  const obj=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const result=Object.fromEntries(Object.entries(COLORS).map(([k,values])=>[
    k,values.includes(obj[k])?obj[k]:DEFAULT_AVATAR[k]
  ]));
  // Avatares salvos na versão anterior continuam válidos.
  const migrated=legacyAccessory[obj.acessorio];
  if(migrated&&obj[migrated[0]]==null)result[migrated[0]]=migrated[1];
  return result;
}

const BODY={
  amarelo:['#ffe26b','#ffc94c','#f3a646'],creme:['#fff1cd','#f0d7a1','#caa676'],
  branco:['#f8fdff','#dce7f2','#a1b7ca'],rosa:['#ffd2e1','#f8a9ca','#d987b3'],
  menta:['#bcf1d4','#8fdcba','#60b594'],azul:['#c5edff','#9bd2fa','#72a9da'],
  lilas:['#e3d5ff','#c7abf8','#967bcd'],marrom:['#d5ab7f','#b78962','#815e44'],
  caramelo:['#f4be80','#d99b63','#af754b']
};
const BG={
  ceu:['#a7e7fa','#71b9e2'],lilas:['#c9b5fd','#8c84d3'],
  menta:['#c6f9dd','#73c4ab'],noite:['#343b70','#18243e'],
  rosa:['#ffd6e3','#e7a7cd'],por_do_sol:['#ffce93','#d978ab'],
  neon:['#48447c','#151a36'],cafe:['#e8c9a6','#b18676'],espaco:['#283763','#0c152f']
};
const W=384,H=384,S=W/320,OUT='#443a52',WHITE='#ffffff';
const toRgb=new Map();
function rgba(hex){
  if(toRgb.has(hex))return toRgb.get(hex);
  const str=hex.replace('#','');
  const c=[parseInt(str.slice(0,2),16),parseInt(str.slice(2,4),16),parseInt(str.slice(4,6),16)];
  toRgb.set(hex,c);return c;
}
function mix(a,b,t){
  const A=rgba(a),B=rgba(b);
  return [A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t];
}
function drawSurface(){
  const pixels=Buffer.alloc(W*H*4);
  function blend(px,py,color,opacity=1){
    const x=Math.floor(px),y=Math.floor(py);
    if(x<0||y<0||x>=W||y>=H||opacity<=0)return;
    const j=(y*W+x)*4,alpha=Math.max(0,Math.min(1,opacity));
    const c=typeof color==='string'?rgba(color):color;
    pixels[j]=Math.round(pixels[j]*(1-alpha)+c[0]*alpha);
    pixels[j+1]=Math.round(pixels[j+1]*(1-alpha)+c[1]*alpha);
    pixels[j+2]=Math.round(pixels[j+2]*(1-alpha)+c[2]*alpha);
    pixels[j+3]=255;
  }
  function ellipse(cx,cy,rx,ry,color,alpha=1){
    const X=cx*S,Y=cy*S,Rx=rx*S,Ry=ry*S;
    if(Rx<=0||Ry<=0)return;
    const minX=Math.max(0,Math.floor(X-Rx-1)),maxX=Math.min(W-1,Math.ceil(X+Rx+1));
    const minY=Math.max(0,Math.floor(Y-Ry-1)),maxY=Math.min(H-1,Math.ceil(Y+Ry+1));
    const aa=1/Math.max(1,Math.min(Rx,Ry));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const dx=(x+.5-X)/Rx,dy=(y+.5-Y)/Ry,d=Math.sqrt(dx*dx+dy*dy);
      const coverage=Math.min(1,Math.max(0,(1-d)/aa+.5));
      if(coverage>0)blend(x,y,color,coverage*alpha);
    }
  }
  function line(x1,y1,x2,y2,width,color,alpha=1){
    const X1=x1*S,Y1=y1*S,X2=x2*S,Y2=y2*S,r=width*S/2;
    const vx=X2-X1,vy=Y2-Y1,denom=Math.max(1,vx*vx+vy*vy);
    for(let y=Math.max(0,Math.floor(Math.min(Y1,Y2)-r-1));y<=Math.min(H-1,Math.ceil(Math.max(Y1,Y2)+r+1));y++)
      for(let x=Math.max(0,Math.floor(Math.min(X1,X2)-r-1));x<=Math.min(W-1,Math.ceil(Math.max(X1,X2)+r+1));x++){
        const t=Math.max(0,Math.min(1,((x+.5-X1)*vx+(y+.5-Y1)*vy)/denom));
        const dist=Math.hypot(x+.5-(X1+vx*t),y+.5-(Y1+vy*t));
        const opacity=Math.max(0,Math.min(1,r+.5-dist))*alpha;
        if(opacity)blend(x,y,color,opacity);
      }
  }
  function polygon(coords,color,alpha=1){
    const points=coords.map(([x,y])=>[x*S,y*S]);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const y0=Math.max(0,Math.floor(Math.min(...ys))),y1=Math.min(H-1,Math.ceil(Math.max(...ys)));
    for(let y=y0;y<=y1;y++){
      const hits=[];
      for(let i=0;i<points.length;i++){
        const [ax,ay]=points[i],[bx,by]=points[(i+1)%points.length];
        if((ay<=y+.5&&by>y+.5)||(by<=y+.5&&ay>y+.5))
          hits.push(ax+(y+.5-ay)*(bx-ax)/(by-ay));
      }
      hits.sort((a,b)=>a-b);
      for(let i=0;i+1<hits.length;i+=2){
        for(let x=Math.max(0,Math.floor(hits[i]));x<Math.min(W,Math.ceil(hits[i+1]));x++)
          blend(x,y,color,Math.min(1,Math.max(0,hits[i+1]-x,x+1-hits[i]))*alpha);
      }
    }
  }
  function rect(x,y,w,h,color,alpha=1){
    for(let py=Math.max(0,Math.floor(y*S));py<Math.min(H,Math.ceil((y+h)*S));py++)
      for(let px=Math.max(0,Math.floor(x*S));px<Math.min(W,Math.ceil((x+w)*S));px++)blend(px,py,color,alpha);
  }
  function ring(x,y,rx,ry,width,color,alpha=1){
    ellipse(x,y,rx,ry,color,alpha);ellipse(x,y,rx-width,ry-width,'#ffffff',0);
  }
  return {pixels,blend,ellipse,line,polygon,rect,ring};
}
function star(d,x,y,r,color,alpha=1){
  const p=[];
  for(let i=0;i<10;i++){
    const ang=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.46:r;
    p.push([x+Math.cos(ang)*rad,y+Math.sin(ang)*rad]);
  }
  d.polygon(p,color,alpha);
}
function heart(d,x,y,r,color){
  d.ellipse(x-r*.48,y-r*.25,r*.54,r*.52,color);
  d.ellipse(x+r*.48,y-r*.25,r*.54,r*.52,color);
  d.polygon([[x-r,y-r*.2],[x+r,y-r*.2],[x,y+r]],color);
}
function backdrop(d,a){
  const [top,bottom]=BG[a.fundo];
  const topRgb=rgba(top),bottomRgb=rgba(bottom);
  for(let y=0;y<H;y++){
    const t=y/(H-1);
    for(let x=0;x<W;x++){
      const radial=Math.max(0,1-Math.hypot(x/W-.25,y/H-.15)*1.3)*.12;
      d.blend(x,y,[topRgb[0]*(1-t)+bottomRgb[0]*t+radial*70,
        topRgb[1]*(1-t)+bottomRgb[1]*t+radial*70,
        topRgb[2]*(1-t)+bottomRgb[2]*t+radial*65]);
    }
  }
  d.ellipse(44,38,105,84,'#ffffff',.09);
  d.ellipse(291,291,106,130,'#ffffff',.05);
  for(let i=0;i<18;i++){
    const x=(23+i*83)%320,y=(13+i*41)%296;
    const c=a.fundo==='espaco'||a.fundo==='noite'?'#fbefb5':'#ffffff';
    if(i%4===0)star(d,x,y,3+(i%3),c,.55);
    else d.ellipse(x,y,1.4+(i%2),1.4+(i%2),c,.35);
  }
  if(a.fundo==='espaco'||a.fundo==='noite'){
    d.ellipse(263,54,29,29,'#fff3c6',.9);
    d.ellipse(270,50,27,27,top);
  }else if(a.fundo==='por_do_sol'){
    d.ellipse(261,79,36,36,'#fff1bb',.66);
  }else{
    d.ellipse(260,55,26,26,'#ffffff',.17);
  }
  // Plataforma circular: ancora o desenho e dá profundidade.
  d.ellipse(159,291,113,26,'#292c4b',.27);
  d.ellipse(159,286,91,15,'#ffffff',.14);
}
function aura(d,a){
  const type=a.aura;
  if(type==='nenhuma')return;
  const themes={
    brilho:['#fff4b8','#ffe09b','#fffdf2'],estrelas:['#ffe8a5','#8bdcf6','#ffffff'],
    coracoes:['#ff91c3','#ffb7d8','#fff6f8'],fogo:['#ff672f','#ffb34c','#fff7c6'],
    gelo:['#6bcfff','#c3f2ff','#f4ffff'],eletrica:['#aa91fc','#6dedff','#faf5ff'],
    dinheiro:['#4fd88c','#a0f3a5','#efffd7']
  };
  const [primary,secondary,shine]=themes[type]||themes.brilho;
  // Três órbitas de energia translúcidas atrás do pato.
  for(let ring=0;ring<3;ring++){
    const radius=104+ring*12,tilt=0.93+ring*.012;
    const segments=68;
    for(let i=0;i<segments;i++){
      const t=i/segments*Math.PI*2-.7,next=(i+1)/segments*Math.PI*2-.7;
      const alpha=(.08+(ring===1?.18:.09))*(.5+Math.abs(Math.sin(t*2))*.5);
      const c=ring===1?primary:secondary;
      d.line(160+Math.cos(t)*radius,163+Math.sin(t)*radius*tilt,
        160+Math.cos(next)*radius,163+Math.sin(next)*radius*tilt,
        ring===1?3.3:2.2,c,alpha);
    }
  }
  // Partículas com halo, núcleo iluminado e detalhes próprios de cada aura.
  for(let i=0;i<23;i++){
    const t=i*2.39996323-1.1,r=105+(i*37%33);
    const x=160+Math.cos(t)*r,y=156+Math.sin(t)*r*.93;
    if(x<11||x>309||y<15||y>284)continue;
    const scale=3+(i*7%7);
    d.ellipse(x,y,scale*2.8,scale*2.8,primary,.055);
    d.ellipse(x,y,scale*1.6,scale*1.6,secondary,.14);
    if(type==='fogo'){
      const h=11+(i*3%16);
      d.polygon([[x-7,y+scale],[x-8,y-4],[x-2,y-h],[x+3,y-5],[x+7,y+scale]],
        primary,.8);
      d.polygon([[x-3,y+scale],[x-2,y-4],[x+2,y-h*.6],[x+4,y+scale]],secondary,.9);
      d.ellipse(x,y+2,2.5,4,shine,.88);
    }else if(type==='gelo'){
      const size=scale+5;
      for(let n=0;n<3;n++){
        const theta=n*Math.PI/3;
        const vx=Math.cos(theta)*size,vy=Math.sin(theta)*size;
        d.line(x-vx,y-vy,x+vx,y+vy,2,secondary,.91);
        d.line(x-vx*.6,y-vy*.6,x-vx*.6+vy*.25,y-vy*.6-vx*.25,1.5,shine);
      }
      d.ellipse(x,y,2.5,2.5,shine);
    }else if(type==='eletrica'){
      const s=scale*1.6;
      d.line(x-s,y-s*.5,x-s*.25,y+s*.1,3,primary,.9);
      d.line(x-s*.25,y+s*.1,x+s*.35,y-s*.9,2.5,secondary);
      d.line(x+s*.35,y-s*.9,x+s,y+s*.4,2.3,shine);
      star(d,x+s,y+s*.4,2,shine);
    }else if(type==='dinheiro'){
      d.ellipse(x,y,scale+2,scale+2,'#31694d',.85);
      d.ellipse(x,y,scale,scale,'#f6dd81');
      d.ellipse(x-1,y-1,scale-2,scale-2,'#9edc7f');
      d.line(x-2,y-4,x+2,y+4,2,'#3a8064');
      d.ellipse(x-scale*.3,y-scale*.35,1.5,1.5,shine,.85);
    }else if(type==='coracoes'){
      heart(d,x,y,scale+2,primary);
      heart(d,x-1,y-2,Math.max(3,scale-2),secondary);
      d.ellipse(x-3,y-4,2,1.8,shine,.85);
    }else if(type==='estrelas'){
      star(d,x,y,scale+3,primary,.92);
      star(d,x,y,scale*.63,shine,.88);
    }else{
      star(d,x,y,scale+3,secondary,.75);
      star(d,x,y,scale*.56,shine,.95);
    }
    if(i%3===0)for(const [dx,dy] of [[-13,11],[12,-13],[19,7]]){
      d.ellipse(x+dx,y+dy,1.4,1.4,shine,.85);
    }
  }
}
function petBehind(d,type){
  if(type==='nenhum')return;
  const x=254,y=225;
  if(type==='fantasma'||type==='ceifador'){
    d.ellipse(x,y-14,34,33,OUT);d.ellipse(x,y-15,31,30,type==='ceifador'?'#38304e':'#ffffff');
    d.ellipse(x-8,y-24,17,14,type==='ceifador'?'#70558d':'#d4f4ff',.35);
    d.polygon([[x-30,y-15],[x+30,y-15],[x+30,y+27],[x+15,y+20],[x,y+27],[x-15,y+20],[x-30,y+27]],
      type==='ceifador'?'#38304e':'#ffffff');
    d.ellipse(x-11,y-14,4,6,type==='ceifador'?'#e86dce':OUT);
    d.ellipse(x+11,y-14,4,6,type==='ceifador'?'#e86dce':OUT);
    if(type==='ceifador'){
      d.line(x+24,y-27,x+40,y+28,4,'#adb8d0');d.ellipse(x+20,y-31,21,5,'#d2e2eb');
      d.ellipse(x,y-38,27,8,'#41374f');d.ellipse(x,y-32,30,22,'#30283d');
      d.line(x-21,y-25,x+21,y-25,3,'#b6a1df',.5);
      d.polygon([[x-7,y-23],[x+7,y-23],[x,y-9]],'#bf95ec');
      star(d,x+19,y-46,4,'#f4ddff');
    }else{
      d.ellipse(x-6,y-6,3,3,'#ffc0cf');
      d.ellipse(x+8,y-6,3,3,'#ffc0cf');
      star(d,x+28,y-42,5,'#efffff');
    }
  }else if(type==='estrela'){
    star(d,x,y,33,OUT);star(d,x,y,28,'#ffe899');
    d.ellipse(x-9,y,3,4,OUT);d.ellipse(x+9,y,3,4,OUT);
    star(d,x-13,y-15,5,WHITE,.65);d.ellipse(x,y+10,6,3,'#eab571',.5);
  }else if(type==='mini_pato'){
    d.ellipse(x,y+5,32,29,OUT);d.ellipse(x,y+2,29,26,'#ffdf73');
    d.ellipse(x-9,y-1,4,6,OUT);d.ellipse(x+9,y-1,4,6,OUT);
    d.ellipse(x,y+11,13,7,'#f6a044');d.ellipse(x-11,y+6,4,3,'#f2a5ac',.7);
    d.ellipse(x+11,y+6,4,3,'#f2a5ac',.7);
    d.ellipse(x-6,y-16,9,6,WHITE,.2);d.ellipse(x-5,y-4,1.8,2.2,WHITE);
    d.ellipse(x+13,y-4,1.8,2.2,WHITE);
  }else if(type==='borboleta'){
    d.ellipse(x-14,y-11,19,24,'#f3a7db');d.ellipse(x+14,y-11,19,24,'#a6d5ff');
    d.ellipse(x-12,y+13,13,17,'#dc95d9');d.ellipse(x+12,y+13,13,17,'#7ec2e6');
    d.line(x,y-15,x,y+20,4,OUT);
    d.line(x,y-12,x-11,y-24,2,OUT);d.line(x,y-12,x+11,y-24,2,OUT);
    for(const wing of [-1,1]){
      d.ellipse(x+wing*15,y-15,7,13,WHITE,.24);
      d.ellipse(x+wing*14,y+8,4,9,WHITE,.23);
    }star(d,x-33,y-30,3,WHITE,.8);
  }
}
function garment(d,a){
  const outfit=a.roupa;
  const fabric={
    moletom:['#f5c74f','#e9a83b'],jaqueta:['#577cbd','#344b89'],
    kimono:['#eb7b9a','#b95781'],capa:['#a574d5','#684caa'],
    uniforme:['#506a91','#2f4265'],sueter:['#94c2b8','#5b9b98'],
    terno:['#343449','#252538'],armadura:['#aab5c8','#78869d'],
    praia:['#8bd6ef','#4aa0cb']
  };
  if(outfit==='nenhuma'||outfit==='cachecol')return;
  const [base,shade]=fabric[outfit]||fabric.moletom;
  d.ellipse(160,229,94,80,OUT);
  d.ellipse(160,225,87,74,shade);
  d.ellipse(159,214,82,63,base);
  d.ellipse(132,181,39,19,'#fff9eb',.7);
  d.ellipse(182,181,39,19,'#fff9eb',.7);
  if(outfit==='moletom'){
    d.line(145,183,143,217,3,WHITE);d.line(173,183,175,217,3,WHITE);
    d.ellipse(160,244,37,22,shade);d.ellipse(160,244,31,16,base);
    d.line(115,253,205,253,3,'#fff0bd',.42);
    d.line(95,217,104,253,2,'#fff1b7',.62);
    d.line(225,217,216,253,2,'#c88829',.54);
    d.line(123,238,147,238,2,'#ffe9b0',.5);
    d.line(174,238,198,238,2,'#ffe9b0',.5);
    star(d,160,228,8,'#ffecaa',.92);
    d.ellipse(160,228,3,3,'#eeb365');
  }else if(outfit==='jaqueta'||outfit==='uniforme'){
    d.line(160,183,160,293,4,'#e6eaf6');
    for(let y=210;y<=264;y+=24)d.ellipse(170,y,3,3,'#f7d475');
    d.polygon([[115,177],[157,196],[142,215]],'#e9efff');
    d.polygon([[204,177],[163,196],[177,215]],'#e9efff');
    d.line(109,214,126,254,2,'#eaf5ff',.64);
    d.line(211,214,194,254,2,'#243c79',.35);
    for(let y=210;y<270;y+=24)d.ellipse(149,y,2,2,'#f4edc3');
  }else if(outfit==='kimono'){
    d.polygon([[101,185],[154,232],[132,261],[84,218]],'#fff1e7');
    d.polygon([[218,185],[167,232],[190,261],[236,218]],'#fff1e7');
    d.line(118,257,204,257,11,'#eeb7cc');
    d.line(105,194,133,223,3,'#ed9eb4');
    d.line(213,194,187,223,3,'#ed9eb4');
    for(const xy of [[107,228],[122,241],[210,228],[196,241]])star(d,xy[0],xy[1],5,'#ffeff6',.7);
    d.ellipse(164,256,8,8,'#ffeac8');
  }else if(outfit==='sueter'){
    for(let y=232;y<287;y+=13)d.line(97,y,223,y,3,'#d7fff0',.45);
    star(d,161,244,13,'#fff7d1');
    star(d,161,244,7,'#ffe0a8');
    for(const yy of [255,265,275])for(let xx=115;xx<211;xx+=14)
      d.ellipse(xx,yy,1.2,1.2,'#e0fff0',.6);
    d.line(104,198,105,259,2,'#def9ec',.55);
  }else if(outfit==='terno'){
    d.polygon([[108,187],[151,218],[136,251]],'#faf3ed');
    d.polygon([[210,187],[169,218],[182,251]],'#faf3ed');
    d.polygon([[158,202],[169,202],[165,267],[153,267]],'#de7484');
    d.polygon([[159,214],[166,214],[160,245]],'#ffc2c3');
    d.ellipse(159,205,5,6,'#f8d3ad');
    d.line(138,210,129,263,2,WHITE,.3);
    d.line(185,210,192,263,2,WHITE,.3);
  }else if(outfit==='armadura'){
    d.ellipse(160,229,59,53,'#677b97');
    d.ellipse(160,220,52,43,'#d7e4f0');
    d.polygon([[160,201],[174,216],[160,243],[146,216]],'#88cde9');
    d.line(117,254,203,254,6,'#616d89');
    d.line(132,207,120,234,3,WHITE,.72);
    d.line(187,207,200,234,3,'#7289a4');
    d.polygon([[100,205],[127,211],[119,243],[91,236]],'#d0dae9');
    d.polygon([[219,205],[193,211],[200,243],[231,236]],'#d0dae9');
    star(d,160,220,6,WHITE,.86);
    for(let i=0;i<4;i++)d.ellipse(128+i*20,269,2,3,'#f6e8a8');
  }else if(outfit==='praia'){
    for(let i=0;i<5;i++)d.line(94+i*27,199,81+i*30,283,5,'#fffbdd',.7);
    d.ellipse(162,245,10,8,'#e7a856');
    d.line(114,222,139,220,2,'#fff6df');
    d.line(183,220,208,222,2,'#fff6df');
    star(d,160,243,5,WHITE);
  }else if(outfit==='capa'){
    d.polygon([[101,179],[67,303],[253,303],[217,179]],'#7655ab');
    d.polygon([[110,197],[96,290],[225,290],[207,197]],'#a889da');
    d.ellipse(160,193,15,12,'#f8da71');
    d.ellipse(160,193,8,7,'#fff6c2');
    for(const dx of [-60,-30,0,30,60])star(d,160+dx,276,4,'#d8b9ff',.5);
    d.line(105,208,93,282,2,'#ffe8ff',.4);
  }
}
function duck(d,a){
  const [main,shade,deep]=BODY[a.corpo];
  // Pezinhos e asas da silhueta principal.
  d.ellipse(116,291,35,13,OUT);d.ellipse(207,291,35,13,OUT);
  d.ellipse(116,288,31,11,'#e9984d');d.ellipse(207,288,31,11,'#e9984d');
  d.ellipse(160,231,87,75,OUT);
  d.ellipse(160,228,81,69,shade);
  d.ellipse(148,213,62,55,main,.68);
  d.ellipse(90,208,30,43,OUT);
  d.ellipse(230,208,30,43,OUT);
  d.ellipse(90,206,25,37,shade);
  d.ellipse(230,206,25,37,shade);
  d.ellipse(84,196,10,23,main,.42);
  d.ellipse(224,196,9,22,main,.42);
  garment(d,a);
  // Cabeça redondinha com laterais macias e topete.
  d.ellipse(159,129,87,87,OUT);
  d.ellipse(159,125,81,80,shade);
  d.ellipse(155,116,75,71,main);
  d.ellipse(146,91,53,35,WHITE,.07);
  d.ellipse(183,156,26,14,shade,.19);
  d.ellipse(93,133,8,26,WHITE,.06);
  d.ellipse(223,142,7,21,deep,.15);
  d.ellipse(136,88,40,25,WHITE,.13);
  d.ellipse(126,75,18,20,shade);
  d.ellipse(139,67,17,23,main);
  d.ellipse(153,71,16,19,main);
  // Olhos e expressão
  if(a.olhos==='feliz'){
    for(const x of [126,193]){
      d.line(x-12,139,x,132,5,OUT);d.line(x,132,x+12,139,5,OUT);
    }
  }else if(a.olhos==='sonolento'){
    for(const x of [127,193]){
      d.line(x-14,138,x+14,139,5,OUT);d.line(x-13,140,x-6,144,2,OUT);
    }
  }else if(a.olhos==='piscando'){
    d.ellipse(126,137,10,15,OUT);d.ellipse(128,132,4,5,WHITE);
    d.line(179,137,206,137,5,OUT);d.line(180,137,187,132,3,OUT);
  }else{
    for(const x of [126,193]){
      d.ellipse(x,138,12,17,OUT);
      d.ellipse(x+3,132,4.2,5.6,WHITE);
      d.ellipse(x-5,145,2.2,2.2,WHITE,.55);
      if(a.olhos==='determinado')d.line(x-15,119,x+12,125,5,OUT);
    }
  }
  d.ellipse(96,163,15,8,'#ed8fa2',.65);
  d.ellipse(221,163,15,8,'#ed8fa2',.65);
  d.ellipse(160,175,31,21,OUT);
  d.ellipse(160,172,27,16,'#f4a748');
  d.ellipse(150,167,17,8,'#ffd18b',.85);
  d.ellipse(162,165,10,4,'#fff0c9',.48);
  d.ellipse(160,182,18,7,'#e48235');
  d.ellipse(167,193,2.2,2,'#e6d5b5');
  // Cachecol finalizado sobre o pescoço.
  if(a.roupa==='cachecol'){
    d.ellipse(158,201,69,14,OUT);
    d.ellipse(158,198,65,12,'#f08a98');
    d.polygon([[184,202],[211,200],[210,273],[181,265]],'#d96b8a');
    d.line(183,265,211,273,3,OUT);
    for(let i=0;i<4;i++)d.line(186+i*6,272,186+i*6,281,2,'#ffccd0');
  }
}
function faceGear(d,type){
  if(type==='nenhum')return;
  if(type==='oculos'||type==='escuros'||type==='visor'){
    const dark=type==='escuros',visor=type==='visor';
    if(visor){
      d.ellipse(159,139,63,29,OUT);
      d.ellipse(159,137,57,23,'#78d3f6',.9);
      d.line(113,122,203,122,4,'#f8ffff',.7);
    }else{
      for(const x of [126,193]){
        d.ellipse(x,139,27,25,OUT);
        d.ellipse(x,138,21,19,dark?'#302f45':'#9bd9ed',dark?.95:.52);
        d.ellipse(x-8,131,7,4,WHITE,.42);
      }
      d.line(151,133,168,133,6,OUT);
      d.line(79,134,100,134,5,OUT);d.line(219,134,239,134,5,OUT);
    }
    }else if(type==='monoculo'){
    d.ellipse(193,140,27,26,'#d4b76c');
    d.ellipse(193,140,22,21,'#b4e5f4',.35);
    d.line(212,161,223,220,3,'#d4b76c');
  }
}
function hat(d,type){
  if(type==='nenhum')return;
  if(type==='bone'){
    d.ellipse(156,77,78,31,OUT);d.ellipse(155,70,72,28,'#4c6db2');
    d.ellipse(196,91,54,12,OUT);d.ellipse(196,88,51,10,'#7694d2');
    star(d,156,69,9,'#fff0a9');
  }else if(type==='coroa'){
    d.polygon([[114,72],[108,24],[133,49],[160,17],[186,49],[211,24],[204,72]],OUT);
    d.polygon([[118,66],[114,32],[135,54],[160,27],[184,54],[204,33],[200,67]],'#fbd76b');
    d.line(118,66,200,66,8,'#d39a47');star(d,160,55,9,'#e7799b');
    d.line(125,69,195,69,3,'#fff5c9',.92);
    for(const x of [121,144,177,200])d.ellipse(x,54,4,5,'#d47c94');
    star(d,160,55,4,WHITE,.84);
  }else if(type==='fone'){
    // O arco fica por cima da cabeça; as conchas nas laterais,
    // sem cobrir rosto, olhos ou bico.
    // Arco e conchas desenhados sobre a cabeça já renderizada.
    // O centro fica transparente para preservar as expressões.
    d.line(86,111,99,66,11,'#444761');
    d.line(99,66,160,44,11,'#444761');
    d.line(160,44,219,66,11,'#444761');
    d.line(219,66,233,111,11,'#444761');
    d.ellipse(83,151,13,28,'#454760');
    d.ellipse(237,151,13,28,'#454760');
    d.ellipse(82,150,9,24,'#9bc2e5');d.ellipse(238,150,9,24,'#9bc2e5');
    d.ellipse(79,145,3,14,WHITE,.45);
    d.ellipse(235,145,3,14,WHITE,.45);
    d.line(110,63,157,48,3,WHITE,.18);
  }else if(type==='laco'){
    d.ellipse(183,68,24,17,'#e77da7');
    d.ellipse(224,68,24,17,'#e77da7');
    d.ellipse(203,73,12,11,'#fff2da');
    d.line(171,59,183,64,2,'#ffcede');
    d.line(217,64,232,59,2,'#ffcede');
  }else if(type==='touca'){
    d.ellipse(160,69,72,39,OUT);d.ellipse(160,63,65,35,'#b37eb7');
    d.line(99,81,221,81,14,'#eed3fa');
    d.ellipse(160,28,12,12,'#e9c6f0');
    for(let x=110;x<218;x+=11)d.line(x,81,x+3,88,1.6,WHITE,.45);
    star(d,158,49,8,'#e1bbfa',.8);
  }else if(type==='coelho'){
    for(const x of [124,194]){
      d.ellipse(x,40,15,35,OUT);d.ellipse(x,37,11,30,'#f7f6ff');
      d.ellipse(x,35,5,23,'#eda8c5');
    }
    d.ellipse(160,89,72,16,'#fff8fb');
    d.ellipse(127,41,2.5,15,WHITE,.75);
    d.ellipse(197,41,2.5,15,WHITE,.75);
    for(const x of [110,132,155,178,199])d.ellipse(x,90,3,2,'#e5afc7',.5);
  }else if(type==='sombrero'){
    d.ellipse(159,92,115,23,OUT);d.ellipse(159,87,110,19,'#e1b875');
    d.ellipse(159,63,62,48,OUT);d.ellipse(159,60,57,43,'#f5d799');
    d.line(109,80,210,80,10,'#d77b72');
    for(let x=72;x<249;x+=20){
      d.ellipse(x,89,4,3,'#fff3c7');
      d.line(x-6,98,x,103,1.3,'#d59b6e',.85);
    }
    for(let y=43;y<75;y+=10)d.line(142,y,181,y,2,'#fff5cb',.24);
  }else if(type==='chines'){
    d.polygon([[51,105],[160,22],[269,105]],OUT);
    d.polygon([[61,99],[160,30],[259,99]],'#e4c192');
    for(let i=-2;i<=2;i++)d.line(160,32,160+i*45,98,2,'#bd915f');
    d.line(63,99,257,99,5,'#f6deb5');
    for(let x=70;x<259;x+=11)d.line(x,99,x+8,104,1,'#b38b5c',.7);
    star(d,160,30,3,'#fff0d0',.8);
  }else if(type==='cartola'){
    d.ellipse(160,96,93,19,OUT);d.ellipse(160,93,87,14,'#33394d');
    d.polygon([[120,91],[124,29],[194,29],[200,91]],OUT);
    d.polygon([[125,85],[129,34],[188,34],[194,85]],'#363750');
    d.line(127,81,190,81,11,'#e6a4aa');
    d.line(133,41,127,73,2,WHITE,.32);
    star(d,162,80,8,'#ffde9d',.86);
  }else if(type==='tiara'){
    d.ellipse(141,77,16,13,'#f189b0');d.ellipse(180,77,16,13,'#f189b0');
    d.ellipse(161,79,9,9,'#fff0d7');
    d.ellipse(161,79,4,4,'#e6b1d7');star(d,161,60,3,WHITE);
  }else if(type==='natal'){
    d.polygon([[102,82],[147,20],[214,76]],OUT);
    d.polygon([[110,80],[149,28],[206,77]],'#dd657b');
    d.ellipse(211,74,13,13,'#fff7f1');d.line(103,85,214,85,15,'#fff7ee');
    d.line(128,45,152,31,3,'#ffb6bb',.5);
    for(let x=107;x<213;x+=12)d.ellipse(x,86,3,3,WHITE,.6);
  }
}
function handGear(d,type){
  if(type==='nenhuma')return;
  const positions=[[86,220],[232,220]];
  for(const [x,y] of positions){
    if(type==='garras'){
      d.ellipse(x,y,23,23,OUT);d.ellipse(x,y,19,19,'#636b84');
      for(let i=-1;i<=1;i++){
        d.polygon([[x+i*11-4,y-7],[x+i*11+4,y-7],[x+i*12,y-40]],'#a4b8d9');
        d.line(x+i*11-2,y-10,x+i*12,y-32,2,WHITE,.8);
      }
      d.line(x-13,y+11,x+14,y+11,3,'#b8c4db');
    }else if(type==='punhos_gelo'){
      star(d,x,y,32,'#a4efff');star(d,x,y,26,'#deffff');
      d.ellipse(x,y,15,14,'#81bfdc');
      for(let theta=0;theta<6;theta++){
        const a=theta*Math.PI/3;
        d.line(x,y,x+Math.cos(a)*31,y+Math.sin(a)*31,2,'#f0ffff',.85);
        star(d,x+Math.cos(a)*32,y+Math.sin(a)*32,3,'#e5ffff');
      }
    }else if(type==='punhos_fogo'){
      d.polygon([[x-22,y+24],[x-24,y-9],[x-11,y-29],[x-2,y-9],[x+13,y-38],[x+25,y+10],[x+14,y+24]],'#f27740');
      d.ellipse(x,y+8,14,17,'#ffe185');
      d.polygon([[x-8,y+15],[x-3,y-12],[x+2,y+2],[x+7,y-17],[x+11,y+14]],'#fff2ba',.85);
      d.ellipse(x-8,y-10,3,4,'#ffbd54',.7);
    }else if(type==='punhos_corrompidos'){
      d.ellipse(x,y,26,24,OUT);d.ellipse(x,y,20,20,'#8246c0');
      for(let k=0;k<4;k++)star(d,x+(k*13)%35-14,y-20+(k*19)%37,6,'#d19cff');
      d.ellipse(x,y,15,14,'#572a9a',.3);
      star(d,x,y,9,'#e6b2ff',.75);
    }
  }
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{
  let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
function pngChunk(tag,data){
  const size=Buffer.alloc(4);size.writeUInt32BE(data.length);
  let crc=0xffffffff;
  for(const byte of Buffer.concat([Buffer.from(tag),data]))
    crc=crcTable[(crc^byte)&255]^(crc>>>8);
  const checksum=Buffer.alloc(4);checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([size,Buffer.from(tag),data,checksum]);
}
function encodePng(pixels){
  const raw=Buffer.alloc(H*(W*4+1));
  for(let y=0;y<H;y++)pixels.copy(raw,y*(W*4+1)+1,y*W*4,(y+1)*W*4);
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(raw,{level:6})),pngChunk('IEND',Buffer.alloc(0))]);
}
export function renderAvatar(data={}){
  const a=normalizeAvatar(data),d=drawSurface();
  backdrop(d,a);aura(d,a);petBehind(d,a.pet);duck(d,a);
  faceGear(d,a.rosto);hat(d,a.chapeu);handGear(d,a.maos);
  // Brilhos de primeiro plano, evitando poluir o rosto.
  d.ellipse(36,289,3,3,'#ffffff',.72);
  d.ellipse(281,129,3,3,'#ffffff',.57);
  return encodePng(d.pixels);
}
