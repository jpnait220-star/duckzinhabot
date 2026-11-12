export const COMMUNITY_URL='https://duckcommunity.go.altare.global';
const LEGACY_HOST='duckzincommunity.vercel.app';

// Migrate the previous deployment URL even when it is still saved in the host's ENV.
export function resolveWebsiteUrl(value=process.env.WEBSITE_URL){
 try{
  const u=new URL(String(value||COMMUNITY_URL).trim());
  if(u.username||u.password)return COMMUNITY_URL;
  if(u.hostname===LEGACY_HOST){u.protocol='https:';u.host=new URL(COMMUNITY_URL).host;}
  if(u.protocol!=='https:')return COMMUNITY_URL;
  return u.href.replace(/\/$/,'');
 }catch{return COMMUNITY_URL;}
}

// Keep the existing restriction to the community site; migrate stale AI/memory links.
export function communityWebsiteLink(value){
 try{
  const u=new URL(value);
  if(u.username||u.password)return null;
  if(u.hostname===LEGACY_HOST){u.protocol='https:';u.host=new URL(COMMUNITY_URL).host;}
  const allowed=new Set([new URL(COMMUNITY_URL).origin,new URL(resolveWebsiteUrl()).origin]);
  return u.protocol==='https:'&&allowed.has(u.origin)?u.href:null;
 }catch{return null;}
}
