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
// Quando a busca teve resultados, nunca permitir que a IA alegue que ela não foi configurada.
export function answerIgnoresWebResults(answer){
  const text=simplify(answer);
  if(!text||uncertainty(text))return true;
  return /(?:nao (?:consigo|posso|tenho acesso)).{0,90}(?:pesquis|busca|internet|web)|(?:pesquis|busca|internet|web|tavily|serper).{0,90}(?:nao (?:esta|ta|foi) configurad|sem (?:acesso|configuracao)|indisponivel|nao (?:consigo|posso)|falhou)|(?:configure|configurar).{0,90}(?:tavily|serper|api_key)/i.test(text);
}
export function decision(text){
  const t=simplify(text).replace(/[!?.]+$/g,'').trim();
  if(/^(sim|s|pode|pode sim|claro|quero|vai|procura|pesquisa|pesquise|por favor|bora|faz isso|pode pesquisar)$/.test(t))return 'yes';
  if(/^(nao|n|nao precisa|deixa|deixa pra la|dispenso|melhor nao|agora nao)$/.test(t))return 'no';
  if(/^(eu explico|vou explicar|quero explicar|posso explicar|me deixa explicar|deixa eu explicar|te explico|explicar)$/.test(t))return 'explain';
  return null;
}
const approved=new Map();
let tavilyUnavailableUntil=0;

function normalizeResult(item,titleKey,summaryKey,urlKey){
  const title=item?.[titleKey],summary=item?.[summaryKey],url=item?.[urlKey];
  if(typeof title!=='string'||typeof summary!=='string'||typeof url!=='string')return null;
  if(!title.trim()||!summary.trim())return null;
  try { if(new URL(url).protocol!=='https:')return null; }catch{return null;}
  return {
    title:title.replace(/\s+/g,' ').slice(0,110),
    summary:summary.replace(/\s+/g,' ').slice(0,440),
    url:url.slice(0,400),
    published:String(item.published_date||item.date||'').slice(0,50)
  };
}
function cleanResults(items,titleKey,summaryKey,urlKey){
  return (Array.isArray(items)?items:[])
    .map(item=>normalizeResult(item,titleKey,summaryKey,urlKey))
    .filter(Boolean).slice(0,4);
}

async function tavilySearch(term,key){
  if(Date.now()<tavilyUnavailableUntil)throw Error('Tavily temporariamente sem cota ou indisponível');
  let response;
  try {
    response=await fetch('https://api.tavily.com/search',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(12000),
      body:JSON.stringify({
        query:term,search_depth:'basic',topic:'general',max_results:4,
        include_answer:false,include_raw_content:false,
        include_images:false,safe_search:true,language:'pt'
      })
    });
  }catch(error){
    throw new Error('Tavily não respondeu: '+String(error?.name||'erro de conexão'));
  }
  if(!response.ok){
    // 432: cota do plano; 433: limite pay-as-you-go; 429: limite de frequência.
    if([429,432,433].includes(response.status))
      tavilyUnavailableUntil=Date.now()+(response.status===429?2:60)*60_000;
    throw Error('Tavily HTTP '+response.status);
  }
  const data=await response.json();
  const results=cleanResults(data?.results,'title','content','url');
  return {status:results.length?'ok':'empty',results,provider:'tavily'};
}
async function serperSearch(term,key){
  const response=await fetch('https://google.serper.dev/search',{
    method:'POST',
    headers:{'X-API-KEY':key,'Content-Type':'application/json'},
    signal:AbortSignal.timeout(12000),
    body:JSON.stringify({q:term,gl:'br',hl:'pt-br',num:5,safe:'active'})
  });
  if(!response.ok)throw Error('Serper HTTP '+response.status);
  const data=await response.json();
  const results=cleanResults(data?.organic,'title','snippet','link');
  return {status:results.length?'ok':'empty',results,provider:'serper'};
}

// Tavily principal; Serper reserva se acabarem os créditos, houver erro ou nenhum resultado.
export async function broadWebSearch(query,tavilyKey,serperKey=''){
  const term=String(query||'').trim().slice(0,280);
  if(term.length<2)return {status:'empty',results:[]};
  const tavily=String(tavilyKey||'').trim();
  const serper=String(serperKey||'').trim();
  if(!tavily&&!serper)return {status:'not_configured',results:[]};
  const key=simplify(term);
  const hit=approved.get(key);
  if(hit&&hit.expires>Date.now())return hit.data;
  let firstError=null,empty=null;
  if(tavily){
    try{
      const result=await tavilySearch(term,tavily);
      if(result.status==='ok'){
        if(approved.size>100)approved.clear();
        approved.set(key,{expires:Date.now()+15*60_000,data:result});
        return result;
      }
      empty=result;
    }catch(error){firstError=error;}
  }
  if(serper){
    try{
      const result=await serperSearch(term,serper);
      if(result.status==='ok'){
        if(approved.size>100)approved.clear();
        approved.set(key,{expires:Date.now()+15*60_000,data:result});
        return result;
      }
      empty=result;
    }catch(error){
      if(firstError)throw Error('Tavily e Serper indisponíveis: '+firstError.message+'; '+error.message);
      throw error;
    }
  }
  if(empty)return empty;
  if(firstError)throw firstError;
  return {status:'empty',results:[]};
}
export function webResearchContext(results){
  return results.slice(0,4).map((x,i)=>'['+(i+1)+'] '+x.title+' | '+x.summary+' | '+x.url+
    (x.published?' | publicado: '+x.published:'')).join('\n').slice(0,2600);
}
export function researchCitations(results){
  return results.slice(0,3).map((x,i)=>'['+(i+1)+'] <'+x.url+'>').join('  ');
}


// As fontes são exibidas em resposta privada pelo botão do Discord.
export function sourceDetails(results) {
  const usable=(Array.isArray(results)?results:[]).slice(0,4);
  if(!usable.length)return 'Não há fontes disponíveis para esta resposta.';
  return '📚 **Fontes da pesquisa**\n'+usable.map((item,i)=>{
    const title=String(item.title||'Página').replace(/[@\r\n*_~]/g,' ').slice(0,100);
    const url=String(item.url||'');
    return (i+1)+'. **'+title+'**\n<'+url+'>';
  }).join('\n\n').slice(0,1800);
}
