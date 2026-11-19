// ============================================================
// data/stories.js — Boss 战前剧情对话（串班级梗）
// ============================================================

export const STORIES = {
  jin: {
    intro: [
      { who: '金老师', text: '我看你是唯恐天下不乱。' },
      { who: '我', text: '老师，我就是想把作业交了……' },
      { who: '金老师', text: '交作业？先把这学期的事说清楚。' },
      { who: '我', text: '（默默掏出了笔）' },
    ],
    win: [
      { who: '金老师', text: '……行，这次算你过关。' },
      { who: '我', text: '那作业……' },
      { who: '金老师', text: '明天早上第一节课前，办公室。' },
    ],
    lose: [
      { who: '金老师', text: '放学别走，叫你家长来一趟。' },
      { who: '我', text: '（这下真完了）' },
    ],
  },
  han: {
    intro: [
      { who: '韩老师', text: '口答！' },
      { who: '我', text: '老师我还没准备好……' },
      { who: '韩老师', text: '没准备好？那就是没学。' },
      { who: '我', text: '（咽了口口水）' },
    ],
    win: [
      { who: '韩老师', text: '……不错，看来是练过的。' },
      { who: '我', text: '三百道题，我也不是白做的。' },
      { who: '韩老师', text: '下次加量。' },
    ],
    lose: [
      { who: '韩老师', text: '因为你还没有经历过 300 道题的锤炼。' },
      { who: '我', text: '（手已经抬不起来了）' },
    ],
  },
  wu: {
    intro: [
      { who: '吴老师', text: '在我的课上不允许有人写作业！' },
      { who: '我', text: '老师我就写一行……' },
      { who: '吴老师', text: '一行也是写。手都放桌上。' },
      { who: '我', text: '（把手藏到了背后）' },
    ],
    win: [
      { who: '吴老师', text: '……这届学生，胆子是越来越大了。' },
      { who: '我', text: '老师，作业我真的写完了。' },
      { who: '吴老师', text: '交上来我看看。' },
    ],
    lose: [
      { who: '吴老师', text: '这本，我没收了。' },
      { who: '我', text: '（那是我写了三天的）' },
    ],
  },
};

// 学科线关卡台词（简短一句）
export const STAGE_QUOTES = {
  chinese_1: { intro: '再背一遍，从头开始。', win: '……你背得比我熟。' },
  chinese_2: { intro: '字数不够，重写。', win: '八百字，你赢了。' },
  chinese_3: { intro: '之乎者也，你懂几个？', win: '……你居然真懂。' },
  chinese_rep: { intro: '全对，下一个。', win: '……这次全对的是你。' },
  math_1: { intro: '这题我口算。', win: '口算……算错了。' },
  math_2: { intro: '辅助线连一下。', win: '辅助线被你打断了。' },
  math_3: { intro: '求个导就行。', win: '导不出来了吧。' },
  math_rep: { intro: '这题有三种解法。', win: '三种都被你破了。' },
  english_1: { intro: '这个单词你会吗？', win: '单词量不错。' },
  english_2: { intro: '时态错了，重说。', win: '时态这次对了。' },
  english_3: { intro: 'Listen and repeat.', win: 'Repeat after me：我输了。' },
  english_rep: { intro: '我们俩一起答。', win: '双胞胎也拦不住你。' },
  // 民立中学相关关卡
  art_1: { intro: '民立出了个陈丹青，你呢？', win: '……看来博雅教育没白学。' },
  art_2: { intro: '殷夫文艺节，你的作品呢？', win: '……这件作品，我收了。' },
  art_3: { intro: '敦品励学，先从画画开始。', win: '你的品行确实不凡。' },
  art_rep: { intro: '博雅教育的精髓，你悟了吗？', win: '悟了……悟了。' },
  pe_1: { intro: '民立游泳队，先游个来回。', win: '……你比乐靖宜还快。' },
  pe_2: { intro: '校运会，拿不到金牌别下课。', win: '金牌是你的了。' },
  pe_3: { intro: '威海路681号，跑一圈。', win: '……你跑完了？' },
  pe_rep: { intro: '因材而笃——你的材是什么？', win: '你的材……是战斗。' },
};

// 民立中学·校训与校风
export const SCHOOL_INFO = {
  name: '上海市民立中学',
  address: '静安区威海路681号',
  founded: 1903,
  motto: '勤学笃行',
  spirit: '诚谨博雅',
  studyStyle: '敦品励学',
  teachStyle: '因材而笃',
  mottoSource: '取自《礼记》"博学之，审问之，慎思之，明辨之，笃行之"',
  spiritDesc: '忠诚于国家和民族，以谨慎之态度做人做事做学问；有精深广博之学问、高尚儒雅之举止',
  notableAlumni: ['左联烈士殷夫', '中科院院士叶培大', '实业家邵逸夫', '油画家陈丹青', '奥运游泳冠军乐靖宜'],
  features: ['国家级游泳传统项目学校', '博雅教育', '殷夫文艺节', '静安区首批实验性示范性高中'],
};

// 民立中学相关关卡台词
export const MINLI_QUOTES = {
  school_intro: '1903年，苏氏昆仲怀着"教育救国"的热忱，创办了上海市民立中学——"为民而立"。',
  boya_edu: '博雅教育：有精深广博之学问，高尚儒雅之举止。',
  yinfu_spirit: '殷夫在此开始诗歌创作和革命活动——"我为自由而战！"',
  swim_team: '民立游泳队：国家级体育传统项目学校，奥运冠军乐靖宜曾在此训练。',
  weihaier_681: '威海路681号——民立中学扎根于此已二十载。',
  qinxd: '勤学笃行——踏踏实实，一心一意，坚持不懈地去学习、去实践。',
  chengjin: '诚谨博雅——忠诚谨慎，兼容并蓄。',
  dunpin: '敦品励学——砥砺品德，发奋学习。',
};

export function getStory(bossId) {
  return STORIES[bossId] || null;
}

export function getStageQuote(stageId) {
  return STAGE_QUOTES[stageId] || null;
}
