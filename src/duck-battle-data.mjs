// Sistema original de RPG da Duckzinha: movimentos e tipos próprios, sem apostas.
export const TYPES=Object.freeze({
 normal:{name:'Normal',emoji:'🦆',strong:[]},
 agua:{name:'Água',emoji:'🌊',strong:['fogo']},
 fogo:{name:'Fogo',emoji:'🔥',strong:['natureza','gelo']},
 natureza:{name:'Natureza',emoji:'🌿',strong:['agua']},
 eletrico:{name:'Elétrico',emoji:'⚡',strong:['agua']},
 gelo:{name:'Gelo',emoji:'❄️',strong:['natureza','eletrico']}
});
export const MOVES=Object.freeze({
 bicada:{name:'Bicada Relâmpago',type:'normal',power:11,emoji:'🦆'},
 asas_rapidas:{name:'Asas Velozes',type:'normal',power:9,emoji:'💨',quick:true},
 guarda:{name:'Escudo de Penas',type:'normal',power:0,emoji:'🛡️',guard:true},
 jato:{name:'Jato de Água',type:'agua',power:13,emoji:'💦'},
 faisca:{name:'Faísca',type:'eletrico',power:13,emoji:'⚡'},
 brasa:{name:'Bico Flamejante',type:'fogo',power:13,emoji:'🔥'},
 vinhas:{name:'Vinhas Mágicas',type:'natureza',power:13,emoji:'🌿'},
 neve:{name:'Floco Cortante',type:'gelo',power:13,emoji:'❄️'},
 quack:{name:'Quack Sônico',type:'normal',power:13,emoji:'🎵'},
 tsunami:{name:'Onda Gigante',type:'agua',power:21,emoji:'🌊'},
 furia:{name:'Fúria Solar',type:'fogo',power:21,emoji:'☀️'},
 trovão:{name:'Trovão Patônico',type:'eletrico',power:21,emoji:'⛈️'},
 floresta:{name:'Abraço da Floresta',type:'natureza',power:21,emoji:'🍃'},
 nevasca:{name:'Nevasca de Penas',type:'gelo',power:21,emoji:'🌨️'},
 cometa:{name:'Cometa de Borracha',type:'normal',power:20,emoji:'☄️'}
});
export const TM_ITEMS=Object.freeze({
 tm_agua:'tsunami',tm_fogo:'furia',tm_eletrico:'trovão',
 tm_natureza:'floresta',tm_gelo:'nevasca',tm_normal:'cometa'
});
export const SHOP=Object.freeze({
 racao:{name:'Ração Estelar',cost:18,desc:'+50 XP',kind:'xp',xp:50},
 super_racao:{name:'Super Ração',cost:45,desc:'+140 XP',kind:'xp',xp:140},
 essencia:{name:'Essência Elemental',cost:70,desc:'Mudar o tipo do seu pato',kind:'type'},
 tm_agua:{name:'TM • Onda Gigante',cost:75,desc:'Golpe especial de Água',kind:'tm',move:'tsunami'},
 tm_fogo:{name:'TM • Fúria Solar',cost:75,desc:'Golpe especial de Fogo',kind:'tm',move:'furia'},
 tm_eletrico:{name:'TM • Trovão Patônico',cost:75,desc:'Golpe especial Elétrico',kind:'tm',move:'trovão'},
 tm_natureza:{name:'TM • Abraço da Floresta',cost:75,desc:'Golpe especial de Natureza',kind:'tm',move:'floresta'},
 tm_gelo:{name:'TM • Nevasca de Penas',cost:75,desc:'Golpe especial de Gelo',kind:'tm',move:'nevasca'},
 tm_normal:{name:'TM • Cometa de Borracha',cost:70,desc:'Golpe especial Normal',kind:'tm',move:'cometa'}
});
export const MAX_LEVEL=30;
export const defaultMove=type=>({agua:'jato',fogo:'brasa',natureza:'vinhas',eletrico:'faisca',gelo:'neve',normal:'quack'})[type]||'quack';
export function defaultMoves(type){return ['bicada','asas_rapidas',defaultMove(type)];}
export function normalizedPet(row){
 const type=TYPES[row?.duck_type]?row.duck_type:'normal';
 const level=Math.max(1,Math.min(MAX_LEVEL,Number(row?.level)||1));
 const moves=Array.isArray(row?.moves)?row.moves.filter(x=>MOVES[x]).slice(0,3):[];
 return {type,level,xp:Math.max(0,Number(row?.xp)||0),
   chosen:row?.type_chosen===true,moves:moves.length===3?moves:defaultMoves(type)};
}
export function xpNeeded(level){return 30+level*10;}
export function levelUp(pet,amount){
 const r={...pet},xp=Math.max(0,Math.min(5000,Number(amount)||0));
 r.xp+=xp;
 while(r.level<MAX_LEVEL&&r.xp>=xpNeeded(r.level)){r.xp-=xpNeeded(r.level);r.level++;}
 if(r.level===MAX_LEVEL)r.xp=0;
 return r;
}
export function maxHP(level){return 58+Math.min(MAX_LEVEL,Math.max(1,level))*6;}
export function effectiveness(attack,defense){
 if(attack==='normal'||defense==='normal')return 1;
 if(TYPES[attack]?.strong.includes(defense))return 1.5;
 if(TYPES[defense]?.strong.includes(attack))return 0.75;
 return 1;
}
export function calculateHit(attacker,defender,moveId,{guard=false,random=Math.random}={}){
 const move=MOVES[moveId];
 if(!move)throw Error('Golpe inválido');
 if(move.guard)return {damage:0,guard:true,effect:1,critical:false};
 const element=effectiveness(move.type,defender.type);
 const matching=move.type===attacker.type?1.15:1;
 const critical=Number(random())<0.075;
 const damage=Math.max(2,Math.round(
   (5+move.power*.65+attacker.level*.63)*element*matching*
   (guard?.55:1)*(critical?1.4:1)
 ));
 return {damage,effect:element,critical,guard:false};
}
export function hpBar(hp,cap){
 const filled=Math.max(0,Math.min(10,Math.ceil(hp/Math.max(1,cap)*10)));
 return '🟩'.repeat(filled)+'⬛'.repeat(10-filled);
}
