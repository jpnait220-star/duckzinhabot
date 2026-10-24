// Efeitos visuais do Duckzinha Studio — camadas especiais por aura.
// Todas as coordenadas são do universo 320×320 do renderizador e determinísticas.
// Estas camadas realçam o cenário e a silhueta sem esconder os olhos do patinho.

const AURAS={
  brilho:['#fff8d5','#f7c66e','#ffffff'],
  estrelas:['#fff1a3','#81c7ff','#f7f6ff'],
  coracoes:['#ff89bb','#f5c2e4','#ffeef5'],
  fogo:['#fc682f','#ffbf4e','#fff3ad'],
  gelo:['#77d3ff','#c1f3ff','#effdff'],
  eletrica:['#8f8cff','#71ecff','#eddbff'],
  dinheiro:['#69d5a0','#fbe78a','#ddffe3']
};
const TAU=Math.PI*2;
function star(d,x,y,r,color,opacity=1,points=5){
  const path=[];
  for(let i=0;i<2*points;i++){
    const theta=-Math.PI/2+i*Math.PI/points;
    const R=i%2?r*.42:r;
    path.push([x+R*Math.cos(theta),y+R*Math.sin(theta)]);
  }
  d.polygon(path,color,opacity);
}
function diamond(d,x,y,w,h,color,opacity=1){
  d.polygon([[x,y-h],[x+w,y],[x,y+h],[x-w,y]],color,opacity);
}
function heart(d,x,y,r,color,opacity=1){
  d.ellipse(x-r*.43,y-r*.24,r*.57,r*.58,color,opacity);
  d.ellipse(x+r*.43,y-r*.24,r*.57,r*.58,color,opacity);
  d.polygon([[x-r,y-r*.22],[x+r,y-r*.22],[x,y+r]],color,opacity);
}
function glow(d,x,y,size,core,edge){
  d.ellipse(x,y,size*2.6,size*2.6,edge,.055);
  d.ellipse(x,y,size*1.65,size*1.65,edge,.11);
  d.ellipse(x,y,size*.8,size*.8,core,.55);
}
function curved(d,pts,width,color,opacity=1){
  for(let i=1;i<pts.length;i++)
    d.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],width,color,opacity);
}
function flame(d,x,y,h,main,secondary,shine){
  const w=h*.39;
  d.polygon([[x-w,y],[x-w*.97,y-h*.46],[x-w*.15,y-h*.88],
    [x+w*.12,y-h*.42],[x+w*.52,y-h*.71],[x+w,y]],main,.92);
  d.polygon([[x-w*.38,y],[x-w*.25,y-h*.31],[x+w*.15,y-h*.54],
    [x+w*.49,y]],secondary,.92);
  d.ellipse(x,y-h*.1,w*.18,h*.13,shine,.78);
}
function snow(d,x,y,r,main,shine){
  glow(d,x,y,r*.6,shine,main);
  for(let i=0;i<6;i++){
    const theta=i*TAU/6,dx=Math.cos(theta),dy=Math.sin(theta);
    d.line(x,y,x+dx*r,y+dy*r,r>.7?1.5:1,main,.93);
    const bx=x+dx*r*.67,by=y+dy*r*.67;
    const side=r*.2;
    d.line(bx,by,bx-dx*side-dy*side,by-dy*side+dx*side,1,shine,.95);
    d.line(bx,by,bx-dx*side+dy*side,by-dy*side-dx*side,1,shine,.95);
  }
  diamond(d,x,y,r*.14,r*.14,shine);
}
function bill(d,x,y,w,color,shine){
  const skew=w*.16;
  d.polygon([[x-w*.5,y-6],[x+w*.5,y-6-skew*.3],
    [x+w*.5,y+6],[x-w*.5,y+6+skew*.3]],'#205f49',.9);
  d.polygon([[x-w*.43,y-4],[x+w*.43,y-4-skew*.2],
    [x+w*.43,y+4],[x-w*.43,y+4+skew*.2]],color,.95);
  d.ellipse(x,y,3.9,3.9,'#e5fdc7',.95);
  d.line(x-w*.34,y,x-w*.19,y,1,shine,.75);
  d.line(x+w*.19,y,x+w*.34,y,1,shine,.75);
}
function coin(d,x,y,r,main,shine){
  d.ellipse(x+1.5,y+2,r+1,r+1,'#396247',.65);
  d.ellipse(x,y,r,r,'#b88b43');
  d.ellipse(x-1,y-1,r*.9,r*.9,main);
  d.ellipse(x-1,y-1,r*.73,r*.73,'#ffec9b');
  d.ellipse(x-1,y-1,r*.56,r*.56,main);
  d.line(x-r*.26,y-r*.42,x+r*.26,y+r*.42,1.9,'#57865a');
  d.line(x+r*.21,y-r*.4,x-r*.22,y+r*.38,1.5,'#57865a');
  d.ellipse(x-r*.33,y-r*.38,1.8,1.8,shine,.93);
}
function bolt(d,points,color,inner){
  curved(d,points,7,color,.14);
  curved(d,points,3.6,color,.85);
  curved(d,points,1.25,inner,.98);
}
function orbit(d,{cx=160,cy=157,rx,ry,from,to,width,color,alpha=1,segments=36}){
  let p=null;
  for(let i=0;i<=segments;i++){
    const a=from+(to-from)*i/segments;
    const x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;
    if(p)d.line(p[0],p[1],x,y,width,color,alpha);
    p=[x,y];
  }
}

export function drawAuraBehind(d,avatar){
  const type=avatar.aura;
  const theme=AURAS[type];
  if(!theme)return;
  const [main,soft,shine]=theme;
  // O layout preserva a parte central do pato. Múltiplas linhas iluminadas
  // criam profundidade e volume em vez de espalhar símbolos iguais ao redor.
  const sides=[-1,1];
  if(type==='brilho'||type==='estrelas'){
    // Uma coroa radiante de feixes atrás das asas e da cabeça.
    for(let i=0;i<23;i++){
      const angle=(i/22)*Math.PI*1.38+Math.PI*.81;
      const x1=160+Math.cos(angle)*103,y1=166+Math.sin(angle)*98;
      const len=type==='brilho'?25+i%4*8:15+i%3*8;
      const x2=160+Math.cos(angle)*(103+len),y2=166+Math.sin(angle)*(98+len);
      d.line(x1,y1,x2,y2,i%3===0?3:1.5,main,.32);
      if(i%3===0)star(d,x2,y2,2.8,shine,.87,4);
    }
    for(const side of sides){
      const anchor=160+side*111;
      for(let i=0;i<4;i++){
        const x=anchor+side*((i*9)%23),y=62+i*46;
        glow(d,x,y,7,shine,soft);
        star(d,x,y,9+(i%3)*3,i%2?soft:main,.93,i%2?4:5);
        star(d,x,y,4.5,shine,.94,4);
      }
    }
    if(type==='estrelas'){
      for(const side of sides){
        const path=[[160+side*140,43],[160+side*116,89],[160+side*145,134],
          [160+side*120,196],[160+side*142,238]];
        curved(d,path,1.6,soft,.66);
        for(const [x,y] of path){
          glow(d,x,y,5,shine,soft);
          diamond(d,x,y,3.1,5,main,.85);
        }
      }
    }
  }else if(type==='fogo'){
    // Chamas orientadas para cima com recortes internos e brilho nas pontas.
    for(const side of sides){
      const x=160+side*116;
      const wave=[];
      for(let i=0;i<8;i++)wave.push([
        x+side*(Math.sin(i*.95)*9+i*1.8),
        263-i*26
      ]);
      curved(d,wave,13,main,.09);curved(d,wave,5,soft,.18);
      for(let i=0;i<7;i++){
        const px=x+side*(i%3*12),py=270-i*28;
        glow(d,px,py,10,shine,main);
        flame(d,px,py,16+(i%3)*8,i%2?main:'#ff8737',soft,shine);
        if(i%2===0){
          d.ellipse(px+side*8,py-29,2.2,2.2,'#fff6bc',.93);
          d.ellipse(px+side*17,py-10,1.3,1.3,soft,.88);
        }
      }
    }
    orbit(d,{rx:126,ry:113,from:Math.PI*.12,to:Math.PI*.88,width:3,color:soft,alpha:.56});
    orbit(d,{rx:126,ry:113,from:Math.PI*1.13,to:Math.PI*1.9,width:3,color:soft,alpha:.56});
  }else if(type==='gelo'){
    // Cristais longos, geada radial e flocos fractais visíveis.
    for(const side of sides){
      const x=160+side*119;
      for(let i=0;i<5;i++){
        const y=58+i*46,r=10+i%2*7;
        glow(d,x+side*(i%2*8),y,r,shine,soft);
        snow(d,x+side*(i%2*8),y,r,soft,shine);
        for(const n of [-1,1]){
          const xx=x+side*(28+n*5),yy=y+n*13;
          diamond(d,xx,yy,3+i%2*2,12-i%3*2,main,.65);
          d.line(xx-3,yy-3,xx,yy-9,1.2,shine,.72);
        }
      }
    }
    orbit(d,{rx:128,ry:107,from:-.65,to:1.2,width:2,color:shine,alpha:.5});
    orbit(d,{rx:128,ry:107,from:1.95,to:3.8,width:2,color:shine,alpha:.5});
  }else if(type==='eletrica'){
    for(const side of sides){
      for(let i=0;i<4;i++){
        const top=50+i*52;
        const x=160+side*111;
        const points=[[x+side*3,top-14],[x+side*23,top-3],
          [x+side*6,top+9],[x+side*29,top+20],[x+side*10,top+35]];
        bolt(d,points,i%2?soft:main,shine);
        glow(d,x+side*22,top+19,9,shine,soft);
        for(let j=0;j<3;j++)
          star(d,x+side*(7+j*11),top+8+j*8,2.5+j,shine,.9,4);
      }
    }
    orbit(d,{rx:126,ry:116,from:-.9,to:.83,width:3,color:main,alpha:.48});
    orbit(d,{rx:126,ry:116,from:2.25,to:3.93,width:3,color:soft,alpha:.48});
  }else if(type==='dinheiro'){
    // Moedas desenhadas em relevo + notas inclinadas e confete esmeralda.
    for(const side of sides){
      const x=160+side*113;
      for(let i=0;i<5;i++){
        const px=x+side*(i%2*17),py=58+i*46;
        glow(d,px,py,10,shine,main);
        if(i%2===0)coin(d,px,py,10+(i%3),soft,shine);
        else bill(d,px,py,29+((i*3)%7),main,shine);
        for(let j=0;j<3;j++)
          diamond(d,px+side*(10+j*7),py+11-j*7,2.4,4,shine,.6);
      }
    }
    orbit(d,{rx:122,ry:105,from:-.68,to:.95,width:3,color:main,alpha:.35});
    orbit(d,{rx:122,ry:105,from:2.19,to:3.84,width:3,color:main,alpha:.35});
  }else if(type==='coracoes'){
    // Corações em duas camadas, fitas curvas e pequenas pétalas.
    for(const side of sides){
      const path=[];
      for(let i=0;i<=24;i++){
        const y=39+i*10.1;
        const x=160+side*(113+Math.sin(i*.38)*7);
        path.push([x,y]);
      }
      curved(d,path,13,main,.08);curved(d,path,3,soft,.43);
      for(let i=0;i<5;i++){
        const x=160+side*(111+i%2*16),y=60+i*49;
        const r=9+i%3*3;
        glow(d,x,y,r,shine,main);
        heart(d,x,y,r+1,main,.9);
        heart(d,x-1,y-2,r*.7,soft,.88);
        d.ellipse(x-r*.38,y-r*.41,2,2,shine,.8);
        for(let k=0;k<3;k++)
          d.ellipse(x+side*(12+k*6),y-5+k*8,1.9,2.8,soft,.66);
      }
    }
  }
  // Poeira de luz discreta e mais densa na borda do avatar.
  for(let i=0;i<38;i++){
    const t=i*2.39996323,dist=108+i*37%31;
    const x=160+Math.cos(t)*dist,y=158+Math.sin(t)*dist*.88;
    if(x<10||x>310||y<13||y>289)continue;
    const sz=1.2+(i%4)*.36;
    d.ellipse(x,y,sz*3,sz*3,soft,.12);
    d.ellipse(x,y,sz,sz,shine,.75);
  }
}
export function drawAuraAccent(d,avatar){
  const theme=AURAS[avatar.aura];
  if(!theme)return;
  const [main,soft,shine]=theme;
  // Pequenas luzes à frente, nas pontas das asas, sem encobrir rosto e olhos.
  for(const side of [-1,1]){
    for(let i=0;i<4;i++){
      const x=160+side*(101+i%2*10),y=193+i*27;
      if(i%2===0){
        glow(d,x,y,4,shine,main);
        if(avatar.aura==='fogo')flame(d,x,y+5,12,main,soft,shine);
        else if(avatar.aura==='gelo')snow(d,x,y,5,soft,shine);
        else if(avatar.aura==='eletrica')
          bolt(d,[[x-4,y-9],[x+2,y-2],[x-2,y+4],[x+5,y+8]],main,shine);
        else if(avatar.aura==='dinheiro')coin(d,x,y,4,soft,shine);
        else if(avatar.aura==='coracoes')heart(d,x,y,5,main,.86);
        else star(d,x,y,5,main,.82,avatar.aura==='estrelas'?5:4);
      }else d.ellipse(x,y,1.5,2,shine,.75);
    }
  }
  // Arco luminoso sob os pezinhos: finaliza o desenho e dá sensação de flutuar.
  orbit(d,{cx:160,cy:285,rx:95,ry:15,from:.02,to:Math.PI-.02,
    color:soft,width:2.2,alpha:.29,segments:30});
}
