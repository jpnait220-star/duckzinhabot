// Pure helpers: avoid reading private channels or saving conversations here.
export function dynamicPersonality(question,{recent='',mood='auto'}={}){
  const text=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const context=String(recent||'').slice(-900);
  if(/\b(erro|bug|problema|triste|ajuda|preocupad|serio|luto|doente)\b/.test(text))
    return 'RESPONDA COM ATENÇÃO: seja objetiva e acolhedora, sem piadas, provocações ou ironia. Dê passos claros e não invente soluções.';
  if(/\b(kkk+|haha+|meme|zoeira|brincadeira|engracad|gg+)\b/.test(text))
    return 'TOM BRINCALHÃO: use humor leve e uma tirada curta quando combinar. Nunca insulte, humilhe ou faça brincadeira repetitiva.';
  if(/\b(como|porque|qual|explica|duvida|ensina)\b/.test(text))
    return 'TOM CURIOSO: explique com exemplos simples e específicos. Evite respostas genéricas ou repetir o começo da frase.';
  const publicContext=context&&/minecraft|duckcapture|duckmodels|projeto|quiz/i.test(context)
    ?' Reconheça o assunto anterior apenas quando for claramente relevante; não finja lembrar de algo ausente.':'';
  return 'Converse de modo natural, simpático e variado; varie a abertura e os emojis, sem repetir bordões. Humor deve combinar com a conversa. Tom escolhido: '+mood+'.'+publicContext;
}
export function voiceTone(text){
  const s=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/\b(erro|triste|sinto muito|perdi|desculpa|problema|ajuda|medo)\b/.test(s))return 'calma';
  if(/[!]{2,}|\b(gg|parabens|incrivel|consegui|ganhei|vitoria|uhu|oba|kkk)\b/.test(s))return 'animada';
  if(/\?|\b(sera|como assim|voce sabia|por que)\b/.test(s))return 'curiosa';
  if(/\b(boa noite|soninho|dormir)\b/.test(s))return 'sonolenta';
  return 'auto';
}
export function expressiveSpeech(text){
  return String(text||'').replace(/https?:\/\/\S+/gi,'link no chat')
    .replace(/\s*[;:]\s*/g,', ').replace(/\s+/g,' ').trim().slice(0,330);
}
const THEMES=[
 ['Minecraft',/\b(minecraft|mine|pvp|creeper|survival|mod|shader|server)\b/i],
 ['Projetos e tecnologia',/\b(duckcapture|duckmodels|site|app|bot|github|program|codigo|projeto)\b/i],
 ['Jogos e entretenimento',/\b(jogo|anime|filme|serie|personagem|quiz|game)\b/i],
 ['Dúvidas e ajuda',/\b(como|ajuda|erro|problema|bug|duvida|consegue)\b/i],
 ['Comunidade',/\b(discord|canal|membro|servidor|evento|sugestao)\b/i]
];
export function summarizePublicMessages(messages,{now=Date.now()}={}){
  const unique=(messages||[]).filter(m=>m&&!m.author?.bot&&
    (m.createdTimestamp||0)>=now-24*3600000&&String(m.content||'').trim()&&
    !/(senha|token|chave\s*api|cart[aã]o|cpf|endereco|endere[cç]o)/i.test(m.content));
  if(unique.length<3)return '💬 Ainda não há mensagens públicas suficientes das últimas 24 horas neste canal para resumir.';
  const scores=THEMES.map(([name,re])=>({name,count:unique.filter(m=>re.test(m.content)).length}))
    .filter(x=>x.count>0).sort((a,b)=>b.count-a.count).slice(0,4);
  const people=new Set(unique.map(m=>m.author.id));
  const list=scores.length?scores.map(s=>'• **'+s.name+'** ('+s.count+' mensagens relacionadas)').join('\n')
    :'• Conversas gerais e assuntos variados.';
  return '## 💬 Resumo do chat (últimas 24h)\n'+
    '📊 **'+unique.length+'** mensagens analisadas • **'+people.size+'** participantes\n\n'+
    '**Assuntos mais comentados:**\n'+list+
    '\n\n*Resumo automático por temas, sem citar falas privadas ou inventar conclusões.*';
}
export function parseTimeSpan(value){
  const s=String(value||'').trim().toLowerCase();
  const m=/^(\d{1,4})\s*(m|min|minutos?|h|horas?|d|dias?)$/.exec(s);
  if(!m)return null;
  const amount=Number(m[1]),unit=m[2][0];
  const ms=amount*(unit==='m'?60000:unit==='h'?3600000:86400000);
  return ms>=60000&&ms<=30*86400000?ms:null;
}
// Bahia is UTC-03 year round; accepts 'amanhã às 15h' and relative durations.
export function parseNaturalReminder(text,now=Date.now()){
  const s=String(text||'').replace(/\s+/g,' ').trim();
  const relative=/^(?:me\s+)?lembr(?:a|e|ar)\s+(?:de\s+)?(.+?)\s+em\s+(\d{1,4})\s*(minutos?|min|m|horas?|h|dias?|d)$/i.exec(s);
  if(relative){
    const ms=parseTimeSpan(relative[2]+relative[3]);
    return ms?{text:relative[1].trim(),at:new Date(now+ms).toISOString()}:null;
  }
  const tomorrow=/^(?:me\s+)?lembr(?:a|e|ar)\s+(?:de\s+)?(.+?)\s+amanh[aã]\s+[aà]s?\s+(\d{1,2})(?:[:h](\d{2}))?h?$/iu.exec(s);
  if(!tomorrow)return null;
  const hour=Number(tomorrow[2]),minute=Number(tomorrow[3]||0);
  if(hour>23||minute>59)return null;
  const local=new Date(now-3*3600000);local.setUTCDate(local.getUTCDate()+1);
  local.setUTCHours(hour,minute,0,0);
  const instant=local.getTime()+3*3600000;
  return {text:tomorrow[1].trim(),at:new Date(instant).toISOString()};
}
