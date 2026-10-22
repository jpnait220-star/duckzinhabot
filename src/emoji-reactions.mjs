// Reagir em mensagens originais usando emojis personalizados pertencentes ao servidor.
export const REACTION_KINDS=['ola','riso','fofo','gg','surpresa'];
const aliases={
  ola:['ola','oi','saudacao','acenando'],
  riso:['riso','risada','rindo'],
  fofo:['fofo','fofura','fofinha'],
  gg:['gg','vitoria'],
  surpresa:['surpresa','surpreso']
};
export function customEmojiEnv(kind){
  return REACTION_KINDS.includes(kind)?'DUCK_EMOJI_'+kind.toUpperCase():null;
}
export function customEmojiId(value){
  const raw=String(value||'').trim();
  if(/^\d{17,22}$/.test(raw))return raw;
  const match=raw.match(/^<a?:[A-Za-z0-9_]{2,32}:(\d{17,22})>$/);
  return match?.[1]||null;
}
export function emojiNames(kind){
  if(!REACTION_KINDS.includes(kind))return [];
  return aliases[kind].flatMap(name=>['duckzinha_'+name,'duck_'+name,name]);
}
export function findCustomEmoji(emojis,kind){
  const names=new Set(emojiNames(kind));
  const all=Array.isArray(emojis)?emojis:typeof emojis?.values==='function'?[...emojis.values()]:[];
  return all.find(x=>x?.available!==false&&names.has(String(x?.name||'').toLowerCase().trim()))||null;
}
