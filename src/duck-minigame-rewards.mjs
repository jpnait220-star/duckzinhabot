export const MINIGAME_REWARD=5;
export async function awardMinigameWin(store,userId,eventId){
 if(!store?.persistent||typeof store.rewardMinigame!=='function')
   return {ok:false,credited:false,reason:'database'};
 try{
  const result=await store.rewardMinigame(userId,eventId);
  return result&&typeof result==='object'?result:
    {ok:false,credited:false,reason:'invalid-result'};
 }catch(error){
  console.warn('[Duckzinha] Moedas do minigame: '+String(error?.message||error));
  return {ok:false,credited:false,reason:'error'};
 }
}
export const winRewardLabel='🎁 **+5 moedas de pato!**';
