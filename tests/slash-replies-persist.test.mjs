import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags} from 'discord.js';
import {runCommand} from '../src/commands.mjs';

test('Respostas de comandos públicos não entram na limpeza temporária',async()=>{
  const commands=['website','ajuda','ticket','projetos','boxpvp','faq','sobre','ping'];
  for(const commandName of commands){
    let reply,scheduled=0;
    await runCommand({
      inGuild:()=>true,guildId:'guild1',commandName,
      reply:async options=>{reply=options;return {resource:{message:{id:'message1'}}};},
      fetchReply:async()=>({id:'message1'})
    },{
      store:{guildId:'guild1'},site:'https://example.org',panelId:'',
      client:{ws:{ping:42}},schedule:()=>{scheduled++;}
    });
    assert.ok(reply,commandName+' deve responder');
    assert.equal(reply.flags,undefined,commandName+' deve ser público');
    assert.equal(scheduled,0,commandName+' não pode ser agendado para exclusão');
  }
});

test('Guia /explicarproblema permanece resposta privada/efêmera',async()=>{
  let reply;
  await runCommand({
    inGuild:()=>true,guildId:'guild1',commandName:'explicarproblema',
    reply:async options=>{reply=options;return {};}
  },{store:{guildId:'guild1'}});
  assert.ok(reply);
  assert.equal(reply.flags,MessageFlags.Ephemeral);
});
