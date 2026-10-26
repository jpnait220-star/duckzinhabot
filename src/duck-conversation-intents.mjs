// Small, predictable interpretation of Brazilian Portuguese chat requests.
// Only act on the specific intent when there is enough information to avoid
// misdirected pings. This is not an external DM or a claim about someone's account.
export function tiktokRelayRequest(input,{botId='',mentionedIds=[]}={}){
 const original=String(input||'');
 const plain=original.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .replace(/<@!?[0-9]+>/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
 const relay=/\b(?:fala|fale|pergunta|pergunte|perguntar|diz|diga|manda|mande)\s+(?:pro|pra|para|ao|a|pros|pras|aos)\b/.test(plain);
 const platform=/\b(?:tik\s*tok|tiktok)\b/.test(plain);
 const asksAccount=/\b(?:tem|usa|possui|conta)\b/.test(plain);
 if(!relay||!platform||!asksAccount)return null;
 const recipients=[...new Set(mentionedIds.map(String).filter(id=>/^[0-9]{15,25}$/.test(id)&&id!==String(botId)))];
 if(recipients.length===1){
   return {kind:'ask',userId:recipients[0],
     text:'Ei <@'+recipients[0]+'>, você tem TikTok? 🦆'};
 }
 return {kind:'clarify',
   text:recipients.length>1
     ?'Você quer que eu pergunte para qual dessas pessoas se ela tem TikTok? 💛'
     :'Quer que eu pergunte se a pessoa tem TikTok? Me marca quem é! 💛'};
}
