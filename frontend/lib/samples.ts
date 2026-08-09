/**
 * 예시 곡.
 *
 * 실제로 만들어진 곡이다 — 화면을 채우려고 붙인 가짜가 아니라, 이 앱이
 * 부르는 것과 같은 API로 같은 가사를 넣어 뽑은 결과물을 그대로 담아 두었다.
 * 그래서 "이런 게 나옵니다"라고 말할 때 근거가 있다.
 *
 * 미리 만들어 둔 이유는 돈이다. 곡 하나가 1,125크레딧이라, 복지사가 어떤
 * 소리가 나오는지 보려고 한 번 눌러 보는 것만으로도 이번 달 한도가 줄어든다.
 * 파일로 들고 있으면 몇 번을 들어도 0원이다.
 *
 * 다만 어르신 것이 아니라는 점을 화면에서 반드시 밝힌다. 보관함에 예시가
 * 실제 곡인 척 섞이면, 어느 것이 우리 어르신 것인지 못 믿게 된다.
 */

export type SampleSong = {
  id: string;
  title: string;
  /** 어떤 분위기로 만들었는지 — 사람이 읽는 말 */
  style: string;
  /** 초 단위 길이 */
  seconds: number;
  src: string;
  art: string;
};

/** 예시가 쓰는 가사. 세 곡 모두 같은 가사로 만든 다른 결과물이다. */
export const SAMPLE_LYRICS = `[1절]
열아홉에 들어간 공장
첫 직장 그곳에서
첫 월급 손에 쥐고
어머니께 신발 사드렸죠

[후렴]
그날의 기분 뿌듯했죠
사랑을 전한 순간
내 마음 가득한 기쁨
영원히 잊지 않을 거예요

[2절]
힘든 날도 많았지만
그 속에서 배운 것들
어머니의 웃음이
내게 큰 힘이 되었죠`;

export const SAMPLE_SONGS: SampleSong[] = [
  {
    id: 'sample-90',
    title: '첫 월급의 첫 선물',
    style: '잔잔한 발라드',
    seconds: 90,
    src: '/songs/sample-ballad-90.mp3',
    art: 'album_briefcase_coins',
  },
  {
    id: 'sample-a',
    title: '첫 월급의 첫 선물 (다른 결과)',
    style: '잔잔한 발라드',
    seconds: 60,
    src: '/songs/sample-ballad-a.mp3',
    art: 'album_family',
  },
  {
    id: 'sample-b',
    title: '첫 월급의 첫 선물 (또 다른 결과)',
    style: '잔잔한 발라드',
    seconds: 60,
    src: '/songs/sample-ballad-b.mp3',
    art: 'album_lighthouse',
  },
];

export function sampleLength(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
