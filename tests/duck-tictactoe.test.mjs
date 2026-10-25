import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags} from 'discord.js';
import {DuckTicTacToe,tictactoeOutcome,chooseDuckMove,tictactoeButtons} from '../src/duck-tictactoe.mjs';

const guildId='111111111111111111',channelId='222222222222222222';
function gameFixture(){
 let now=100000,reply,edit,updated,callback;
 let idCounter=0;
 const game=new DuckTicTacToe({
  now:()=>now,random:()=>0,starter:()=>0,
  setTimer:cb=>{callback=cb;return {unref:()=>{}};},
  clearTimer:()=>{}
 });
 const message={edit:async payload=>{edit=payload;return message;}};
 const interaction={
  guildId,channelId,user:{id:'333333333333333333'},
  reply:async payload=>{reply=payload;},
  fetchReply:async()=>message,
  update:async payload=>{updated=payload;}
 };
 return {game,interaction,message,
  get reply(){return reply;},get edit(){return edit;},
  get updated(){return updated;},
  get callback(){return callback;},advanceTime:ms=>{now+=ms;}};
}
test('o tabuleiro detecta linhas, colunas, diagonais e empate',()=>{
 assert.equal(tictactoeOutcome(['X','X','X','','','','','','']),'X');
 assert.equal(tictactoeOutcome(['O','','','O','','','O','','']),'O');
 assert.equal(tictactoeOutcome(['X','','','','X','','','','X']),'X');
 assert.equal(tictactoeOutcome(['X','O','X','X','O','O','O','X','X']),'draw');
 assert.equal(tictactoeOutcome(['X','','','','O','','','','']),null);
 assert.throws(()=>tictactoeOutcome(['X']));
});
test('Duckzinha aproveita vitória e bloqueia vitória do jogador',()=>{
 assert.equal(chooseDuckMove(['O','O','','X','X','','','',''],()=>0),2);
 assert.equal(chooseDuckMove(['X','X','','O','','','','',''],()=>0),2);
 assert.equal(chooseDuckMove(['X','','','','','','','',''],()=>0),4);
 assert.equal(chooseDuckMove(['X','O','X','X','O','O','O','X','X']),-1);
});
test('comando publica tabuleiro 3x3 e cada casa é um botão',async()=>{
 const f=gameFixture();await f.game.start(f.interaction);
 assert.match(f.reply.content,/Jogo da Velha/);
 assert.equal(f.reply.components.length,3);
 assert.ok(f.reply.components.every(row=>row.components.length===3));
 assert.equal(f.game.games.size,1);
 const first=f.game.games.get(guildId+':'+channelId);
 const id=first.id;
 await f.game.choose({...f.interaction,customId:'duckttt:'+id+':0'});
 assert.match(f.updated.content,/Vez de/);
 assert.equal(first.board[0],'X');
 assert.equal(first.board[4],'O');
 assert.equal(f.updated.components[0].components[0].data.disabled,true);
 assert.equal(f.updated.components[1].components[1].data.disabled,true);
 assert.equal(f.updated.flags,undefined);
 assert.deepEqual(f.updated.allowedMentions,{parse:[]});
 f.game.shutdown();
});
test('não permite roubar o jogo nem clicar casa ocupada',async()=>{
 const f=gameFixture();await f.game.start(f.interaction);
 const id=f.game.games.get(guildId+':'+channelId).id;
 await f.game.choose({...f.interaction,
  user:{id:'444444444444444444'},customId:'duckttt:'+id+':0'});
 assert.match(f.reply.content,/outro jogador/);
 assert.equal(f.reply.flags,MessageFlags.Ephemeral);
 await f.game.choose({...f.interaction,customId:'duckttt:'+id+':0'});
 await f.game.choose({...f.interaction,customId:'duckttt:'+id+':0'});
 assert.match(f.reply.content,/não está disponível/);
 f.game.shutdown();
});
test('vitória conclui partida e desabilita todos os botões',async()=>{
 const f=gameFixture();await f.game.start(f.interaction);
 const current=f.game.games.get(guildId+':'+channelId);
 current.board=['X','X','','O','O','','','',''];
 await f.game.choose({...f.interaction,customId:'duckttt:'+current.id+':2'});
 assert.match(f.updated.content,/Você venceu/);
 assert.equal(f.game.games.size,0);
 assert.ok(f.updated.components.every(row=>row.components.every(b=>b.data.disabled)));
 await f.game.choose({...f.interaction,customId:'duckttt:'+current.id+':5'});
 assert.match(f.reply.content,/terminou/);
 f.game.shutdown();
});
test('encerra por inatividade, limpa a partida e permite iniciar outra',async()=>{
 const f=gameFixture();await f.game.start(f.interaction);
 f.advanceTime(90000);
 await f.callback();
 assert.match(f.edit.content,/inatividade/);
 assert.equal(f.game.games.size,0);
 await f.game.start(f.interaction);
 assert.equal(f.game.games.size,1);
 f.game.shutdown();
});
