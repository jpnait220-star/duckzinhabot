import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits,MessageFlags} from 'discord.js';
import {newCommands,runNewCommand} from '../src/duck-features.mjs';
import {COLORS,normalizeAvatar,renderAvatar} from '../src/duck-avatar.mjs';

test('slash /falar é restrito a administrador na configuração do Discord',()=>{
  const cmd=newCommands().find(c=>c.name==='falar');
  assert.ok(cmd);
  assert.equal(cmd.default_member_permissions,String(PermissionFlagsBits.Administrator));
});

test('sem Administrator não executa TTS nem precisa de configuração de voz',async()=>{
  let response;
  const interaction={
    inGuild:()=>true,guildId:'guild',commandName:'falar',user:{id:'visitor'},
    memberPermissions:{has:()=>false},
    reply:async p=>{response=p}
  };
  const extras={mood:()=>{throw Error('TTS executed!')}};
  const result=await runNewCommand(interaction,{store:{guildId:'guild'},extras});
  assert.equal(result,true);
  assert.match(response.content,/Apenas administradores/);
  assert.equal(response.flags,MessageFlags.Ephemeral);
});

test('render do avatar ignora luvas salvas em perfis antigos',()=>{
  for(const name of ['luvas_brancas','luvas_boxe']){
    const obj=normalizeAvatar({maos:name,aura:'gelo'});
    assert.equal(obj.maos,'nenhuma');
    assert.deepEqual(renderAvatar({maos:name,aura:'gelo'}),renderAvatar({maos:'nenhuma',aura:'gelo'}));
  }
  assert.ok(COLORS.maos.every(v=>!v.startsWith('luvas_')));
  assert.deepEqual(COLORS.maos,['nenhuma','garras']);
});

test('as auras disponíveis têm renderização própria e são distintas entre si',()=>{
  const styles=['brilho','coracoes','fogo','gelo','eletrica','dinheiro'];
  const pngs=styles.map(aura=>renderAvatar({aura,maos:'nenhuma',pet:'nenhum'}));
  assert.equal(new Set(pngs.map(x=>x.toString('base64'))).size,styles.length);
  for(const p of pngs){
    assert.equal(p.readUInt32BE(16),384);
    assert.equal(p.readUInt32BE(20),384);
    assert.ok(p.length>9000,'Aura não tem detalhes suficientes');
  }
});
