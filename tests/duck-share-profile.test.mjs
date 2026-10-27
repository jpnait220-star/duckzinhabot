import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MessageFlags} from 'discord.js';
import {commandPayloads} from '../src/commands.mjs';
import {
  PROFILE_COPY_BUTTON_ID,PROFILE_PUBLISH_ROLE_ID,MAX_PROFILE_LENGTH,
  validProfileCode,canPostProfile,profileEmbed,extractProfileCode,
  handleProfileCommand,handleProfileCopy
} from '../src/duck-share-profile.mjs';

const guildId='123456789012345678';
const botId='987654321098765432';
const userId='222222222222222222';
const code='DZ3:e:bVbLcmM1EP0Vczds5JTUL0mzgwFmNRug2KRm4UpMcFUSVwWHxVB8DN_Cj3HU0tX1PLzqbl3143Sflm9vxcqHcEvh98Pjn0dIHC4vry7kVZJpE5vfSZ1iTut5nndyDUuhN2mBXMpqrXFeqjXsS05VjUihp1iaocTI3NSUAnO8iS5TIK5DltVZShkx-A0trmz5JKoh3hSN17_UDlDTXimZJo8hMYwIkkIdAQR5ZInK_RuNIfcDTSHZkG3LwlCIO88xpOEOiMSbXlYmiNWlHNaCgE66oU_yi9QOCoc9S8yWsqsC35RKFfEQJcOZxS8Lq4Dit_Pdcfd0uJxfd3__dbq7nJ7--cahqSUs37-cHv84dxWt-e7x6dAUigyP6lKLFXuCFDWUIVmQYURLll_Oz6c7v4mmLG9fTpfdD6fnh25hVKXuLGlYfj1fjk_9YI4FasE3-cvKKdWBE1EMmqyHpBTKiE5lNpjQR-1Whr_ROUI71zDbyJLodg_zi-ieoaJcMeSj7ComQ9iAQrEGPVkMe0qSpbCJU8QocEo9lDHkgRD6vs9WrPrAEBrOK4yZA43kshfepBIDdVuhmWWxTSwbdajOmhid0OGYYw6gTZeTIdOcNbvSaKVqNSdyAxHamskqSzZzy5xdJm1fl0aJ6L54C8cp7E2V_Q5vxGeAP-UGKPc0BClJh4S1tKDgbbZOZ9b6ucXm1mBDBRxLTJVcbVC5n22zMNhzNcS8QcdOCh87LnVaa6vbgApJdR2t6OBJRMNiHwOJ6ZPPJPZrFLFEXAchk1TBomLXxc9Zs_T7QDCpVqpCrqOUajnBoau5fx7ZursGjEbknF1PbVGYewJ7ZOwHwZJb3h3PP52fL7sf7x-Oixs33CWtECExsPnj6-Ph3oERKtvaxgrtH7FXIRjCUno0bkxoYy2yXdA5GVJ0E1ES9CyubK8C5vSry0hKvXol0pVMwWIntgJn8b2jjjCVBD5lJbdIW8vVRV13qmLf7NGkmJxmCojqOMA3pTNKMe0YdkxSZCpugHc0eZyieVSGrOvUKLeeo2HWY3JbiX6ZZUZnDVhRQ54Y6LZnFDiORanYHcv78_1xx4ur3nTDmDQuKYaaBo81m7NT0ZrqE6LYDmhcPy0pDEYpHoYVRy1tqCjjEePaEcOW2NdSrRMI0xhU-r0qYZU2CptjnvD0Fy_Zol6dWWcE2sGu57bVXcKo_Xw4fXx9_3Z393g8PLfqLGGdlf4sGsZZeYgTGfPV7q8h9u20olXLu_PlsLv_9r9_H179OTLsn7l0jNPXB8zQjI6QtTEee9B4DjII1xjOrYlWmhcna07x6j9LHsBkcKlJH_4H';

function makeCommand(member,profileCode=code){
  const responses=[];
  const interaction={
    commandName:'profile',guildId,inGuild:()=>true,member,
    user:{id:userId},options:{getString:()=>profileCode},
    reply:async data=>{responses.push(data);return data}
  };
  return {interaction,responses};
}

test('Comando /profile fica separado de /perfil, sem novas variáveis de ambiente',()=>{
  const commands=commandPayloads();
  assert.ok(commands.some(x=>x.name==='perfil'));
  const cmd=commands.find(x=>x.name==='profile');
  assert.ok(cmd);
  assert.equal(cmd.options[0].name,'codigo');
  assert.equal(cmd.options[0].required,true);
  assert.equal(cmd.options[0].max_length,MAX_PROFILE_LENGTH);
  assert.equal(PROFILE_PUBLISH_ROLE_ID,'1564363880443158668');
});

test('Valida códigos DZ3 de tamanho longo e rejeita menções, markdown e URLs',()=>{
  assert.equal(validProfileCode(code),true);
  for(const invalid of ['hello','DZ3:e:','DZ3:e:abc\n@everyone','DZ3:e:abc*',
    'DZ3:e:abc def','https://example.com','DZ3:e:'+('z'.repeat(MAX_PROFILE_LENGTH))])
    assert.equal(validProfileCode(invalid),false);
});

test('Só o cargo autorizado pode publicar em mensagens públicas',async()=>{
  const member={roles:{cache:new Map([[PROFILE_PUBLISH_ROLE_ID,true]])}};
  assert.equal(canPostProfile(member),true);
  assert.equal(canPostProfile({roles:[PROFILE_PUBLISH_ROLE_ID]}),true);
  assert.equal(canPostProfile({roles:{cache:new Map()}}),false);

  const accepted=makeCommand(member);
  await handleProfileCommand(accepted.interaction,{guildId});
  assert.equal(accepted.responses.length,1);
  const posted=accepted.responses[0];
  assert.ok(!('flags' in posted));
  assert.equal(posted.allowedMentions.parse.length,0);
  assert.equal(posted.components[0].components[0].data.custom_id,PROFILE_COPY_BUTTON_ID);
  assert.match(posted.embeds[0].data.description,/DZ3:e:/);
  assert.equal(extractProfileCode({embeds:[posted.embeds[0].data]}),code);

  const denied=makeCommand({roles:{cache:new Map()}});
  await handleProfileCommand(denied.interaction,{guildId});
  assert.equal(denied.responses[0].flags,MessageFlags.Ephemeral);
  assert.match(denied.responses[0].content,/Apenas membros com o cargo/);
  assert.equal(denied.responses[0].embeds,undefined);
});

test('O botão entrega o perfil completo em mensagem privada copiável',async()=>{
  const responses=[];
  const msg={author:{id:botId},embeds:[profileEmbed({userId,code}).data]};
  await handleProfileCopy({
    guildId,customId:PROFILE_COPY_BUTTON_ID,message:msg,
    reply:async x=>{responses.push(x);return x}
  },{guildId,botId});
  assert.equal(responses[0].flags,MessageFlags.Ephemeral);
  assert.ok(responses[0].content.includes(code));
  assert.ok(responses[0].content.includes(String.fromCharCode(96).repeat(3)));

  const bad=[];
  await handleProfileCopy({
    guildId,customId:PROFILE_COPY_BUTTON_ID,
    message:{author:{id:'outro'},embeds:msg.embeds},
    reply:async x=>{bad.push(x);return x}
  },{guildId,botId});
  assert.match(bad[0].content,/origem/);
  assert.ok(!bad[0].content.includes(code));
});

test('Perfis acima de 1850 caracteres podem ser copiados por TXT efêmero',async()=>{
  const long='DZ3:e:'+('a'.repeat(1900));
  const reply=[];
  await handleProfileCopy({
    guildId,customId:PROFILE_COPY_BUTTON_ID,
    message:{author:{id:botId},embeds:[profileEmbed({userId,code:long}).data]},
    reply:async x=>{reply.push(x)}
  },{guildId,botId});
  assert.equal(reply[0].flags,MessageFlags.Ephemeral);
  assert.equal(reply[0].files.length,1);
  assert.equal(reply[0].files[0].name,'Profile-DZ3.txt');
});

test('Comando e botão estão ligados ao mesmo handler principal',async()=>{
  const source=await readFile(new URL('../src/bot.mjs',import.meta.url),'utf8');
  assert.match(source,/if\(interaction\.commandName==='profile'\)/);
  assert.match(source,/handleProfileCommand\(interaction/);
  assert.match(source,/handleProfileCopy\(interaction/);
  assert.match(source,/PROFILE_COPY_BUTTON_ID/);
});
