// Apenas configurações públicas de canais, sem tokens nem dados pessoais.
export const isSnowflake=value=>/^\d{17,22}$/.test(String(value||'').trim());

export function isTicketChannel({type,parentId,name,visibleToEveryone},ticketCategoryId=''){
  // Apenas canais de texto privados. Nunca postar em avisos, canais gerais ou DMs.
  if(type!==0||visibleToEveryone)return false;
  if(isSnowflake(ticketCategoryId))return parentId===ticketCategoryId;
  // Sem categoria configurada, só reconhecer canais com prefixo bem específico.
  return /^(?:ticket|tickets|atendimento)[-_]/i.test(String(name||''));
}

export function ticketOpeningMessage(){
  return '🦆💛 **Ticket recebido!** Sua solicitação foi aberta. Por favor, aguarde um membro da **equipe staff** responder aqui. Assim que alguém estiver disponível, vai te atender! ✨';
}

export function welcomeMessage(memberId,guildName){
  const name=String(guildName||'nosso servidor').replace(/[@\r\n]/g,'').slice(0,80);
  return '🦆💛 Seja muito bem-vindo(a), <@'+memberId+'>, ao **'+name+'**! Que bom ter você aqui! Dá uma olhadinha nos canais e aproveita a comunidade. ✨';
}
