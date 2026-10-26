import test from 'node:test';import assert from 'node:assert/strict';
import {PermissionsBitField} from 'discord.js';
import {reactionRoleCommands,validReactionRole,emojiKey,validEmojiText,panelEmbed} from '../src/duck-reaction-roles.mjs';
test('comando tem criação, edição, visualização e exclusão',()=>{
 const command=reactionRoleCommands()[0];
 assert.equal(command.name,'cargosreacao');
 assert.deepEqual(command.options.map(x=>x.name),['criar','adicionar','remover','apagar','ver']);
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
