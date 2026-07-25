export type Horse = {
  number: number;
  name: string;
  jockey: string;
  odds: number;
  confidence: number;
  comment: string;
};

export type Race = {
  id: string;
  venue: string;
  raceNumber: number;
  title: string;
  distance: string;
  track: "芝" | "ダート";
  startTime: string;
  weather: string;
  condition: string;
  featured?: boolean;
  horses: Horse[];
};

export const races: Race[] = [
  {
    id: "tokyo-11",
    venue: "東京",
    raceNumber: 11,
    title: "府中ステークス",
    distance: "芝1600m",
    track: "芝",
    startTime: "15:40",
    weather: "晴",
    condition: "良",
    featured: true,
    horses: [
      {
        number: 5,
        name: "ミッドナイトゲイル",
        jockey: "川田将雅",
        odds: 3.2,
        confidence: 86,
        comment: "前走の末脚がこの枠でも再現しやすい。ペースが流れれば押し切り圏。",
      },
      {
        number: 9,
        name: "サザンブレイズ",
        jockey: "ルメール",
        odds: 4.8,
        confidence: 78,
        comment: "逃げ切り型。道中で楽に運べれば上位固定。",
      },
      {
        number: 2,
        name: "コバルトフラッシュ",
        jockey: "横山武史",
        odds: 6.1,
        confidence: 71,
        comment: "内枠の恩恵が大きい。差し届く展開なら穴どころか本命級。",
      },
      {
        number: 11,
        name: "グローリーリッジ",
        jockey: "松山弘平",
        odds: 9.4,
        confidence: 62,
        comment: "距離延長がプラス。上がり勝負になれば浮上。",
      },
      {
        number: 7,
        name: "シルバークレスト",
        jockey: "戸崎圭太",
        odds: 12.5,
        confidence: 55,
        comment: "休み明けで気配は上向き。人気薄の抑え候補。",
      },
    ],
  },
  {
    id: "hanshin-10",
    venue: "阪神",
    raceNumber: 10,
    title: "六甲特別",
    distance: "芝2000m",
    track: "芝",
    startTime: "15:01",
    weather: "曇",
    condition: "稍重",
    horses: [
      {
        number: 4,
        name: "オーロラライン",
        jockey: "岩田康誠",
        odds: 2.9,
        confidence: 81,
        comment: "稍重適性が明確。先行勢が潰れると一気に馬券内。",
      },
      {
        number: 8,
        name: "ナイトパレード",
        jockey: "坂井瑠星",
        odds: 5.5,
        confidence: 74,
        comment: "スタミナ型。長い直線で粘れるかが焦点。",
      },
      {
        number: 1,
        name: "フォレストコード",
        jockey: "武豊",
        odds: 7.8,
        confidence: 66,
        comment: "内枠からロスなく運べる。単勝より複勝向き。",
      },
    ],
  },
  {
    id: "kyoto-9",
    venue: "京都",
    raceNumber: 9,
    title: "朱雀ステークス",
    distance: "ダート1400m",
    track: "ダート",
    startTime: "14:25",
    weather: "晴",
    condition: "良",
    horses: [
      {
        number: 6,
        name: "ブラックサンダー",
        jockey: "藤岡佑介",
        odds: 3.6,
        confidence: 79,
        comment: "ダート短距離の機動力が突出。スタートが決まれば先頭固定。",
      },
      {
        number: 10,
        name: "レッドキャノン",
        jockey: "池添謙一",
        odds: 5.2,
        confidence: 70,
        comment: "追い込み一辺倒だが、このメンバーなら届く余地あり。",
      },
      {
        number: 3,
        name: "アンバーパルス",
        jockey: "浜中俊",
        odds: 8.9,
        confidence: 58,
        comment: "枠なりの好位。展開ひとつで馬券圏内。",
      },
    ],
  },
];

export function getFeaturedRace(): Race {
  return races.find((race) => race.featured) ?? races[0];
}

export function getTopPicks(race: Race, count = 3): Horse[] {
  return [...race.horses]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, count);
}
