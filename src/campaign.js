// Story state uses Korean keys so the same vocabulary reaches the operator's sheet.
export const SCENES={nest:'작은 숲 개미굴',outside:'햇살 정원',prison:'경비 감옥',depths:'잊힌 지하',moss:'이끼 군락',reed:'갈대 군락',throne:'닫힌 왕실',frontier:'바람의 변경'};
const bounded=(value,max=99999)=>Math.min(max,Math.max(0,Number.isFinite(Number(value))?Number(value):0));
const names=(value,allowed)=>Array.isArray(value)?[...new Set(value.filter(x=>typeof x==='string'&&(!allowed||allowed.includes(x))).map(x=>x.slice(0,60)))].slice(0,40):[];
export function normalizeCampaign(raw,legacy={}){
 const c=raw&&typeof raw==='object'?raw:{};
 const result={'단계':Math.floor(bounded(c.단계,24)),'진행':Math.floor(bounded(c.진행,99)),'동맹':names(c.동맹,['돌개','초롱','모래']),'감옥':['일반','이야기'].includes(c.감옥)?c.감옥:'없음','형기':bounded(c.형기,3600),'침입':Math.floor(bounded(c.침입,3)),'균열':Math.floor(bounded(c.균열,5)),'암호순서':Math.floor(bounded(c.암호순서,5)),'강화':{},'통행증':names(c.통행증,['이끼','갈대']),'개통':c.개통===true,'수색':names(c.수색),'왕실체력':c.왕실체력==null?100:bounded(c.왕실체력,100),'원정':Math.floor(bounded(c.원정)),'모션':['인사','위엄','기쁨','격려'].includes(c.모션)?c.모션:'없음','집결':c.집결===true,'긴급':null};
 for(const key of ['이동','작업','운반'])result.강화[key]=Math.floor(bounded(c.강화?.[key],3));
 if(['천적','비'].includes(c.긴급?.종류))result.긴급={'종류':c.긴급.종류,'남은초':bounded(c.긴급.남은초,300),'진척':bounded(c.긴급.진척,12),'지시':c.긴급.지시===true,'실패':c.긴급.실패===true};
 if(legacy.cleared)result.단계=24;
 if(!raw&&legacy.dug>=5)result.개통=true;
 return result;
}

// Each step names a real world object, not a remote quest-complete button.
export const STORY=[null,
 {title:'바람이 새는 벽',scene:'prison',target:'균열',type:'inspect',count:1,description:'감옥 벽에서 바람이 새는 균열을 살펴보세요.',line:'벽 저편에서 차가운 바람이 분다. 긁힌 자국은 안쪽이 아니라 바깥쪽으로 이어져 있다.'},
 {title:'먼저 떠난 누군가',scene:'prison',target:'균열',type:'dig',count:3,description:'균열을 세 번 파서 오래된 비밀 통로를 여세요.',line:'조금만 더. 누구도 발견하지 못한 길이 우리를 기다린다.'},
 {title:'아래로 향하는 첫걸음',scene:'depths',target:'depths',type:'enter',count:1,description:'열린 비밀문으로 들어가 잊힌 지하에 도착하세요.'},
 {title:'추방된 굴착가',scene:'depths',target:'돌개',type:'talk',count:1,description:'지하의 돌개에게 사정을 이야기하세요.',line:'왕관을 원했다고 갇혔다고? 나도 모두를 위한 길을 팠다는 이유로 여기 왔어. 먼저 물에 잠긴 친구들을 도와줘.'},
 {title:'지워진 이름들',scene:'depths',target:'낡은기록',type:'inspect',count:1,description:'버려진 기록에서 추방된 개미들의 이름을 찾으세요.',line:'명단에는 도둑이 아니라 식량 배분을 요구했던 개미들의 이름이 적혀 있다. 은빛의 도장이 선명하다.'},
 {title:'흐르는 물은 막을 수 없어',scene:'depths',target:'물길',type:'repair',count:5,description:'물길을 다섯 번 정비해 지하 쉼터를 구하세요.',line:'돌을 옮기자 물이 갈라진다. 물 아래 감춰졌던 발자국도 드러난다.'},
 {title:'어둠 속 여섯 불빛',scene:'depths',target:'빛버섯',type:'gather',count:6,description:'빛버섯에서 등불 포자 여섯 개를 채집하세요.',line:'먹는 버섯은 아니야. 포자를 굴 천장에 붙이면 뒤따르는 친구들도 길을 볼 수 있어.'},
 {title:'기억해야 할 다섯 약속',scene:'depths',target:'메아리',type:'talk',count:1,description:'메아리가 알려 주는 다섯 암호를 기억하세요.',line:'문의 암호는 뿌리, 이슬, 함께, 새벽, 자유. 순서대로야. 헷갈리면 언제든 다시 물어봐. 오래전 처음 이 길을 판 친구의 약속이지.'},
 {title:'닫힌 문이 묻는 것',scene:'depths',target:'길막힌문',type:'quiz',count:1,description:'메아리의 암호를 기억해 세 선택지 중 정답을 다섯 번 연속 고르세요.',line:'오래된 문이 다섯 개의 약속을 묻는다.'},
 {title:'첫 번째 동맹',scene:'depths',target:'돌개',type:'talk',count:1,ally:'돌개',description:'돌개에게 돌아가 함께할 것을 약속하세요.',line:'네가 물길을 돌리고 등불을 켜는 걸 봤어. 왕관만 탐하는 개미는 아니구나. 내 굴착조가 너와 함께할게.'},
 {title:'뿌리 너머의 바깥',scene:'depths',target:'녹슨문',type:'dig',count:4,description:'녹슨 문 주변의 뿌리를 네 번 걷어내 바깥으로 나가세요.',line:'흙 사이로 햇살 냄새가 들어온다. 돌개가 말한 이끼 군락은 정원 서쪽에 있다.'},
 {title:'이끼 아래의 이웃',scene:'moss',target:'moss',type:'enter',count:1,description:'정원 서쪽의 이끼 군락으로 들어가세요.'},
 {title:'물 한 방울의 신뢰',scene:'moss',target:'초롱',type:'talk',count:1,description:'이끼 군락의 초롱에게 도움을 제안하세요.',line:'은빛은 우리에게 물을 나눠 주겠다고 약속했어. 하지만 문은 닫혔고 아이들은 목말라. 네 약속은 다를까?'},
 {title:'말보다 먼저 내미는 것',scene:'moss',target:'초롱',type:'deliver',item:'dew',count:5,description:'정원에서 이슬 다섯 방울을 모아 초롱에게 전달하세요.',line:'아주 작은 그릇인데도 모두에게 한 모금씩 돌아갔어. 고마워.'},
 {title:'함께 고치는 둑',scene:'moss',target:'물길',type:'repair',count:4,description:'이끼 군락의 물길을 네 번 정비하세요.',line:'이 둑은 우리 모두의 손으로 세우는 거야.'},
 {title:'초록 깃발의 약속',scene:'moss',target:'초롱',type:'talk',count:1,ally:'초롱',description:'초롱에게 동맹의 뜻을 전하세요.',line:'다음에는 우리가 너에게 손을 내밀 차례야. 이끼 군락의 정찰병을 보내겠어. 동쪽 갈대 군락에도 같은 이야기를 들려줘.'},
 {title:'바람을 버티는 군락',scene:'reed',target:'reed',type:'enter',count:1,description:'정원 동쪽의 갈대 군락으로 들어가세요.'},
 {title:'경비대장의 시험',scene:'reed',target:'모래',type:'talk',count:1,description:'갈대 군락의 경비대장 모래와 이야기하세요.',line:'문을 부수는 힘보다 열린 문을 지키는 힘이 필요해. 식량을 나누고 우리 경비와 함께 훈련해 보겠어?'},
 {title:'같은 식탁',scene:'reed',target:'모래',type:'deliver',item:'crumb',count:3,description:'동료와 과자 부스러기 세 개를 모아 모래에게 전달하세요.',line:'네 친구들이 함께 들어 줬구나. 등을 맡길 동료가 있다는 건 큰 힘이지.'},
 {title:'서로의 등을 지키기',scene:'reed',target:'수문장',type:'defend',count:4,description:'갈대 군락 수문장과 네 번 방어 대형을 맞추세요.',line:'앞에 선 개미가 물러나면 뒤의 개미가 빈자리를 채운다. 누구도 혼자 서지 않는다.'},
 {title:'세 번째 깃발',scene:'reed',target:'모래',type:'talk',count:1,ally:'모래',description:'모래와 동맹을 맺고 지하의 비밀 승강기로 돌아가세요.',line:'갈대 경비대가 함께하겠다. 돌개의 승강기는 왕실 바로 아래로 이어져. 이번에는 우리도 너를 따라갈게.'},
 {title:'모두가 여는 문',scene:'depths',target:'비밀승강기',type:'repair',count:3,description:'세 동맹과 비밀 승강기를 세 번 수리하세요. 공헌도 3,200이 필요합니다.',line:'돌개가 벽을 지탱하고 초롱이 등불을 든다. 모래가 뒤를 지킨다. 문 너머에서 은빛의 목소리가 들린다.'},
 {title:'왕관보다 무거운 약속',scene:'throne',target:'은빛전투',type:'boss',count:1,description:'붉게 표시된 바닥을 피해 은빛을 제압하세요. 동맹들이 함께 싸웁니다.',line:'은빛: 내가 문을 닫았기에 군락이 안전했던 거야! 너희가 그 문을 연 책임을 질 수 있겠느냐?'},
];
export const PASSWORD=['뿌리','이슬','함께','새벽','자유'];
export const PASSWORD_OPTIONS=[['왕관','뿌리','씨앗'],['이슬','돌멩이','뿔'],['혼자','먼저','함께'],['노을','새벽','한낮'],['자유','복종','침묵']];
export function storyQuest(state){return STORY[state.campaign.단계]||null;}
export function chapter(state){
 const n=state.campaign.단계;
 if(state.cleared)return {number:7,title:'열린 문 너머의 왕국'};
 if(n>=12)return {number:6,title:'세 군락의 약속'};
 if(n>0)return {number:5,title:'왕관 아래의 그림자'};
 const i=Math.min(3,Math.floor(state.questIndex/8));
 return {number:i+1,title:['작은 숲의 새 식구','닫힌 문과 낡은 기록','우리보다 큰 세상','축제 전날의 침묵'][i]};
}
export function startBetrayal(state){
 if(state.questIndex!==29||state.cleared||state.campaign.단계>0)return false;
 Object.assign(state.campaign,{'단계':1,'진행':0,'감옥':'이야기','균열':0,'긴급':null});return true;
}
export function advanceStory(state,type,target,amount=1){
 const q=storyQuest(state);if(!q||q.type!==type||q.target!==target||state.world.scene!==q.scene||!Number.isFinite(amount)||amount<1)return false;
 if(q.target==='비밀승강기'&&(state.campaign.동맹.length<3||state.xp<3200))return false;
 state.campaign.진행=Math.min(q.count,state.campaign.진행+Math.floor(amount));
 if(q.target==='균열'&&q.type==='dig')state.campaign.균열=state.campaign.진행;
 if(state.campaign.진행<q.count)return true;
 state.xp+=q.ally?120:45;state.inventory.seed+=q.ally?8:2;
 if(q.ally&&!state.campaign.동맹.includes(q.ally))state.campaign.동맹.push(q.ally);
 if(!state.campaign.수색.includes(q.title))state.campaign.수색.push(q.title);
 state.campaign.단계++;state.campaign.진행=0;
 if(state.campaign.단계>=4)state.campaign.감옥='없음';
 return true;
}
export function answerPassword(state,index){
 if(state.campaign.단계!==9)return {ok:false};
 const c=state.campaign,step=c.암호순서;
 if(PASSWORD_OPTIONS[step]?.[index]!==PASSWORD[step]){c.암호순서=0;return {ok:false};}
 c.암호순서++;
 if(c.암호순서===5){advanceStory(state,'quiz','길막힌문');return {ok:true,complete:true};}
 return {ok:true,complete:false};
}
export function accessRegion(state,scene){
 const c=state.campaign;
 if(c.감옥==='일반')return '먼저 간수에게 석방을 요청하세요.';
 if(c.감옥==='이야기'&&scene!=='depths')return '감옥의 균열을 찾아야 해요.';
 if(scene==='depths'&&c.단계<3&&!state.cleared)return '감춰진 지하 입구예요. 아직 열리지 않았어요.';
 if(scene==='outside'&&state.world.scene==='depths'&&c.단계<12)return '녹슨 문을 열어야 바깥으로 나갈 수 있어요.';
 if(scene==='throne'&&(c.단계<23||c.동맹.length<3)&&!state.cleared)return '세 동맹과 승강기를 수리해야 왕실 문이 열려요.';
 if(scene==='nest'&&c.단계>0&&c.단계<24)return '은빛의 경비가 입구를 지켜요. 외부 군락과 힘을 모으세요.';
 if(scene==='moss'&&(state.rank<2||state.xp<750))return '숙련 일개미 · 공헌도 750부터 방문할 수 있어요.';
 if(scene==='reed'&&(state.rank<3||state.xp<1600))return '작업대장 · 공헌도 1,600부터 방문할 수 있어요.';
 if(scene==='frontier'&&!state.cleared)return '즉위한 뒤 바람의 변경으로 원정을 떠날 수 있어요.';
 return '';
}
export function buyUpgrade(state,key){
 if(!Object.hasOwn(state.campaign.강화,key))return false;
 const level=state.campaign.강화[key],price=8*(level+1);
 if(level>=3||state.inventory.seed<price)return false;
 state.inventory.seed-=price;state.campaign.강화[key]++;return true;
}
export function recordRecruit(state,added,total){
 state.stats.helped+=Math.max(0,added);
 if(added>0)state.friendships['두리']=Math.min(100,(state.friendships['두리']||0)+1);
 // Existing recruits satisfy the squad quest without counting them again as new help.
 if([12,23].includes(state.questIndex))state.questProgress=Math.min(state.questIndex===12?3:5,total);
}
export function eligibleEvent(state,event,followers){
 if(state.campaign.감옥!=='없음'||state.campaign.단계>0&&state.campaign.단계<24)return false;
 if(!['nest','outside'].includes(state.world.scene))return false;
 if((event.minRank||0)>state.rank||event.queenOnly&&!state.cleared)return false;
 if(event.target==='crumb'&&followers<2||event.target==='berry'&&followers<3)return false;
 if(event.type==='defend'&&state.questIndex<12)return false;
 if(event.type==='repair'&&state.rank<2)return false;
 return true;
}
