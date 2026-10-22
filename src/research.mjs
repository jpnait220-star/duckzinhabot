// Pesquisa enciclopédica gratuita. Não acessa links fornecidos por usuários.
const WIKIPEDIA_API='https://pt.wikipedia.org/w/api.php';
const CLIENT_AGENT='DuckzinhaDiscordBot/1.0 (https://duckzincommunity.vercel.app)';
const cache=new Map();
let lastRequest=0;
let inFlight=Promise.resolve();

function normalize(text){
  return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

export function researchTopic(message) {
  const plain=String(message||'').replace(/<@!?\d+>/g,' ').trim();
  const lower=normalize(plain);
  if(plain.length<4||plain.length>900)return null;
  // Pesquisa só perguntas factuais ou quando pedirem explicitamente.
  const patterns=[
    /\b(?:pesquise|pesquisa|pesquisar|procure|procurar|busque|buscar)\s+(?:na (?:internet|web)|sobre|por)?\s*(.+)/i,
    /\b(?:quem (?:e|foi|sao|eram)|o que (?:e|foi)|onde fica|onde nasceu|quando nasceu|quando morreu)\s+(.+)/i,
    /\b(?:voce (?:conhece|sabe quem e)|vc (?:conhece|sabe quem e)|me (?:fale|conte|explica|explique) (?:sobre|quem e))\s+(.+)/i
  ];
  for(const pattern of patterns){
    const found=lower.match(pattern);
    if(!found)continue;
    const end=found.index+found[0].length;
    const raw=plain.slice(end-found[1].length,end).replace(/[?!.,;:]+$/g,'').trim();
    const topic=raw.replace(/^o |^a |^os |^as /i,'').trim();
    if(topic.length>=2&&topic.length<=110){
      // Nome artístico escrito junto é frequente no Discord.
      return topic.replace(/\bneymar\s*jr\b/i,'Neymar Jr');
    }
  }
  return null;
}

async function lookup(term){
  const query=new URLSearchParams({
    action:'query',generator:'search',gsrsearch:term,gsrlimit:'3',
    prop:'extracts|info',inprop:'url',exintro:'1',explaintext:'1',
    exchars:'1400',format:'json',formatversion:'2',redirects:'1'
  });
  const response=await fetch(WIKIPEDIA_API+'?'+query,{
    signal:AbortSignal.timeout(6000),
    headers:{'User-Agent':CLIENT_AGENT,'Accept':'application/json'}
  });
  if(!response.ok)throw Error('Wikipédia HTTP '+response.status);
  const json=await response.json();
  const pages=(json?.query?.pages||[]).filter(page=>
    typeof page.title==='string'&&typeof page.extract==='string'&&page.extract.trim() &&
    !/desambigua/i.test(normalize(page.title)));
  pages.sort((a,b)=>(a.index||0)-(b.index||0));
  const page=pages[0];
  if(!page)return null;
  const url=page.fullurl&&page.fullurl.startsWith('https://pt.wikipedia.org/wiki/')
    ?page.fullurl
    :'https://pt.wikipedia.org/wiki/'+encodeURIComponent(page.title.replace(/ /g,'_'));
  return {title:page.title,summary:page.extract.replace(/\s+/g,' ').slice(0,1300),url};
}

export async function wikipediaResearch(message){
  const topic=researchTopic(message);
  if(!topic)return null;
  const key=normalize(topic);
  const cached=cache.get(key);
  if(cached&&cached.expires>Date.now())return cached.value;
  // Serializa buscas e conserva o serviço público sob carga.
  const lookupTask=inFlight.catch(()=>{}).then(async()=>{
    const delay=Math.max(0,2500-(Date.now()-lastRequest));
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    lastRequest=Date.now();
    return lookup(topic);
  });
  inFlight=lookupTask.catch(()=>{});
  const result=await lookupTask;
  if(cache.size>100)cache.clear();
  cache.set(key,{value:result,expires:Date.now()+(result?30:5)*60000});
  return result;
}
