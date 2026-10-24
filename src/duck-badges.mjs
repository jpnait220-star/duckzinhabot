import {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,PermissionFlagsBits} from 'discord.js';

export const BADGES=Object.freeze({
 bronze:{name:'Emblema Bronze',emoji:'🥉',color:'bronze'},
 prata:{name:'Emblema Prata',emoji:'🥈',color:'silver'},
 ouro:{name:'Emblema Ouro',emoji:'🥇',color:'gold'},
 diamante:{name:'Emblema Diamante',emoji:'💎',color:'diamond'}
});
const dangerous=[
 PermissionFlagsBits.Administrator,PermissionFlagsBits.ManageGuild,
 PermissionFlagsBits.ManageRoles,PermissionFlagsBits.ManageChannels,
 PermissionFlagsBits.ManageWebhooks,PermissionFlagsBits.BanMembers,
 PermissionFlagsBits.KickMembers,PermissionFlagsBits.ModerateMembers,
 PermissionFlagsBits.ManageMessages,PermissionFlagsBits.MentionEveryone,
 PermissionFlagsBits.ManageThreads
];
const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});

export function safeBadgeRole(guild,role,me){
 if(!guild||!role||!me||role.guild.id!==guild.id)return {ok:false,reason:'Cargo inválido.'};
 if(role.id===guild.id||role.managed)return {ok:false,reason:'Esse cargo não pode ser entregue.'};
 if(dangerous.some(p=>role.permissions.has(p)))return {ok:false,
  reason:'Não é permitido vender cargos com permissões administrativas ou de moderação.'};
 if(!me.permissions.has(PermissionFlagsBits.ManageRoles))return {ok:false,
  reason:'A Duckzinha precisa da permissão Gerenciar Cargos.'};
 if(me.roles.highest.comparePositionTo(role)<=0)return {ok:false,
  reason:'Coloque o cargo da Duckzinha acima do cargo do emblema na hierarquia.'};
 return {ok:true};
}
export async function validatedRole(interaction,roleId){
 const guild=interaction.guild;
 const me=guild.members.me||await guild.members.fetchMe();
 const role=await guild.roles.fetch(roleId).catch(()=>null);
 const safe=safeBadgeRole(guild,role,me);
 if(!safe.ok)throw Error(safe.reason);
 return role;
}
export function badgePanel(items){
 const content='## 🏷️ Loja de Emblemas\n'+
   items.map(x=>(BADGES[x.badge_key]?.emoji||'🏷️')+' **'+x.label+'** • '+
     x.price+' 🪙\nCargo: <@&'+x.role_id+'>').join('\n\n')+
   '\n\n🛍️ **Compre seu emblema e receba um cargo exclusivo!**\n'+
   '🔓 Seu emblema poderá liberar acesso a **projetos e downloads especiais no site da DuckzinCommunity**, conforme os benefícios disponíveis.\n'+
   '✨ Garanta seu emblema e aproveite as novidades da comunidade!';
 const row=new ActionRowBuilder().addComponents(items.slice(0,4).map(x=>
   new ButtonBuilder().setCustomId('duckbadge:'+x.badge_key)
     .setLabel(x.label.slice(0,55)).setEmoji(BADGES[x.badge_key]?.emoji||'🏷️')
     .setStyle(ButtonStyle.Primary)));
 return {content,components:[row],allowedMentions:{parse:[]}};
}
export const dailyPanel=()=>({
 content:'## 🪙 Recompensa Diária\n'+
   '🎁 **20 moedas** para resgatar todos os dias!\n\n'+
   '⏰ Disponível novamente à meia-noite (horário da Bahia).\n'+
   '🏷️ Use suas moedas na Loja de Emblemas.\n\n'+
   '✨ Clique no botão abaixo para resgatar as suas.',
 components:[new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId('duckdaily:claim').setLabel('Resgatar 20 moedas')
     .setEmoji('🪙').setStyle(ButtonStyle.Success)
 )],allowedMentions:{parse:[]}
});
// Apenas a publicação feita por um administrador avisa o servidor todo.
// Painéis isolados, respostas a botões, consultas e atualizações não mencionam @everyone.
export function publishedPanel(panel){
 return {...panel,content:'@everyone\\n\\n'+panel.content,
   allowedMentions:{parse:['everyone']}};
}
export class DuckBadgeShop{
 constructor({store}={}){this.store=store;}
 async publish(interaction){
   if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
     return interaction.reply(hidden('Somente administradores podem publicar painéis.'));
   if(!this.store?.persistent)return interaction.reply(hidden('Supabase indisponível.'));
   const items=await this.store.listBadges();
   if(items.length===0)return interaction.reply(hidden('Configure um emblema primeiro usando /emblema configurar.'));
   if(items.some(x=>!BADGES[x.badge_key]))
     return interaction.reply(hidden('A loja tem configuração inválida.'));
   const me=interaction.guild.members.me||await interaction.guild.members.fetchMe();
   if(!interaction.channel.permissionsFor(me)?.has(
     [PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]))
     return interaction.reply(hidden('Preciso de acesso para publicar nesse canal.'));
   if(!interaction.channel.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone))
     return interaction.reply(hidden('Para avisar @everyone, preciso da permissão Mencionar @everyone neste canal.'));
   for(const item of items){
     try{await validatedRole(interaction,item.role_id);}
     catch(err){return interaction.reply(hidden('Erro no emblema '+item.label+': '+err.message));}
   }
   await interaction.channel.send(publishedPanel(badgePanel(items)));
   return interaction.reply(hidden('🏷️ Loja de emblemas publicada no canal!'));
 }
 async configure(interaction){
   if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
     return interaction.reply(hidden('Somente administradores podem configurar emblemas.'));
   const key=interaction.options.getString('tipo',true),role=interaction.options.getRole('cargo',true),
     price=interaction.options.getInteger('preco',true);
   if(!BADGES[key]||!Number.isInteger(price)||price<1||price>100000)
     return interaction.reply(hidden('Emblema ou preço inválido.'));
   try{await validatedRole(interaction,role.id);}
   catch(err){return interaction.reply(hidden('Não posso usar esse cargo: '+err.message));}
   await this.store.setBadge({key,label:BADGES[key].name,price,roleId:role.id});
   return interaction.reply(hidden('✅ '+BADGES[key].emoji+' '+BADGES[key].name+
     ' configurado por '+price+' moedas, entregando o cargo <@&'+role.id+'>.\n'+
     'Para disponibilizar projetos num canal exclusivo, configure a visibilidade desse canal para o cargo no Discord.'));
 }
 async handleBuy(interaction){
   const key=String(interaction.customId).split(':')[1];
   if(!BADGES[key])return interaction.reply(hidden('Emblema inválido.'));
   if(!this.store?.persistent)return interaction.reply(hidden('Supabase indisponível.'));
   const member=await interaction.guild.members.fetch(interaction.user.id).catch(()=>null);
   if(!member)return interaction.reply(hidden('Você precisa estar no servidor.'));
   const items=await this.store.listBadges();
   const item=items.find(x=>x.badge_key===key);
   if(!item)return interaction.reply(hidden('Esse emblema saiu da loja.'));
   let role;
   try{role=await validatedRole(interaction,item.role_id);}
   catch(err){return interaction.reply(hidden('A compra está pausada: '+err.message));}
   const result=await this.store.buyBadge(interaction.user.id,key);
   if(!result.ok)return interaction.reply(hidden(
     result.reason==='funds'?'Você precisa de '+result.cost+' moedas e tem '+result.balance+'.':
      'Não consegui finalizar a compra.'));
   try{
     if(!member.roles.cache.has(role.id))await member.roles.add(role,'Emblema Duckzinha comprado com moedas do bot');
     return interaction.reply(hidden((result.already?'🏷️ Seu emblema foi restaurado!':
       '✅ Você comprou o emblema!')+'\n'+BADGES[key].emoji+
       ' Cargo: **'+role.name+'**'+(result.already?'':'\nSaldo: **'+result.balance+' 🪙**')));
   }catch(err){
     // Quando o cargo não é entregue, a compra não deve consumir moedas.
     if(!result.already){
       const reread=await interaction.guild.members.fetch(interaction.user.id).catch(()=>null);
       if(!reread?.roles.cache.has(role.id))
         await this.store.refundBadge(interaction.user.id,key).catch(e=>
           console.error('[Duckzinha] Falha no estorno do emblema: '+e.message));
     }
     return interaction.reply(hidden('Não consegui atribuir o cargo. A compra foi cancelada ou o cargo será restaurado pela administração.'));
   }
 }
 async handleDaily(interaction){
   if(!this.store?.persistent)return interaction.reply(hidden('Supabase indisponível.'));
   const outcome=await this.store.claimDaily(interaction.user.id);
   if(outcome.ok)return interaction.reply(hidden('🪙 **+20 moedas de pato!**\nSeu saldo é **'+outcome.balance+' moedas**. Volte amanhã!'));
   return interaction.reply(hidden(outcome.reason==='claimed'
     ?'Você já recebeu suas **20 moedas de hoje**. Volte amanhã! 💛'
     :'Não consegui resgatar as moedas.'));
 }
 async publishDaily(interaction){
   if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
     return interaction.reply(hidden('Somente administradores podem publicar o painel diário.'));
   if(!this.store?.persistent)return interaction.reply(hidden('Supabase indisponível.'));
   const me=interaction.guild.members.me||await interaction.guild.members.fetchMe();
   if(!interaction.channel.permissionsFor(me)?.has(
     [PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]))
     return interaction.reply(hidden('Preciso de permissão para publicar mensagens aqui.'));
   if(!interaction.channel.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone))
     return interaction.reply(hidden('Para avisar @everyone, preciso da permissão Mencionar @everyone neste canal.'));
   await interaction.channel.send(publishedPanel(dailyPanel()));
   return interaction.reply(hidden('✅ Painel de 20 moedas diárias publicado!'));
 }
 async list(interaction){
   const items=await this.store.listBadges();
   if(!items.length)return interaction.reply(hidden('Ainda não há emblemas cadastrados. A administração pode usar /emblema configurar.'));
   return interaction.reply(hidden('🏷️ **Emblemas disponíveis**\n'+
     items.map(i=>(BADGES[i.badge_key]?.emoji||'🏷️')+' '+i.label+' — **'+i.price+' 🪙**').join('\n')+
     '\nPeça à administração para publicar /emblema publicar no canal da loja.'));
 }
}
