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
};

export function getStory(bossId) {
  return STORIES[bossId] || null;
}

export function getStageQuote(stageId) {
  return STAGE_QUOTES[stageId] || null;
}
