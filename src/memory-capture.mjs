// Memórias permanentes somente de preferências expressas pela própria pessoa
// ou informações oficiais e explícitas de moderadores, nunca mensagens privadas.
export function captureCandidate(input,{mentioned=false,isStaff=false}={}){
  const raw=String(input||'').replace(/\s+/g,' ').trim();
  if(raw.length<8||raw.length>220||/(?:https?:\/\/|<@|@everyone|@here)/i.test(raw))return null;
  const directive=raw.match(/^(?:lembra|lembre|anota|anote|guarda|guarde)(?: (?:a[ií]|na mem[oó]ria))?(?: que)?\s+(.+)$/i);
  const message=(directive?.[1]||raw).replace(/[.!?]+$/,'').trim();
  if(isStaff&&directive&&/^(?:o|a|no|na|nosso|nossa)\s+(?:servidor|server|sv|comunidade)\b/i.test(message))
    return {kind:'server',key:'servidor',value:message.slice(0,180)};
  // Preferências pessoais só são persistidas a pedido expresso do próprio autor.
  if(!directive)return null;
  const allowed=/^(?:meu jogo favorito (?:[ée]|eh)|minha cor favorita (?:[ée]|eh)|meu hobby (?:[ée]|eh)|meu anime favorito (?:[ée]|eh)|eu gosto de (?:jogar|minecraft|anime|desenhar|programar)|eu curto (?:jogar|minecraft|anime|desenhar|programar))(?:\s|$)/i;
  if(!allowed.test(message))return null;
  const key=/^meu jogo/i.test(message)?'jogo':/^minha cor/i.test(message)?'cor':/^meu hobby/i.test(message)?'hobby':/^meu anime/i.test(message)?'anime':'interesse';
  return {kind:'self',key,value:message.slice(0,140)};
}
