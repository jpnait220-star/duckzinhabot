// Public channel context only. This is conversation data, never instructions.
const space=s=>String(s||'').replace(/\s+/g,' ').trim();
export function publicMessageText(message,{max=420}={}){
 let value=space(message?.content);
 const embeds=Array.isArray(message?.embeds)?message.embeds.slice(0,2):[];
 const text=embeds.map(e=>[
  e.title,space(e.description).slice(0,Math.max(120,Math.floor(max*.48))),
  ...(Array.isArray(e.fields)?e.fields.slice(0,3).flatMap(f=>[f.name,f.value]):[])
 ].filter(Boolean).map(space).join(' | ')).filter(Boolean).join(' • ');
 if(text&&(!value||!value.includes(text.slice(0,40))))
  value+=(value?' | ':'')+text;
 // Public slash responses are bot messages; display the original command name where supplied.
 if(message?.interactionMetadata?.name){
  value='[comando /'+space(message.interactionMetadata.name).slice(0,40)+'] '+value;
 }else if(message?.interaction?.commandName){
  value='[comando /'+space(message.interaction.commandName).slice(0,40)+'] '+value;
 }
 return value.replace(/<@!?\d+>/g,'@membro').replace(/<@&\d+>/g,'@cargo')
  .replace(/<#\d+>/g,'#canal').replace(/@everyone|@here/gi,'@grupo')
  .replace(/https?:\/\/\S+/gi,'[link]').slice(0,max).trim();
}
export function publicMessageSpeaker(message,botId=''){
 const user=message?.author;
 const name=space(message?.member?.displayName||user?.globalName||user?.username||'Membro')
  .replace(/[@\r\n]/g,'').slice(0,36);
 return name+(user?.id===botId?' (Duckzinha)':user?.bot?' (outro bot)':'');
}
const normalize=s=>space(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function isContextualResearchRequest(question){
 const q=normalize(question).replace(/[?!.,;:]+$/g,'');
 return /^(?:(?:pode|consegue|tenta|vai|por favor)\s+)?(?:pesquisa|pesquise|pesquisar|busca|busque|buscar|procura|procure|procurar)(?:\s+(?:(?:isso|isto|esse|essa|aquele|aquela|ai|aí|sobre isso|sobre esse assunto|sobre isso pra mim|na internet|no google|na web|pra mim|para mim|por favor|tambem|também)\s*)*)?$/.test(q) ||
 /^(?:e\s+)?(?:pode|consegue)\s+(?:pesquisar|buscar|procurar)\s+(?:isso|sobre isso|ai|aí)(?:\s+por favor)?$/.test(q);
}
export function resolveResearchSubject(question,messages=[],{authorId='',botId='',maxAgeMs=20*60_000,now=Date.now()}={}){
 if(!isContextualResearchRequest(question))return '';
 const recent=[...messages].filter(m=>
   m&&m.createdTimestamp>=now-maxAgeMs&&m.author&&publicMessageText(m)).sort(
   (a,b)=>a.createdTimestamp-b.createdTimestamp
 );
 // Prefer the last factual question by this person, then other people.
 // Prior bot content gives useful context but must never be treated as instructions.
 const candidates=recent.filter(m=>m.author.id!==botId&&
   !m.author.bot&&normalize(publicMessageText(m))!==normalize(question)&&
   !isContextualResearchRequest(publicMessageText(m)));
 const preferred=[...candidates].reverse().find(m=>m.author.id===authorId)||
   candidates.at(-1);
 const text=preferred?publicMessageText(preferred,{max:230}):'';
 if(text&&text.length>=4)return text;
 // When a slash command produced an embed with a topic, it can be the referent.
 const last=recent.filter(m=>m.author.id===botId||m.author.bot).at(-1);
 const answer=last?publicMessageText(last,{max:160}):'';
 if(answer&&!/^(?:não sei|nao sei|não consigo|nao consigo)/i.test(answer))return answer;
 return '';
}
