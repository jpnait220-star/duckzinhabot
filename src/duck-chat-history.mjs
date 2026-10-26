// Conversation cache + sequential persistence for each Discord member.
// Does not collect arbitrary public chat messages; it only stores exchanges
// explicitly directed to Duckzinha. The adapter manages database TTL/privacy.
export const HISTORY_WINDOW=20; // 10 recent question/answer exchanges
export const HISTORY_CACHE_MS=6*60*60_000;

export class DuckChatHistory {
 constructor({load=async()=>[],save=async()=>{},now=Date.now,
  limit=HISTORY_WINDOW,cacheMs=HISTORY_CACHE_MS,onError=()=>{}}={}){
  this.load=load;this.save=save;this.now=now;this.limit=limit;
  this.cacheMs=cacheMs;this.onError=onError;
  this.cache=new Map();
  this.loading=new Map();
  this.pending=new Map();
 }
 async get(id){
  const userId=String(id);
  const cached=this.cache.get(userId);
  if(cached&&this.now()-cached.updated<this.cacheMs)
   return cached.items.slice();
  if(this.loading.has(userId))return (await this.loading.get(userId)).slice();
  const loading=(async()=>{
   try{
    const data=await this.load(userId);
    // A concurrent append wins over this older database read.
    const current=this.cache.get(userId);
    if(current&&current!==cached)return current.items.slice();
    const items=Array.isArray(data)?data.slice(-this.limit):[];
    this.cache.set(userId,{items,updated:this.now()});
    return items.slice();
   }catch(error){
    this.onError('load',userId,error);
    // Never replace a good cache with empty history just because Supabase
    // timed out. Also don't cache a failure as [] for the next 45 minutes.
    return cached?.items.slice()||[];
   }
  })();
  this.loading.set(userId,loading);
  try{return await loading;}
  finally{if(this.loading.get(userId)===loading)this.loading.delete(userId);}
 }
 async append(id,question,answer){
  const userId=String(id);
  const history=await this.get(userId);
  const items=[...history,
   {role:'user',content:String(question||'').slice(0,800)},
   {role:'assistant',content:String(answer||'').slice(0,850)}
  ].slice(-this.limit);
  this.cache.set(userId,{items,updated:this.now()});
  // Writing one member's updates in order prevents a late write from
  // overwriting the latest turn. Keep RAM intact on database errors.
  const last=this.pending.get(userId)||Promise.resolve();
  const task=last.catch(()=>{}).then(()=>this.save(userId,items.slice()));
  this.pending.set(userId,task);
  try{await task;}catch(error){this.onError('save',userId,error);}
  finally{if(this.pending.get(userId)===task)this.pending.delete(userId);}
  return items.slice();
 }
 clear(id){
  if(id!=null){const userId=String(id);this.cache.delete(userId);this.loading.delete(userId);}
  else{this.cache.clear();this.loading.clear();}
 }
 prune(){
  const threshold=this.now()-this.cacheMs;
  for(const [id,record] of this.cache)if(record.updated<threshold)this.cache.delete(id);
 }
}
