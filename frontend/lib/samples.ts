/**
 * 예시 곡.
 *
 * 실제로 만들어진 곡이다 — 화면을 채우려고 붙인 가짜가 아니라, 이 앱이
 * 부르는 것과 같은 제공자(Suno · APIFRAME 경유)에 같은 방식으로 넣어 뽑은
 * 결과물을 그대로 담아 두었다. 가사도 우리 가사 생성기(app/api/lyrics)가
 * 확인된 이야기 여섯 건에서 만든 것이다. 그래서 "이런 게 나옵니다"라고 말할
 * 때 근거가 있다.
 *
 * 미리 만들어 둔 이유는 돈이다. 복지사가 어떤 소리가 나오는지 보려고 한 번
 * 눌러 보는 것만으로도 이번 달 한도가 줄어든다. 파일로 들고 있으면 몇 번을
 * 들어도 0원이다.
 *
 * 한 번 갈아 끼웠다. 처음 세 곡은 곡 만들기가 아직 ElevenLabs 이던 시절에
 * 뽑은 것이라, 제공자를 Suno 로 바꾼 뒤로는 "같은 API 로 뽑았다"는 이 주석이
 * 거짓이 돼 있었다. 게다가 셋 다 발라드였다 — 스타일을 고르는 화면에서
 * 트로트를 고른 사람에게 발라드 세 개를 들려주면 고르는 데 아무 도움이 안
 * 된다. 지금은 네 스타일에 한 곡씩이고, 스타일 화면은 고른 분위기의 곡을
 * 먼저 내놓는다.
 *
 * 다만 어르신 것이 아니라는 점을 화면에서 반드시 밝힌다. 보관함에 예시가
 * 실제 곡인 척 섞이면, 어느 것이 우리 어르신 것인지 못 믿게 된다.
 */

export type SampleSong = {
  id: string;
  /** MUSIC_STYLES 의 id 와 같다. 스타일 화면이 이걸로 짝을 찾는다. */
  styleId: string;
  title: string;
  /** 어떤 분위기로 만들었는지 — 사람이 읽는 말 */
  style: string;
  /** 초 단위 길이. ffprobe 로 잰 실제 값이다(지시한 길이가 아니다). */
  seconds: number;
  src: string;
  art: string;
};

/**
 * 예시가 쓰는 가사.
 *
 * 이 앱의 가사 생성기가 아래 여섯 가지 확인된 이야기에서 만든 결과다.
 *   · 고향은 강원도 정선이고 산이 사방으로 둘러싼 마을이었다
 *   · 어머니가 새벽마다 아궁이에 불을 때서 밥을 지으셨다
 *   · 겨울이면 아버지가 지게에 나무를 지고 산을 내려오셨다
 *   · 스물셋에 시집와서 그 마을을 떠났다
 *   · 떠나던 날 어머니가 마을 어귀까지 따라 나오셨다
 *   · 지금도 눈 내리는 날이면 그 마을이 생각난다
 *
 * 네 곡 모두 이 가사로 만들었다. 달라지는 것은 분위기뿐이라, 같은 이야기가
 * 스타일에 따라 어떻게 달라지는지 들어서 비교할 수 있다.
 */
export const SAMPLE_LYRICS = `[1절]
고향은 정선이죠
산이 둘러싼 마을
어머니가 지으신 밥
새벽의 따스함이죠

[후렴]
고향의 어머니 생각
눈 내리는 날이면
그 마을이 그리워
마음이 아려옵니다

[2절]
겨울이면 아버지
지게에 나무 지고
산을 내려오셨죠
그 모습이 그립죠`;

const TITLE = '고향의 어머니';

export const SAMPLE_SONGS: SampleSong[] = [
  {
    id: 'sample-folkTrad',
    styleId: 'folkTrad',
    title: TITLE,
    style: '민요풍',
    seconds: 210,
    src: '/songs/sample-folk-trad.mp3',
    art: 'album_family_house',
  },
  {
    id: 'sample-folkBright',
    styleId: 'folkBright',
    title: TITLE,
    style: '밝은 포크풍',
    seconds: 174,
    src: '/songs/sample-folk-bright.mp3',
    art: 'album_seaside_flowers',
  },
  {
    id: 'sample-ballad',
    styleId: 'ballad',
    title: TITLE,
    style: '따뜻한 발라드',
    seconds: 203,
    src: '/songs/sample-ballad.mp3',
    art: 'album_family',
  },
  {
    id: 'sample-trot',
    styleId: 'trot',
    title: TITLE,
    style: '느린 트로트',
    seconds: 185,
    src: '/songs/sample-trot.mp3',
    art: 'album_lighthouse',
  },
];

/** 고른 분위기의 예시를 맨 앞으로. 고르기 전에는 순서를 그대로 둔다. */
export function samplesFor(styleId: string | null): SampleSong[] {
  if (!styleId) return SAMPLE_SONGS;
  const hit = SAMPLE_SONGS.filter((s) => s.styleId === styleId);
  return [...hit, ...SAMPLE_SONGS.filter((s) => s.styleId !== styleId)];
}

export function sampleLength(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
