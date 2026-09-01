/*
  文明・核・断片の語彙だけ。地形生成は gen.ts。
  各バンクは 14 語。14×14×14 ≒ 2,744 通りを「約 2,400」と呼んでいる。
  語を足すなら 14 のまま揃える。数を変えると組合せの約束が崩れる。
*/
type Rng = {
  pick: <T>(arr: readonly T[]) => T;
  int: (a: number, b: number) => number;
};

export const CIV_A = [
  "第三",
  "灰",
  "沈水",
  "静謐",
  "錆",
  "凍土",
  "霧",
  "塩",
  "末裔",
  "偽金",
  "夜半",
  "白熱",
  "無音",
  "湿原",
] as const;

export const CIV_B = [
  "基壇",
  "駅政",
  "測量",
  "荷重",
  "水路",
  "書庫",
  "輪郭",
  "残響",
  "観測",
  "継ぎ",
  "灯台",
  "回廊",
  "祭壇",
  "軌道",
] as const;

export const CIV_C = [
  "庁",
  "局",
  "都市",
  "院",
  "廠",
  "港",
  "門",
  "環",
  "坑",
  "堂",
  "館",
  "塔",
  "駅",
  "倉",
] as const;

const CIV_NO = new Set<string>(["灰", "霧", "塩", "錆", "夜半"]);

export const RULE_A = [
  "垂直を神聖とし",
  "通路を法とし",
  "水平を正しさとし",
  "沈黙を規格とし",
  "名前を荷重とし",
  "光を税とし",
  "方位を契約とし",
  "残響を戸籍とし",
] as const;

export const RULE_B = [
  "屋根で空を封じようとした",
  "交差しない動線を罪とした",
  "傾きをすべて誤差と呼んだ",
  "人が減っても柱は残した",
  "水より先に文字を運んだ",
  "影の長さで時刻を決めた",
] as const;

export const RULE_C = [
  "いま屋根だけが残っている。",
  "いま柱の名だけが残っている。",
  "いま誤差の側が本物になった。",
  "いま規格外の沈黙が満ちている。",
  "いま出口だけが同じ方向を向く。",
] as const;

export const LM_SITE = {
  atrium: [
    "天井",
    "列柱",
    "祭壇",
    "池",
    "屋根",
    "壁面",
    "床",
    "窓",
    "階段",
    "縁",
    "穹",
    "廂",
    "灯籠",
    "敷石",
  ],
  tower: [
    "根",
    "螺旋",
    "基壇",
    "避雷",
    "風見",
    "展望",
    "梯子",
    "屋根",
    "芯",
    "頂",
    "胴",
    "段",
    "軸",
    "裾",
  ],
  bridge: [
    "斜面",
    "欄干",
    "桁",
    "継ぎ",
    "床版",
    "索",
    "踏面",
    "袖",
    "座",
    "杭",
    "梁",
    "水面",
    "沓",
    "継手",
  ],
} as const;

export const LM_STATE = [
  "欠けた",
  "呑まれた",
  "沈んだ",
  "折れた",
  "裂かれた",
  "凍った",
  "傾いた",
  "錆びた",
  "空いた",
  "塩噛んだ",
  "焼けた",
  "埋もれた",
  "ねじれた",
  "剥がれた",
] as const;

export const LM_FORM = {
  atrium: [
    "円庭",
    "中庭",
    "劇場",
    "井戸",
    "光井戸",
    "舞台",
    "池庭",
    "石庭",
    "吹抜",
    "円環",
    "回廊",
    "穹庭",
    "縁庭",
    "列柱庭",
  ],
  tower: [
    "測塔",
    "煙突",
    "針",
    "櫓",
    "鐘楼",
    "望楼",
    "芯塔",
    "火楼",
    "標柱",
    "尖塔",
    "灯塔",
    "櫓塔",
    "観測塔",
    "風塔",
  ],
  bridge: [
    "架橋",
    "桟道",
    "渡廊",
    "橋脚",
    "拱橋",
    "吊橋",
    "歩廊",
    "桟橋",
    "桁橋",
    "舟橋",
    "石橋",
    "鉄橋",
    "廊橋",
    "桟",
  ],
} as const;

export const REL_A = [
  "荷重",
  "応急",
  "背丈",
  "残響",
  "観測",
  "方位",
  "継ぎ",
  "規格",
  "灯火",
  "湿気",
  "空洞",
  "拓本",
  "輪郭",
  "影",
] as const;

export const REL_B = [
  "記録",
  "記号",
  "メモ",
  "名簿",
  "図面",
  "遺言",
  "日誌",
  "測量",
  "碑文",
  "注釈",
  "写図",
  "口伝",
  "台帳",
  "目録",
] as const;

export const REL_C = [
  "断片",
  "抄",
  "端",
  "写し",
  "残り",
  "欠",
  "芯",
  "層",
  "痕",
  "控え",
  "欠片",
  "残頁",
  "欠行",
  "余白",
] as const;

export const REL_BODIES = [
  "柱は屋根を支えていない。屋根は、かつて誰かが守ろうとした空を支えている。",
  "上手な石工の跡の上に、拙いコンクリートが被さっている。急いでいたのは後の者だ。",
  "子どもの高さの線が、公式の碑文を覆っている。意味は、公式の側から先に死んだ。",
  "この床は、歩く音が一定になるよう削られている。沈黙は、規格外だった。",
  "廃墟は過去ではない。解像度を失った世界が、自分を圧縮して残したキャッシュだ。",
  "椅子はすべて同じ方向を向いている。食事ではなく、出口を見ていた。",
  "壁の継ぎ目だけが、新しい暦を知っている。名前は柱に残り、人は残らなかった。",
  "水は文字より先に、低い部屋へ降りている。読み方を失った記号ほど、正確に残る。",
  "旗の残骸が、風の通り道を示している。次の文明は、この床の音を法にするだろう。",
  "誤差と呼ばれた傾きが、いま唯一の水平だ。灯火を消せば、規格は戻ってくる。",
  "応急の継ぎは、本筋より正直だ。急いだ手跡が、滅びの時刻を残している。",
  "同じ方位を向く椅子の脚だけが、出口の記憶をまだ持っている。",
] as const;

export type LandmarkKind = keyof typeof LM_SITE;

export function composeCivName(rng: Rng) {
  const a = rng.pick(CIV_A);
  const b = rng.pick(CIV_B);
  const c = rng.pick(CIV_C);
  return CIV_NO.has(a) ? `${a}の${b}${c}` : `${a}${b}${c}`;
}

export function composeCivRule(rng: Rng) {
  return `${rng.pick(RULE_A)}、${rng.pick(RULE_B)}。${rng.pick(RULE_C)}`;
}

export function composeLandmarkName(rng: Rng, kind: LandmarkKind) {
  const site = rng.pick(LM_SITE[kind]);
  const state = rng.pick(LM_STATE);
  const form = rng.pick(LM_FORM[kind]);
  const ni = state === "呑まれた" || state === "沈んだ" || state === "凍った";
  return ni ? `${site}に${state}${form}` : `${site}の${state}${form}`;
}

export function composeRelicTitle(rng: Rng, used: Set<string>) {
  for (let i = 0; i < 24; i++) {
    const a = rng.pick(REL_A);
    const b = rng.pick(REL_B);
    const c = rng.pick(REL_C);
    const title = `${a}の${b}${c}`;
    if (!used.has(title)) {
      used.add(title);
      return title;
    }
  }
  return `${rng.pick(REL_A)}の${rng.pick(REL_B)}${rng.pick(REL_C)}`;
}


export function pickDistinct<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const bag = arr.slice();
  const out: T[] = [];
  while (out.length < n && bag.length) {
    const i = rng.int(0, bag.length);
    out.push(bag.splice(i, 1)[0]!);
  }
  return out;
}
