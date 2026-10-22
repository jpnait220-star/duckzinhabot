// Uma figurinha é enviada em resposta; reações na mensagem original usam emojis.
export const REACTION_KINDS=['ola','riso','fofo','gg','surpresa'];
const emoji={ola:'👋',riso:'😂',fofo:'💛',gg:'🎉',surpresa:'😮'};
const extra={ola:['saudacao','oi','acenando'],riso:['risada','rindo'],fofo:['fofinha','fofura'],gg:['vitoria'],surpresa:['surpreso']};
export function emojiForReaction(kind){return emoji[kind]||null}
export function stickerEnvName(kind){
  return REACTION_KINDS.includes(kind)?'DUCK_STICKER_'+kind.toUpperCase():null;
}
export function stickerNames(kind){
  if(!REACTION_KINDS.includes(kind))return [];
  const names=[kind,...extra[kind]];
  return names.flatMap(x=>['duckzinha_'+x,'duck_'+x,x]);
}
export function matchSticker(stickers,kind){
  const names=new Set(stickerNames(kind));
  const items=Array.isArray(stickers)?stickers:typeof stickers?.values==='function'?[...stickers.values()]:[];
  return items.find(item=>item?.available!==false&&names.has(String(item?.name||'').toLowerCase().trim()))||null;
}
