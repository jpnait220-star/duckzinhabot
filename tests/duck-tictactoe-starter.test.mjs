import test from 'node:test';
import assert from 'node:assert/strict';
import {DuckTicTacToe,chooseDuckMove,tictactoeOutcome} from '../src/duck-tictactoe.mjs';
const guildId='111111111111111111',channelId='222222222222222222',userId='333333333333333333';

test('sorteio permite que Duckzinha comece colocando O',async()=>{
 let response;
 const engine=new DuckTicTacToe({starter:()=>1,random:()=>0,
  setTimer:()=>({unref:()=>{}}),clearTimer:()=>{}});
 await engine.start({
  guildId,channelId,user:{id:userId},reply:async m=>{response=m},
  fetchReply:async()=>({edit:async()=>{}})
 });
 const session=engine.games.get(guildId+':'+channelId);
 assert.equal(session.firstPlayer,'O');
 assert.equal(session.board.filter(x=>x==='O').length,1);
 assert.equal(session.board.filter(x=>x==='X').length,0);
 assert.match(response.content,/Duckzinha ⭕/);
 assert.equal(response.components.length,3);
 engine.shutdown();
});
test('sorteio permite que jogador comece sem jogada antecipada',async()=>{
 let response;
 const engine=new DuckTicTacToe({starter:()=>0,
  setTimer:()=>({unref:()=>{}}),clearTimer:()=>{}});
 await engine.start({
  guildId,channelId,user:{id:userId},reply:async m=>{response=m},
  fetchReply:async()=>({edit:async()=>{}})
 });
 const session=engine.games.get(guildId+':'+channelId);
 assert.equal(session.firstPlayer,'X');
 assert.equal(session.board.filter(Boolean).length,0);
 assert.match(response.content,/Jogador ❌/);
 engine.shutdown();
});
test('Duckzinha não permite vitória fácil com duas jogadas abertas',()=>{
 const board=['X','','','','O','','','','X'];
 const pos=chooseDuckMove(board,()=>0);
 assert.ok(Number.isInteger(pos)&&pos>=0&&pos<9);
 assert.equal(board[pos],'');
 const next=[...board];next[pos]='O';
 assert.notEqual(tictactoeOutcome(next),'X');
});
