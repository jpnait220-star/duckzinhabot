// Pesquisa pública via Tavily; requer TAVILY_API_KEY configurada na hospedagem.
// Usa apenas o endpoint fixo da Tavily, nunca faz fetch de URL dada pelo usuário.
export function simplify(text){
  return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
export function wantsWebResearch(message){
  return /\b(pesquis(?:a|e|ar)|procur(?:a|e|ar)|busc(?:a|ar|que)|na internet|no google|na web|vai a fundo)\b/i.test(simplify(message));
}
export function uncertainty(answer){
  const text=simplify(answer);
  return text.includes('[pesquisa_necessaria]') ||
    /\b(nao sei|nao conheco|nao tenho certeza|nao tenho informacoes|nao tenho dados|nao encontrei|nao consigo confirmar|nao posso afirmar|nao sei dizer)\b/i.test(text);
}
export function decision(text){
  const t=simplify(text).replace(/[!?.]+$/g,'').trim();
  if(/^(sim|s|pode|pode sim|claro|quero|vai|procura|pesquisa|pesquise|por favor|bora|faz isso|pode pesquisar)$/.test(t))return 'yes';
  if(/^(nao|n|nao precisa|deixa|deixa pra la|dispenso|melhor nao|agora nao)$/.test(t))return 'no';
  return null;
}
const approved=new Map();
export async function broadWebSearch(query,apiKey){
  if(!apiKey?.trim())return {status:'not_configured',results:[]};
  const term=String(query||'').trim().slice(0,280);
  if(term.length<2)return {status:'empty',results:[]};
  const key=simplify(term);
  const hit=approved.get(key);
  if(hit && hit.expires>Date.now())return hit.data;
  const response=await fetch('https://api.tavily.com/search',{
    method:'POST',
    headers:{'Authorization':'Bearer '+apiKey.trim(),'Content-Type':'application/json'},
    signal:AbortSignal.timeout(12000),
    body:JSON.stringify({
      query:term,search_depth:'basic',topic:'general',max_results:4,
      include_answer:false,include_raw_content:false,
      include_images:false,safe_search:true,language:'pt'
    })
  });
  if(!response.ok){
    throw new Error('Busca web indisponível (HTTP '+response.status+')');
  }
  const data=await response.json();
  const results=(Array.isArray(data.results)?data.results:[])
    .filter(item=>typeof item?.title==='string'&&typeof item?.content==='string'&&typeof item?.url==='string')
    .filter(item=>{
      try{return new URL(item.url).protocol==='https:';}catch{return false;}
    })
    .slice(0,4)
    .map(item=>({
      title:item.title.slice(0,110),
      summary:item.content.replace(/\s+/g,' ').slice(0,440),
      url:item.url.slice(0,400),
      published:typeof item.published_date==='string'?item.published_date.slice(0,50):''
    }));
  const output={status:results.length?'ok':'empty',results};
  if(approved.size>100)approved.clear();
  approved.set(key,{expires:Date.now()+15*60_000,data:output});
  return output;
}
export function webResearchContext(results){
  return results.slice(0,4).map((x,i)=>'['+(i+1)+'] '+x.title+' | '+x.summary+' | '+x.url+
    (x.published?' | publicado: '+x.published:'')).join('\n').slice(0,2600);
}
export function researchCitations(results){
  return results.slice(0,3).map((x,i)=>'['+(i+1)+'] <'+x.url+'>').join('  ');
}
