import test from 'node:test';import assert from 'node:assert/strict';
import {PermissionsBitField} from 'discord.js';
import {ReactionRolePanels,reactionRoleCommands,validReactionRole,emojiKey,validEmojiText,panelEmbed} from '../src/duck-reaction-roles.mjs';
test('comando tem criação, edição, visualização e exclusão',()=>{
 const command=reactionRoleCommands()[0];
 assert.equal(command.name,'cargosreacao');
 assert.deepEqual(command.options.map(x=>x.name),['criar','adicionar','remover','apagar','ver','editar','migrar','diagnostico']);
});
test('emojis padrão e customizados geram chaves',()=>{
 assert.equal(validEmojiText('🧩'),true);
 assert.equal(validEmojiText('<:duck:123456789012345678>'),true);
 assert.equal(emojiKey('<:duck:123456789012345678>'),'123456789012345678');
 assert.equal(validEmojiText('@everyone'),false);
});
test('não pode atribuir cargo acima da bot ou com permissão perigosa',()=>{
 const guild={id:'123'};
 const bot={roles:{highest:{position:5}}};
 function role(position,perms=0n){return {id:'456',guild,managed:false,
  permissions:new PermissionsBitField(perms),comparePositionTo:()=>position-5};}
 assert.equal(validReactionRole(role(2),bot,guild),true);
 assert.equal(validReactionRole(role(7),bot,guild),false);
 assert.equal(validReactionRole(role(2,8n),bot,guild),false);
});
test('painel informa como adicionar e retirar cargo',()=>{
 const embed=panelEmbed({title:'Escolha cargos',description:'Clique nas reações',
  emoji_roles:[{emoji:'🧩',role_id:'123456789012345678'}]}).toJSON();
 assert.match(embed.description,/🧩/);
 assert.match(embed.description,/Retire sua reação/);
});

test('Criar painel publica como bot e não cria webhooks',async()=>{
 const guildId='123456789012345678',botId='987654321098765432';
 const role={id:'333333333333333333',name:'Mods',managed:false,guild:{id:guildId},
   permissions:new PermissionsBitField(0n),comparePositionTo:()=>-1};
 const permissions={has:()=>true};
 const sent=[];
 const channel={
   id:'222222222222222222',guildId,type:0,permissionsFor:()=>permissions,
   fetchWebhooks:()=>{throw Error('Não deveria buscar webhook');},
   send:async payload=>{
     sent.push(payload);
     return {id:'444444444444444444',react:async()=>{},
       delete:async()=>{throw Error('Não deveria excluir mensagem válida')}};
   }
 };
 const botMember={permissions,roles:{highest:{id:'555555555555555555'}}};
 const guild={id:guildId,members:{me:botMember},channels:{}};
 role.guild=guild;
 let saved,reply;
 const store={persistent:true,db:{from:()=>({upsert:value=>({value})})},
   requireResult:async query=>{saved=query.value}};
 const handler=new ReactionRolePanels({store,client:{user:{id:botId}},guildId});
 await handler.handleCommand({
   commandName:'cargosreacao',guildId,guild,channel,memberPermissions:{has:()=>true},
   options:{
     getSubcommand:()=> 'criar',
     getRole:()=>role,getChannel:()=>null,
     getString:key=>({emoji:'🧩',titulo:'Escolha cargos',descricao:'Reaja'}[key])
   },
   deferReply:async()=>{},editReply:async text=>{reply=text;return text}
 });
 assert.equal(sent.length,1);
 assert.equal(sent[0].embeds[0].data.title,'Escolha cargos');
 assert.equal(saved.message_id,'444444444444444444');
 assert.equal(saved.webhook_id,'');
 assert.match(reply.content,/Painel publicado/);
});
test('Comando migrar está disponível e informa que mensagens antigas mudam de autor',()=>{
 const cmd=reactionRoleCommands()[0];
 const migrating=cmd.options.find(x=>x.name==='migrar');
 assert.ok(migrating);
 assert.match(migrating.description,/webhook|Duckzinha/);
});

test('Editar descrição mantém mensagem, reações, emojis e cargos',async()=>{
 const guildId='123456789012345678',botId='987654321098765432';
 const before={guild_id:guildId,channel_id:'222222222222222222',
   webhook_id:'',message_id:'444444444444444444',title:'Cargos',
   description:'Descrição antiga',emoji_roles:[{emoji:'🧩',role_id:'333333333333333333'}]};
 const edits=[];
 const message={id:before.message_id,author:{id:botId},
   edit:async opts=>{edits.push(opts);return message},
   react:()=>{throw Error('Não deveria modificar reações')}};
 const channel={messages:{fetch:async id=>{assert.equal(id,before.message_id);return message}}};
 let saved,answer;
 const db={from:()=>({
   select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:before,error:null})})})}),
   upsert:data=>({data,error:null,value:data})
 })};
 const store={persistent:true,db,requireResult:async query=>{
   if(query.value){saved=query.value;return saved}
   if(Object.hasOwn(query,'data'))return query.data;
   return query;
 }};
 const handler=new ReactionRolePanels({store,client:{user:{id:botId}},guildId});
 const result=await handler.handleCommand({
   commandName:'cargosreacao',guildId,
   guild:{channels:{fetch:async()=>channel}},
   memberPermissions:{has:()=>true},
   options:{getSubcommand:()=> 'editar',
     getString:key=>({mensagem:before.message_id,descricao:'Nova descrição'}[key]??null)},
   deferReply:async()=>{},editReply:async x=>{answer=x;return x}
 });
 assert.equal(edits.length,1);
 assert.equal(edits[0].embeds[0].data.title,'Cargos');
 assert.match(edits[0].embeds[0].data.description,/Nova descrição/);
 assert.deepEqual(saved.emoji_roles,before.emoji_roles);
 assert.equal(saved.description,'Nova descrição');
 assert.equal(saved.message_id,before.message_id);
 assert.match(answer.content,/preservados/);
});
