import test from 'node:test';
import assert from 'node:assert/strict';
import {COIN_VIDEO,renderFrame,resultAudio,coinflipVideo} from '../src/duck-coinflip-video.mjs';

test('frames have correct dimensions, different coin textures and animation changes by frame',()=>{
 const a=renderFrame('cara',0),b=renderFrame('cara',35);
 const c=renderFrame('coroa',67);
 assert.equal(a.length,COIN_VIDEO.width*COIN_VIDEO.height*3);
 assert.equal(b.length,a.length);assert.equal(c.length,a.length);
 assert.notDeepEqual(a,b,'Coin animation should rotate instead of showing the same image');
 assert.notDeepEqual(renderFrame('cara',67),c,'Cara and coroa final faces differ');
});

test('the synchronized sound has distinct landing chimes and fits video duration',()=>{
 const head=resultAudio('cara'),tail=resultAudio('coroa');
 assert.equal(head.length,COIN_VIDEO.seconds*16000*2);
 assert.notDeepEqual(head,tail);
 assert.ok(head.subarray(32000,60000).some(x=>x!==0));
});

test('FFmpeg generates two complete and distinct MP4 files with embedded video/audio',async()=>{
 const [cara,coroa]=await Promise.all([coinflipVideo('cara'),coinflipVideo('coroa')]);
 for(const file of [cara,coroa]){
  assert.ok(file.length>5000&&file.length<7*1024*1024);
  assert.equal(file.toString('ascii',4,8),'ftyp');
  assert.ok(file.includes(Buffer.from('moov')),'MP4 needs a movie atom for Discord playback');
  assert.ok(file.includes(Buffer.from('avc1')),'MP4 needs H.264 video');
  assert.ok(file.includes(Buffer.from('mp4a')),'MP4 needs AAC synchronized sound');
 }
 assert.notDeepEqual(cara,coroa);
 assert.equal(await coinflipVideo('cara'),cara,'Pre-rendered animation should be cached');
});
