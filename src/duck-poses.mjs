// Poses independentes dos cosméticos. Coordenadas no espaço 320x320.
const LINE='#443a52';
function heart(d,x,y,s,color){
 d.ellipse(x-s*.46,y-s*.2,s*.55,s*.52,color);
 d.ellipse(x+s*.46,y-s*.2,s*.55,s*.52,color);
 d.polygon([[x-s,y-s*.15],[x+s,y-s*.15],[x,y+s*.95]],color);
}
function sparkle(d,x,y,r,color){
 d.polygon([[x,y-r],[x+r*.25,y-r*.22],[x+r,y],[x+r*.25,y+r*.22],
 [x,y+r],[x-r*.25,y+r*.22],[x-r,y],[x-r*.25,y-r*.22]],color);
}
export const POSES=['normal','acenando','dormindo','comemorando','coracao','de_lado'];
export const POSITION=['esquerda','centro','direita'];
export const SIZE=['pequeno','normal','grande'];
export const DETAIL_COLORS=['original','dourado','rosa','azul','verde','roxo','vermelho'];
export const DETAIL_HEX={
 original:null,dourado:'#ffd56d',rosa:'#f2a3d3',azul:'#74c7f0',
 verde:'#81dcb0',roxo:'#b99aff',vermelho:'#ed777e'
};
export function poseEffects(d,avatar){
 const pose=avatar.pose;
 if(pose==='normal')return;
 if(pose==='acenando'){
   d.line(231,193,265,146,22,LINE);d.line(231,193,265,146,16,'#f3c04e');
   d.ellipse(266,139,17,21,LINE);d.ellipse(266,139,13,17,'#ffda68');
   d.line(276,130,298,119,2.5,'#fff4c6',.8);
   d.line(280,144,303,147,2.5,'#fff4c6',.8);
   d.line(254,122,252,101,2.5,'#fff4c6',.8);
 }else if(pose==='dormindo'){
   for(let i=0;i<3;i++){
     const x=223+i*26,y=93-i*25;
     d.line(x,y,x+12,y,3,'#e7f6ff');
     d.line(x+12,y,x,y+15,3,'#e7f6ff');
     d.line(x,y+15,x+12,y+15,3,'#e7f6ff');
   }
   d.ellipse(160,184,4,3,'#8b6c68');
 }else if(pose==='comemorando'){
   for(const side of [-1,1]){
     const x=160+side*78;
     d.line(x,195,x+side*25,130,24,LINE);
     d.line(x,195,x+side*25,130,17,'#ffda68');
     d.ellipse(x+side*26,125,13,17,'#ffda68');
     sparkle(d,160+side*118,104,8,'#ffe997');
     sparkle(d,160+side*97,77,4,'#ffffff');
   }
 }else if(pose==='coracao'){
   d.line(108,206,138,217,21,LINE);d.line(212,206,182,217,21,LINE);
   d.line(108,206,138,217,14,'#ffdf79');d.line(212,206,182,217,14,'#ffdf79');
   heart(d,160,220,23,'#a84567');heart(d,160,216,19,'#fa91ad');
   d.ellipse(149,208,5,4,'#fff2f5',.82);
 }else if(pose==='de_lado'){
   d.ellipse(216,181,19,9,'#f1a4ac',.7);
   d.ellipse(223,177,16,9,'#ed9043');
   d.line(186,155,208,154,2,LINE,.7);
 }
}
export function transformPainter(painter,avatar){
 const zoom=avatar.tamanho==='grande'?1.095:avatar.tamanho==='pequeno'?.88:1;
 const dx=avatar.posicao==='esquerda'?-17:avatar.posicao==='direita'?17:0;
 const pivotX=160,pivotY=171;
 const point=(x,y)=>[(x-pivotX)*zoom+pivotX+dx,(y-pivotY)*zoom+pivotY];
 return {
  ellipse:(x,y,rx,ry,color,alpha)=>{const [X,Y]=point(x,y);painter.ellipse(X,Y,rx*zoom,ry*zoom,color,alpha);},
  rect:(x,y,w,h,color,alpha)=>{const [X,Y]=point(x,y);painter.rect(X,Y,w*zoom,h*zoom,color,alpha);},
  line:(x,y,x2,y2,w,color,alpha)=>{
   const [X,Y]=point(x,y),[X2,Y2]=point(x2,y2);
   painter.line(X,Y,X2,Y2,w*zoom,color,alpha);
  },
  polygon:(pts,color,alpha)=>painter.polygon(pts.map(([x,y])=>point(x,y)),color,alpha)
 };
}
