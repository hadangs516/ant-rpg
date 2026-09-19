// Campaign milestones are completed jobs, so spare experience never skips a chapter.
export const RANKS = [
  { name: '갓 태어난 일개미', color: '#bb8155', size: 0.78, threshold: 0, title: '작은 발걸음', perk: '작은 씨앗과 이슬을 모을 수 있어요.' },
  { name: '견습 일개미', color: '#a96a3e', size: 0.92, threshold: 6, title: '첫 바깥나들이', perk: '초원을 탐색하며 군락의 살림을 익혀요.' },
  { name: '숙련 일개미', color: '#92522d', size: 1.08, threshold: 12, title: '함께 드는 무게', perk: '동료와 함께 큰 먹이를 나를 수 있어요.' },
  { name: '작업대장', color: '#735c39', size: 1.25, threshold: 18, title: '모두의 길', perk: '더 많은 동료를 부르고 공동 작업을 이끌어요.' },
  { name: '여왕 후보', color: '#ae8138', size: 1.43, threshold: 24, title: '왕관보다 먼저', perk: '작은 날개와 금빛 무늬. 군락이 당신을 믿어요.' },
  { name: '여왕개미', color: '#d1a353', size: 1.7, threshold: 30, title: '우리의 여왕', perk: '즉위 완료! 공물, 장식, 호위와 여유로운 산책을 즐겨요.' },
];

export const ITEMS = {
  seed: { name: '씨앗', color: '#d9ba70', weight: 1, icon: '🌾' },
  dew: { name: '이슬', color: '#8dc8d6', weight: 1, icon: '💧' },
  crumb: { name: '과자 부스러기', color: '#d69a5c', weight: 3, icon: '🍪' },
  leaf: { name: '잎 조각', color: '#94ad64', weight: 1, icon: '🍃' },
  berry: { name: '산딸기', color: '#b86b65', weight: 4, icon: '🍓' },
};

// dialogue[0]: a new worker; [1]: a trusted colleague; [2]: the crowned queen.
export const NPCS = [
  { id: '봄이', name: '봄이', role: '길잡이 선배', room: 'entrance', color: '#bd835d', personality: '새 식구의 이름과 첫걸음을 모두 기억한다.', dialogue: [
    '왔구나! 이 굴에서 길을 잃는 건 아주 정상적인 일이야. 나도 어제 창고 대신 목욕방에 갔거든. 우선 내 옆으로 와서 인사해 줘.',
    '걸음 소리만 들어도 너인 줄 알겠어. 이제 누군가 길을 잃으면 네가 먼저 손을 내밀어 주겠지?',
    '폐하라고 불러야 하나? 그래도 내겐 입구에서 더듬이를 꼼지락거리던 작은 후배야. 산책 가면 같이 가자.' ] },
  { id: '도담', name: '도담', role: '알방 보육사', room: 'nursery', color: '#c38c75', personality: '알마다 이름을 붙이고 조용한 자장가를 흥얼거린다.', dialogue: [
    '쉿, 여긴 알방이야. 이쪽 아이는 톡톡이, 저쪽은 아직 이름을 고민 중이야. 알방에서 돌보기로 잠자리를 포근하게 해 줄래?',
    '네가 돌봐 준 아이들이 벌써 통로를 걷기 시작했어. 저기 넘어졌다가 웃는 아이 보여?',
    '폐하를 닮아서인지 어린 개미들이 유난히 호기심이 많아요. 오늘 자장가도 함께 부르실래요?' ] },
  { id: '꾸벅', name: '꾸벅', role: '졸린 창고지기', room: 'pantry', color: '#ae8252', personality: '눈을 감고도 씨앗 개수를 정확히 안다.', dialogue: [
    '안 잤어. 씨앗 향을 분류하고 있었지. 먹이를 가져오면 나에게 말을 걸어 전달해 줘. 빈 선반 소리가 조금 쓸쓸하거든.',
    '네 씨앗은 오른쪽 세 번째 칸에 있어. 숫자를 외우는 비결? 잘 자는 거야. 아주 잘.',
    '왕실 공물은 따로 챙겨 뒀어요. 맛있는 것부터 골라 놓다가... 맛을 본 건 아니에요. 아마도.' ] },
  { id: '보리', name: '보리', role: '먹이 감별사', room: 'market', color: '#c09554', personality: '작은 과자에도 거창한 품평을 붙이는 미식가.', dialogue: [
    '오늘의 추천은 햇볕에 한 번 구운 씨앗! 사실 그냥 바깥에 있었지만 향이 훌륭하지. 초원마다 먹이가 달라서 돌아볼 만해.',
    '함께 나른 과자가 제일 맛있어. 여럿이 들다 보면 부스러기가 생기는데, 그건 운반조의 정당한 간식이지.',
    '왕실 간식 시식회에 초대합니다. 오늘의 평가는 “한 번 더 먹고 생각해 보기”예요.' ] },
  { id: '잠솔', name: '잠솔', role: '휴게실 음악가', room: 'rest', color: '#98806c', personality: '풀잎을 켜며 느린 곡을 만들고 낮잠을 권한다.', dialogue: [
    '바쁘면 더 잠깐 앉아 봐. 더듬이에 바람이 지나갈 틈은 있어야지. 이 방에서는 쉬어 갈 수 있어.',
    '새 곡 제목은 “흙덩이 내려놓는 소리”야. 마지막 음은 네가 한숨 쉬는 소리로 해도 돼.',
    '여왕이 쉬면 다른 개미들도 마음 놓고 쉬어요. 오늘은 아무 계획 없는 계획을 세워 봐요.' ] },
  { id: '뚝딱', name: '뚝딱', role: '잎사귀 기술자', room: 'workshop', color: '#9f7349', personality: '삐뚤어진 물건도 장점부터 찾는 발명가.', dialogue: [
    '이건 세 번 넘어져도 안 깨지는 수레야. 아직 굴러가지는 않지만 아주 튼튼하지. 잎사귀는 지붕도 이불도 될 수 있어.',
    '네가 가져온 잎으로 창고 지붕을 만들었어. 비가 와도 씨앗이 눅눅해지지 않을 거야.',
    '왕실 의자 완성! 장점은 편안함. 단점은 너무 편안함. 장식을 바꾸면 분위기도 달라져요.' ] },
  { id: '파삭', name: '파삭', role: '굴착반장', room: 'dig', color: '#956546', personality: '흙의 촉감으로 날씨를 맞히며 지름길에 진심이다.', dialogue: [
    '이 벽 너머엔 근사한 빈 공간이 있어. 아직은 내 상상 속에만 있지만! 공사 표식 근처에서 땅을 파면 길이 조금씩 열려.',
    '오늘 나른 흙이 내일 모두의 지름길이 되지. 발자국이 늘어날수록 기분이 좋아져.',
    '폐하, 새 방의 용도를 정했어요. 이름하여... 아무것도 안 하는 방! 필요하면 언제든 더 파 드리죠.' ] },
  { id: '책갈피', name: '책갈피', role: '군락 기록관', room: 'library', color: '#987b5c', personality: '꽃가루로 메모하며 소소한 발견도 소중히 적는다.', dialogue: [
    '모르는 길을 발견하면 기록장에 남겨 둬. 아주 작은 씨앗도 처음 만난 날이 있잖아. 지도에서 방 이름을 확인하고 직접 걸어 봐.',
    '오늘 기록은 “모두 함께 큰 먹이를 들다”. 숫자만 적기엔 꽤 멋진 순간이었어.',
    '즉위식 기록 마지막 줄에는 이렇게 썼어요. “여왕은 왕관보다 동료들의 이름을 먼저 챙겼다.”' ] },
  { id: '은빛', name: '은빛', role: '군락의 여왕', room: 'royal', color: '#c5a165', personality: '오래된 여왕. 명령보다 듣는 일을 중요하게 여긴다.', dialogue: [
    '작은 일도 누군가의 하루를 지탱한단다. 서두르지 말고 이 굴에서 살아가는 친구들을 만나 보렴.',
    '네가 지나간 곳마다 길이 넓어지고 식구들이 웃더구나. 이 군락은 그런 개미를 지도자로 기억한단다.',
    '이제 내게도 긴 산책 시간이 생겼구나. 새 여왕님, 즐겁게 살아가렴. 그게 이 굴을 오래 지키는 방법이야.' ] },
  { id: '단단', name: '단단', role: '겁 많은 경비대장', room: 'guard', color: '#806044', personality: '큰 그림자에 놀라지만 동료 앞에서는 한 걸음 나선다.', dialogue: [
    '경계는 겁이 없는 일이 아니야. 무서워도 친구 옆에 서는 거지. 경비소에서 방어와 빗물 막기 연습을 할 수 있어.',
    '네가 있으니 그림자가 덜 커 보여. 큰 곤충을 만나면 동료를 부르고 짧게 밀어내자. 무리하면 굴로 돌아와도 돼.',
    '호위 준비 끝! 목적지는... 휴게실인가요? 아주 전략적인 선택입니다. 저도 간식이 필요했어요.' ] },
  { id: '바람', name: '바람', role: '방향치 정찰병', room: 'scout', color: '#b39370', personality: '새 장소를 잘 찾지만 돌아올 때 지도를 거꾸로 든다.', dialogue: [
    '정찰 비결? 일단 나가 보는 거야! 돌아오는 비결은... 지도야. 바깥 관찰 지점에 도착하면 주변을 살펴봐.',
    '오늘은 집을 바로 찾았어. 네 페로몬 길을 따라왔거든. 정원에서 집 버튼을 누르면 땅 위에 집으로 이어지는 냄새가 보여.',
    '폐하와 떠나는 목적지 없는 산책! 길을 잃은 게 아니라 아직 목적지를 정하지 않은 거예요.' ] },
  { id: '몽글', name: '몽글', role: '버섯 정원사', room: 'fungus', color: '#ad9279', personality: '버섯과 대화하며 촉촉한 흙 냄새를 좋아한다.', dialogue: [
    '버섯들은 천천히 대답해. 그래서 기다리면서 차를 마시지. 이슬이 있으면 정원이 더 싱그러워질 거야.',
    '작은 물방울 하나로 이렇게 달라졌어. 저 버섯은 네가 올 때마다 조금 더 고개를 드는 것 같아.',
    '왕실 버섯차 준비됐어요. 취향은 달라져도 괜찮아요. 오늘 맛있는 게 오늘의 정답이니까.' ] },
  { id: '약손', name: '약손', role: '다정한 치료사', room: 'clinic', color: '#a89378', personality: '약초보다 따뜻한 말부터 건네는 친구.', dialogue: [
    '더듬이가 축 처졌네. 처음엔 모든 길이 길게 느껴져. 너무 힘주지 말고, 잠깐 쉬었다가 다시 해도 돼.',
    '도움을 부르는 것도 실력이야. 큰 먹이를 혼자 들지 않는 것처럼 말이지. 동료들이 기다리고 있어.',
    '여왕님도 평범한 하루가 필요해요. 오늘 진료는 산책 한 번, 웃음 두 번, 낮잠은 마음껏입니다.' ] },
  { id: '초록', name: '초록', role: '진딧물 친구', room: 'garden', color: '#8d9366', personality: '풀숲의 이웃들을 소개하고 모든 생물에게 별명을 붙인다.', dialogue: [
    '진딧물 친구는 단물을 주고 우리는 비를 막아 줘. 바깥에서는 먹이 말고도 만날 친구가 많아.',
    '진딧물들이 네 얘기를 해. 어떻게 알아들었냐고? 표정이 아주 고마워 보이잖아.',
    '오늘 정원 손님은 무당벌레예요. 간식은 따로 준비했으니 진딧물 친구들은 걱정 안 해도 돼요.' ] },
  { id: '두리', name: '두리', role: '운반조 조장', room: 'meeting', color: '#aa744b', personality: '함께 들어 올릴 때 구호가 매번 조금씩 틀린다.', dialogue: [
    '하나, 둘, 넷! 아, 셋이었나? 구호는 틀려도 마음만 맞으면 돼. 숙련 일개미가 되면 운반조를 함께 꾸려 보자.',
    '동료 부르기로 운반조를 모아 봐. 큰 과자나 산딸기 옆에서 기다리면 친구들이 와서 같이 들 거야.',
    '오늘 호위조 구호는 “여왕님, 천천히!”예요. 산책은 빨리 끝내면 손해잖아요.' ] },
];

export const QUESTS = [
  { id: '처음만난봄이', title: '처음 만난 선배', description: '입구의 봄이에게 다가가 말을 걸어 보세요. 굴 안팎 모두 조이스틱 또는 방향키로 직접 이동해요.', npc: '봄이', type: 'talk', target: '봄이', count: 1, xp: 20, rank: 0 },
  { id: '작은식구돌보기', title: '작은 식구의 이불', description: '알방에서 돌보기를 세 번 해 주세요. 알방 보육사 도담이 기다리고 있어요.', npc: '도담', type: 'care', target: 'nursery', count: 3, xp: 35, rank: 0 },
  { id: '첫씨앗채집', title: '첫 번째 바깥나들이', description: '입구 문에서 상호작용해 초원으로 나가세요. 가까운 씨앗 다섯 개를 모아 봐요.', npc: '봄이', type: 'gather', target: 'seed', count: 5, xp: 45, rank: 0 },
  { id: '창고에첫선물', title: '창고에 놓는 첫 선물', description: '모은 씨앗 다섯 개를 창고지기 꾸벅에게 전달해 주세요. 지도는 집의 위치를 알려 줘요.', npc: '꾸벅', type: 'deliver', target: 'seed', count: 5, xp: 45, rank: 0 },
  { id: '함께파는첫통로', title: '벽 너머의 내일', description: '공사 구역에서 땅을 여섯 번 파세요. 동료들도 흙을 나르고 있어요. 완성된 통로는 실제 지름길이 돼요.', npc: '파삭', type: 'dig', target: 'dig', count: 6, xp: 55, rank: 0 },
  { id: '첫배지수여', title: '작은 일개미의 배지', description: '첫 임무들을 마쳤어요. 봄이에게 돌아가 견습 일개미 배지를 받으세요.', npc: '봄이', type: 'talk', target: '봄이', count: 1, xp: 60, rank: 0 },
  { id: '아침이슬모으기', title: '물방울 속의 하늘', description: '초원의 푸른 이슬 다섯 방울을 모아 주세요. 잎사귀 주변을 살피면 찾을 수 있어요.', npc: '몽글', type: 'gather', target: 'dew', count: 5, xp: 60, rank: 1 },
  { id: '버섯정원의차', title: '버섯 정원의 작은 찻잔', description: '몽글에게 이슬 다섯 방울을 전달하세요. 버섯 정원에 촉촉한 아침을 선물해요.', npc: '몽글', type: 'deliver', target: 'dew', count: 5, xp: 60, rank: 1 },
  { id: '지도를읽는법', title: '길을 기억하는 방법', description: '기록관 책갈피에게 말을 걸어 지도와 이름이 지워진 기록에 관한 이야기를 들어 보세요.', npc: '책갈피', type: 'talk', target: '책갈피', count: 1, xp: 45, rank: 1 },
  { id: '잎사귀지붕재료', title: '바람에 날린 초록 조각', description: '초원에서 잎 조각 여섯 개를 모으세요. 뚝딱이 새 창고 지붕을 만들려고 해요.', npc: '뚝딱', type: 'gather', target: 'leaf', count: 6, xp: 70, rank: 1 },
  { id: '창고지붕올리기', title: '비가 와도 보송하게', description: '잎 조각 여섯 개를 공방의 뚝딱에게 전달하세요. 씨앗들이 비를 피할 수 있게 돼요.', npc: '뚝딱', type: 'deliver', target: 'leaf', count: 6, xp: 65, rank: 1 },
  { id: '정원까지지름길', title: '돌아가지 않아도 되는 길', description: '공사 구역에서 열 번 더 땅을 파세요. 길이 넓어지면 운반조도 더 편하게 다닐 수 있어요.', npc: '파삭', type: 'dig', target: 'dig', count: 10, xp: 90, rank: 1 },
  { id: '운반조첫모임', title: '하나, 둘, 함께!', description: '모임방의 두리에게 말을 걸고 동료 부르기로 세 마리 운반조를 꾸리세요.', npc: '두리', type: 'recruit', target: '두리', count: 3, xp: 80, rank: 2 },
  { id: '커다란과자', title: '우리보다 커다란 간식', description: '동료들과 바깥에서 과자 부스러기 네 개를 모으세요. 무거운 먹이 곁에 모이면 함께 들어요.', npc: '보리', type: 'gather', target: 'crumb', count: 4, xp: 95, rank: 2 },
  { id: '나누면더맛있어', title: '나누면 더 맛있어', description: '과자 부스러기 네 개를 먹이 감별사 보리에게 전달하세요. 오늘은 군락 간식 시간이 열려요.', npc: '보리', type: 'deliver', target: 'crumb', count: 4, xp: 85, rank: 2 },
  { id: '자라는작은식구', title: '누군가의 첫걸음', description: '알방에서 여섯 번 돌보기를 해 주세요. 도담 혼자 손이 모자랄 만큼 새 식구가 늘었어요.', npc: '도담', type: 'care', target: 'nursery', count: 6, xp: 90, rank: 2 },
  { id: '초원정찰기록', title: '집이 보이는 언덕', description: '바깥 관찰 지점에서 주변을 정찰하세요. 지도에서 집 위치를 확인하고 바람에게 돌아오세요.', npc: '바람', type: 'scout', target: 'scout', count: 1, xp: 95, rank: 2 },
  { id: '함께서는용기', title: '겁이 나도 함께 서기', description: '경비소에서 여섯 번 방어 연습을 하세요. 단단과 함께 큰 그림자에 맞서는 법을 배워요.', npc: '단단', type: 'defend', target: 'guard', count: 6, xp: 110, rank: 2 },
  { id: '산딸기원정대', title: '붉은 열매 원정대', description: '동료를 데리고 초원을 탐험하며 산딸기 다섯 개를 모으세요. 함께 들면 커다란 열매도 옮길 수 있어요.', npc: '초록', type: 'gather', target: 'berry', count: 5, xp: 120, rank: 3 },
  { id: '정원이웃잔치', title: '이웃을 위한 식탁', description: '정원의 초록에게 산딸기 다섯 개를 전달하세요. 풀숲의 이웃들과 함께 나눌 거예요.', npc: '초록', type: 'deliver', target: 'berry', count: 5, xp: 110, rank: 3 },
  { id: '군락확장공사', title: '모두의 발자국이 모이는 곳', description: '공사 구역에서 열네 번 땅을 파세요. 함께 만든 새 길이 바쁜 군락을 이어 줘요.', npc: '파삭', type: 'dig', target: 'dig', count: 14, xp: 135, rank: 3 },
  { id: '소나기대비', title: '비 오기 전에', description: '경비소에서 여덟 번 빗물 막기 작업을 하세요. 맑은 날에도 미리 튼튼하게 보수할 수 있어요.', npc: '단단', type: 'repair', target: 'guard', count: 8, xp: 120, rank: 3 },
  { id: '대장도쉬어가요', title: '대장도 쉬어 가요', description: '치료실의 약손에게 말을 걸어 보세요. 잘 돕는 것만큼 도움을 받는 일도 중요하대요.', npc: '약손', type: 'talk', target: '약손', count: 1, xp: 85, rank: 3 },
  { id: '모두가믿는대장', title: '함께라서 할 수 있는 일', description: '두리와 동료 다섯 마리의 작업대를 꾸리세요. 이제 군락의 친구들이 당신의 뒤를 따라요.', npc: '두리', type: 'recruit', target: '두리', count: 5, xp: 150, rank: 3 },
  { id: '즉위식초록장식', title: '왕관보다 먼저 준비할 것', description: '초원에서 잎 조각 여덟 개를 모으세요. 왕실뿐 아니라 모든 식구의 방에 장식할 거예요.', npc: '뚝딱', type: 'gather', target: 'leaf', count: 8, xp: 140, rank: 4 },
  { id: '모두의축제준비', title: '굴마다 초록 리본', description: '뚝딱에게 잎 조각 여덟 개를 전달하세요. 우리가 함께 살아가는 굴 전체가 축제 장소예요.', npc: '뚝딱', type: 'deliver', target: 'leaf', count: 8, xp: 130, rank: 4 },
  { id: '마지막안전점검', title: '모든 식구가 안심하도록', description: '경비소에서 열 번 방어 연습을 하세요. 즉위식 날도 동료들과 힘을 모아 굴을 지킬 준비를 해요.', npc: '단단', type: 'defend', target: 'guard', count: 10, xp: 160, rank: 4 },
  { id: '첫약속기억하기', title: '가장 작은 식구와의 약속', description: '알방에서 여덟 번 돌보기를 해 주세요. 처음 맡았던 일을 기억하는 여왕이 되어 봐요.', npc: '도담', type: 'care', target: 'nursery', count: 8, xp: 140, rank: 4 },
  { id: '은빛의부탁', title: '왕관은 함께 드는 것', description: '왕실의 은빛 여왕에게 말을 걸어 마지막 제안을 들으세요. 닫힌 문 너머로 경비들의 발소리가 들려요.', npc: '은빛', type: 'talk', target: '은빛', count: 1, xp: 150, rank: 4 },
  { id: '우리의여왕', title: '우리의 여왕', description: '왕좌에서 여왕의 제안에 대답하세요. 진정한 왕관을 얻기 위한 이야기는 아직 끝나지 않았어요.', npc: '은빛', type: 'royal', target: 'royal', count: 1, xp: 300, rank: 4 },
];

export const EVENTS = [
  { id: '갑작스러운소나기', name: '소나기가 톡톡', description: '입구로 빗물이 들어와요! 경비소에서 빗물 막기로 힘을 보태 주세요.', type: 'repair', duration: 85, target: 'guard', count: 5, reward: 55, minRank: 0 },
  { id: '커다란그림자', name: '초원의 커다란 그림자', description: '배고픈 곤충이 먹이를 기웃거려요. 바깥 포식자에게 다가가 동료들과 함께 밀어내세요.', type: 'defend', duration: 90, target: 'guard', count: 6, reward: 65, minRank: 1 },
  { id: '바람이준선물', name: '바람이 준 선물', description: '풀숲에 씨앗이 우수수 떨어졌어요. 흩어지기 전에 씨앗 다섯 개를 주워 봐요.', type: 'gather', duration: 85, target: 'seed', count: 5, reward: 50, minRank: 0 },
  { id: '반짝이는아침', name: '반짝이는 아침', description: '이슬이 유난히 맑은 날이에요. 네 방울을 모아 군락의 아침을 시원하게 해 주세요.', type: 'gather', duration: 85, target: 'dew', count: 4, reward: 50, minRank: 0 },
  { id: '길잃은정찰조', name: '바람의 지도는 거꾸로', description: '정찰조가 집 방향을 헷갈려 해요. 바깥 관찰 지점에서 정찰해 귀가 신호를 보내 주세요.', type: 'scout', duration: 100, target: 'scout', count: 1, reward: 60, minRank: 1 },
  { id: '알방의재채기', name: '알방의 작은 소동', description: '꽃가루가 날아와 알방이 간질간질해요. 네 번 돌보기로 이불을 털어 주세요.', type: 'care', duration: 80, target: 'nursery', count: 4, reward: 50, minRank: 0 },
  { id: '흙벽의보물', name: '흙벽 속 반짝임', description: '굴착조가 예쁜 돌을 발견했어요. 여섯 번 땅을 파서 함께 꺼내 봐요.', type: 'dig', duration: 85, target: 'dig', count: 6, reward: 60, minRank: 0 },
  { id: '진딧물비가림', name: '풀숲 이웃의 작은 지붕', description: '진딧물 친구에게 그늘이 필요해요. 잎 조각 네 개를 모아 초록을 도와주세요.', type: 'gather', duration: 90, target: 'leaf', count: 4, reward: 60, minRank: 1 },
  { id: '과자소풍', name: '오늘은 군락 소풍', description: '동료들과 과자 부스러기 세 개를 모아요. 크게 한입씩 나누면 더 맛있을 거예요.', type: 'gather', duration: 180, target: 'crumb', count: 3, reward: 75, minRank: 2 },
  { id: '산딸기축제', name: '산딸기가 익는 날', description: '달콤한 열매 냄새가 퍼져요. 운반조와 산딸기 세 개를 모아 작은 잔치를 열어요.', type: 'gather', duration: 180, target: 'berry', count: 3, reward: 80, minRank: 3 },
  { id: '여왕의정원산책', name: '여왕님의 느긋한 산책', description: '오늘은 바깥 관찰 지점에서 바람을 느껴 봐요. 호위 개미들도 오랜만에 소풍 기분이에요.', type: 'scout', duration: 100, target: 'scout', count: 1, reward: 40, minRank: 5, queenOnly: true },
];

export const DISCOVERY_LABELS = {
  seed: '작은 씨앗', dew: '아침 이슬', crumb: '커다란 과자', leaf: '초록 잎사귀', berry: '붉은 산딸기',
  scout: '집이 보이는 언덕', dig: '함께 넓힌 땅굴', nursery: '포근한 알방', guard: '든든한 경비소', royal: '모두의 왕실',
};
