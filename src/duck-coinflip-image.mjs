import {deflateSync} from 'node:zlib';
import {renderFrame,COIN_VIDEO} from './duck-coinflip-video.mjs';

// Um único painel PNG estático, com cara e coroa lado a lado.
// Sem FFmpeg, vídeos, GIFs ou arquivos temporários.
const SIDE_WIDTH=COIN_VIDEO.width;
const HEIGHT=COIN_VIDEO.height;
const WIDTH=SIDE_WIDTH*2;
const CRC_TABLE=Uint32Array.from({length:256},(_,n)=>{
 let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;
 return c>>>0;
});
function crc32(bytes){
 let v=0xffffffff;
 for(const b of bytes)v=CRC_TABLE[(v^b)&255]^(v>>>8);
 return (v^0xffffffff)>>>0;
}
function chunk(type,data){
 const name=Buffer.from(type,'ascii'),size=Buffer.alloc(4),crc=Buffer.alloc(4);
 size.writeUInt32BE(data.length);
 crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
 return Buffer.concat([size,name,data,crc]);
}
function rgbPng(width,height,pixels){
 if(pixels.length!==width*height*3)throw Error('Dimensões RGB inválidas');
 const scan=Buffer.allocUnsafe(height*(width*3+1));
 for(let y=0;y<height;y++){
  const dst=y*(width*3+1);
  scan[dst]=0;
  pixels.copy(scan,dst+1,y*width*3,(y+1)*width*3);
 }
 const header=Buffer.alloc(13);
 header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);
 header[8]=8;header[9]=2;header[10]=0;header[11]=0;header[12]=0;
 return Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR',header),
  chunk('IDAT',deflateSync(scan,{level:5})),
  chunk('IEND',Buffer.alloc(0))
 ]);
}
let cached;
export function coinflipImage(){
 if(cached)return cached;
 const finalFrame=Math.round(COIN_VIDEO.fps*COIN_VIDEO.seconds)-1;
 const sides=[renderFrame('cara',finalFrame),renderFrame('coroa',finalFrame)];
 const rgb=Buffer.allocUnsafe(WIDTH*HEIGHT*3);
 for(let y=0;y<HEIGHT;y++){
  for(let side=0;side<2;side++){
   sides[side].copy(rgb,(y*WIDTH+side*SIDE_WIDTH)*3,
    y*SIDE_WIDTH*3,(y+1)*SIDE_WIDTH*3);
  }
 }
 cached=rgbPng(WIDTH,HEIGHT,rgb);
 if(cached.length<1024||cached.length>4*1024*1024)
  throw Error('Imagem do Coinflip inválida');
 return cached;
}
