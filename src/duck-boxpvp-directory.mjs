import {EmbedBuilder,MessageFlags,PermissionFlagsBits} from 'discord.js';

const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
const safeName=value=>String(value||'').trim().replace(/[@\r\n`*_~<>]/g,'').replace(/\s+/g,' ').slice(0,56);
export function validateBoxPvpIp(value){
 const ip=String(value||'').trim().toLowerCase();
 if(ip.length>253||ip.length<4||ip.includes('/')||ip.includes(' '))return null;
 const match=/^([a-z0-9.-]+)(?::(\d{1,5}))?$/.exec(ip);
 if(!match)return null;
 const host=match[1],labels=host.split('.');
 if(labels.length<2||labels.some(x=>!x||x.length>63||!(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/).test(x)))
  return null;
 if(['localhost','example.com','127.0.0.1','0.0.0.0'].includes(host))return null;
 const port=match[2]?Number(match[2]):null;
 if(port!==null&&(port<1||port>65535))return null;
 return ip;
}
export async function listBoxPvpServers(store,guildId){
 if(!store?.persistent)return null;
 return store.requireResult(store.db.from('duckzinha_boxpvp_servers')
  .select('id,server_name,server_ip').eq('guild_id',guildId)
  .order('created_at',{ascending:true}).limit(30));
}
export async function showBoxPvp(interaction,{store,panelId}={}){
 const suffix=panelId?'📩 **Abra um ticket** no painel <#'+panelId+'> e envie o nome e o IP do servidor.':
   '📩 **Abra um ticket** no canal de atendimento para solicitar o cadastro do seu servidor.';
 try{
  const servers=await listBoxPvpServers(store,interaction.guildId);
  const rows=servers?.length?servers.map((x,i)=>
    '**'+(i+1)+'. '+safeName(x.server_name)+'**\n`'+x.server_ip+'`').join('\n\n'):
    'Ainda não há servidores BoxPvP cadastrados.';
  return interaction.reply({
   embeds:[new EmbedBuilder().setColor(0xf7d65b)
    .setTitle('🎮 Servidores de BoxPvP')
    .setDescription('IPs de servidores de Minecraft aprovados pela equipe.\n\n'+
      rows+'\n\n'+suffix+'\n🛡️ O cadastro é feito pela administração após analisar o ticket.')
    .setFooter({text:'Duckzinha • DuckzinCommunity'})],
   allowedMentions:{parse:[]}
  });
 }catch(error){
  console.warn('[Duckzinha] Listagem de BoxPvP: '+String(error?.message||error));
  return interaction.reply(hidden('Não consegui carregar a lista de servidores agora. O cadastro pode ser solicitado pelo ticket.'));
 }
}
export async function manageBoxPvp(interaction,{store}={}){
 if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
  return interaction.reply(hidden('Apenas administradores podem aprovar e cadastrar IPs.'));
 if(!store?.persistent)return interaction.reply(hidden('Ative o Supabase para guardar os servidores.'));
 const kind=interaction.options.getSubcommand();
 try{
  if(kind==='adicionar'){
   const name=safeName(interaction.options.getString('nome',true));
   const ip=validateBoxPvpIp(interaction.options.getString('ip',true));
   if(!name||name.length<2||!ip)
    return interaction.reply(hidden('Informe um nome e um IP ou domínio válido (pode incluir :porta).'));
   const data=await store.requireResult(store.db.from('duckzinha_boxpvp_servers')
    .insert({guild_id:interaction.guildId,server_name:name,server_ip:ip})
    .select('id').single());
   return interaction.reply(hidden('✅ BoxPvP cadastrado: **'+name+'** — `'+ip+'` (ID #'+data.id+'). Agora aparece em /boxpvp.'));
  }
  const id=interaction.options.getInteger('id',true);
  const removed=await store.requireResult(store.db.from('duckzinha_boxpvp_servers')
   .delete().eq('guild_id',interaction.guildId).eq('id',id).select('id').maybeSingle());
  return interaction.reply(hidden(removed?'✅ Servidor #'+id+' removido da lista.':'Servidor não encontrado.'));
 }catch(error){
  console.warn('[Duckzinha] Cadastro de BoxPvP: '+String(error?.message||error));
  const duplicated=String(error?.code||'')==='23505'||String(error?.message||'').includes('23505');
  return interaction.reply(hidden(duplicated?'Esse IP já está cadastrado.':'Não consegui modificar a lista. Confira o banco de dados.'));
 }
}
