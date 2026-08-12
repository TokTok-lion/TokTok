'use client';

import { useCallback, useEffect, useState } from 'react';
import { songTitleForTopic } from './scenes';
import {
  SERVER_SESSION,
  loadSong,
  readSongShelf,
  songTag,
  type SongMeta,
} from './songStore';
import { listServerSongs } from './songSync';

export type DeviceSong = {
  /** 이 기기에 있는 곡의 재생 주소. 없으면 null. */
  url: string | null;
  /** 아직 기기 보관함을 읽는 중. "곡이 없다"와는 다른 상태다. */
  loading: boolean;
};

/**
 * 이 기기에 있는 곡 — 읽는 중인지까지 알려준다.
 *
 * 보관함과 기록이 같은 답을 해야 한다. 한쪽은 "세 곡 완성", 다른 쪽은
 * "아직 없어요"라고 하면 둘 다 못 믿는다.
 *
 * 여기서 말하는 '이 기기에 있는 곡'은 **이번 회기의 곡**이다(loadSong). 회기
 * 화면(미리듣기·노래 완성·함께 부르기)은 오늘 만든 곡을 들려주는 자리라
 * 그게 맞고, 지난 회기 곡은 보관함이 목록으로 보여 준다.
 *
 * loading 을 따로 두는 이유가 있다. IndexedDB 는 한 박자 늦게 답하는데 그
 * 사이를 "곡 없음"으로 그리면, 화면이 곡 없음 분기를 먼저 그렸다가 뒤늦게
 * 플레이어로 바뀐다. 미리듣기 화면에서는 그 찰나에 푸터 버튼이 통째로
 * 바뀌어서, 어르신 앞에서 손이 닿으면 곡이 있는데도 재생성 화면으로 튕겼다 —
 * 곡을 한 번 더 만드는 자리이니 요금이 걸린 사고다. 모르는 동안에는 모른다고
 * 말하게 한다.
 */
export function useDeviceSongState(): DeviceSong {
  const [song, setSong] = useState<DeviceSong>({ url: null, loading: true });

  useEffect(() => {
    let made: string | null = null;
    let alive = true;

    // 값은 오직 아래 콜백에서만 바뀐다. 이펙트 본문에서 미리 상태를 되돌려
    // 놓지 않는 이유: 이 훅의 시작 상태가 이미 '읽는 중'이고, 이펙트가 다시
    // 도는 경우(개발 모드 이중 마운트)에도 정리가 곧바로 이어지므로 그 사이에
    // IndexedDB 가 답할 틈이 없다 — made 가 null 이라 되돌릴 주소도 없다.
    void loadSong()
      .then((blob) => {
        if (!alive) return;
        if (!blob) {
          setSong({ url: null, loading: false });
          return;
        }
        made = URL.createObjectURL(blob);
        setSong({ url: made, loading: false });
      })
      .catch(() => {
        // 못 읽었으면 없는 것으로 본다. 계속 "불러오는 중"에 머무르면 화면이
        // 영영 끝나지 않고, 그게 어르신 앞에서는 고장이다.
        if (alive) setSong({ url: null, loading: false });
      });

    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, []);

  return song;
}

/** 재생 주소만 있으면 되는 화면용. */
export function useDeviceSong(): string | null {
  return useDeviceSongState().url;
}

/* ------------------------------------------------------------------ *
 * 지금 어르신의 노래 목록
 * ------------------------------------------------------------------ */

/**
 * 목록에 놓이는 곡 한 줄.
 *
 * 기기에 있는 곡과 기관 저장소에만 있는 곡이 한 목록에 섞인다. 어느 쪽인지
 * 감추지 않는다 — 서버에만 있는 곡은 누르면 그때 내려받느라 몇 초가 걸리고,
 * 그 몇 초가 설명 없이 오면 고장으로 보인다.
 */
export type ShelfItem = SongMeta & {
  where: 'device' | 'server';
  /** 서버에만 있는 곡의 파일 위치. 누를 때 이걸로 내려받는다. */
  path?: string;
};

/** 기관 저장소를 읽었는가. 'off' 는 서버를 안 쓰거나 못 읽었다는 뜻이다. */
export type SharedState = 'loading' | 'ok' | 'off';

export type SongShelfState = {
  /** 지금 어르신의 곡. 이번 회기 → 최근 순. 기기 것과 서버 것이 함께 있다. */
  songs: ShelfItem[];
  /** 그중 이 기기에 파일이 있는 곡의 수. 저장 공간 셈에 쓴다. */
  mine: number;
  /**
   * 기관 저장소 쪽 상태.
   *
   * 'off' 를 "다른 기기 곡이 없다"로 그리면 안 된다. 서버에 있는 곡을 없다고
   * 말하는 화면은 복지사에게 한 번 더 만들라고 권하는 것과 같고, 곡 하나가
   * 1,125크레딧이다.
   */
  shared: SharedState;
  /** 이 기기에 있는 모든 곡의 수·용량 (다른 어르신 것 포함, 내용은 열지 않는다) */
  total: number;
  totalBytes: number;
  /** 지금 회기 — 목록에서 '이번 회기' 곡을 가려낸다 */
  sessionId: string;
  loading: boolean;
  /**
   * 보관함을 읽을 수 있었는가. false 는 "곡이 없다"가 아니라 "못 읽었다"다.
   *
   * 사파리 프라이빗 모드처럼 IndexedDB 가 막힌 기기가 있다. 그때 "아직
   * 노래가 없어요"라고 적으면, 화면이 곡을 만들라고 권하게 되고 그건 요금이
   * 나가는 권유다.
   */
  available: boolean;
  /** 지운 뒤 다시 읽는다. 목록과 실제 보관함이 어긋나면 안 된다. */
  reload: () => void;
};

/** 이번 회기 → 최근 순. 만든 시각을 모르는 곡은 맨 뒤로. */
function shelfOrder(sessionId: string) {
  return (a: ShelfItem, b: ShelfItem): number => {
    const at = a.sessionId === sessionId ? 0 : 1;
    const bt = b.sessionId === sessionId ? 0 : 1;
    if (at !== bt) return at - bt;
    if (a.madeAt === null && b.madeAt === null) return 0;
    if (a.madeAt === null) return 1;
    if (b.madeAt === null) return -1;
    return b.madeAt - a.madeAt;
  };
}

/**
 * 보관함·기록 화면이 함께 쓰는 목록. 파일은 읽지 않고 표만 읽는다.
 *
 * ── 왜 서버까지 읽는가
 *
 * 곡은 진작부터 기관 저장소에 올라가고 있었는데(songSync.uploadSong) 이
 * 목록은 기기만 읽었다. 그래서 A 태블릿에서 만든 노래가 B 태블릿에서는
 * 통째로 안 보였다 — 같은 기관으로 로그인해도 마찬가지였다. 센터에 태블릿이
 * 두 대면 그건 "공유가 안 된다"는 뜻이고, 기관 단위로 파는 서비스에서 그건
 * 기능이 없는 것과 같다.
 *
 * 두 걸음으로 읽는다. 기기 목록을 먼저 그리고, 서버 목록은 도착하는 대로
 * 끼워 넣는다. 통신을 기다렸다가 한꺼번에 그리면, 내 기기에 있는 곡을 보는
 * 데도 센터 와이파이를 기다려야 한다.
 */
export function useSongShelf(): SongShelfState {
  const [nonce, setNonce] = useState(0);
  const [shelf, setShelf] = useState<Omit<SongShelfState, 'reload'>>({
    songs: [],
    mine: 0,
    total: 0,
    totalBytes: 0,
    sessionId: '',
    loading: true,
    available: false,
    shared: 'loading',
  });

  useEffect(() => {
    let alive = true;

    void readSongShelf()
      .then(async (s) => {
        if (!alive) return;
        const mine: ShelfItem[] = s.songs.map((m) => ({ ...m, where: 'device' }));
        setShelf({
          songs: mine,
          mine: mine.length,
          total: s.total,
          totalBytes: s.totalBytes,
          sessionId: s.sessionId,
          loading: false,
          available: s.available,
          shared: 'loading',
        });

        const server = await listServerSongs().catch(() => null);
        if (!alive) return;
        if (!server) {
          setShelf((p) => ({ ...p, shared: 'off' }));
          return;
        }

        /*
         * 같은 곡이 두 줄로 나오지 않게 접는다.
         *
         * 근거는 가사 지문(hash) 하나뿐이다. 주제·분위기·시각이 비슷하다고
         * 같은 곡으로 묶지 않는다 — 「다시 만들기」로 나온 곡은 같은 주제,
         * 같은 분위기에 몇 분 차이로 만들어지는데, 그건 엄연히 다른 곡이다.
         * 그걸 접으면 어르신의 노래 한 곡이 목록에서 사라진다. 잘못 접는 쪽이
         * 두 번 보이는 쪽보다 훨씬 나쁘다.
         */
        const here = new Set(
          mine.map((m) => m.hash).filter((h): h is string => typeof h === 'string' && h.length > 0),
        );
        const owner = songTag().ownerId;
        const extra: ShelfItem[] = server
          .filter((r) => !r.hash || !here.has(r.hash))
          .map((r) => ({
            key: `srv:${r.id}`,
            ownerId: owner,
            sessionId: SERVER_SESSION,
            madeAt: r.madeAt,
            topic: r.topic,
            cover: r.cover,
            style: r.style,
            // 서버 표에는 파일 크기가 없다. 재지 않은 값을 적지 않는다 —
            // 저장 공간 셈(total·totalBytes)도 기기 것만 센다.
            bytes: 0,
            hash: r.hash,
            where: 'server',
            path: r.path,
          }));

        setShelf((p) => ({
          ...p,
          songs: [...mine, ...extra].sort(shelfOrder(s.sessionId)),
          shared: 'ok',
        }));
      })
      .catch(() => {
        // 못 읽은 것을 '없음'으로 그리지 않는다. available 이 false 로 남아
        // 화면이 그 사실을 말한다.
        if (alive) setShelf((p) => ({ ...p, loading: false, available: false, shared: 'off' }));
      });

    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...shelf, reload };
}

/* ------------------------------------------------------------------ *
 * 목록이 곡을 부르는 말
 *
 * 보관함과 기록이 같은 곡을 다르게 부르면 두 화면이 서로 다른 말을 하는
 * 것이 된다. 한 곳에서 정한다.
 * ------------------------------------------------------------------ */

/**
 * 목록에 쓰는 제목.
 *
 * 주제를 모르는 곡(판올림 전에 저장돼 주제가 남지 않은 곡)에는 제목을 지어
 * 붙이지 않는다. songTitleForTopic 은 빈 주제에 '오늘의 노래'를 돌려주는데,
 * 몇 해 전 곡에 그 이름이 붙으면 목록이 거짓말을 한다.
 */
export function shelfSongTitle(m: SongMeta): string {
  return m.topic ? songTitleForTopic(m.topic) : '주제가 남지 않은 노래';
}

/** '2026년 8월 10일'. 만든 시각을 모르면 null — 날짜를 지어내지 않는다. */
export function shelfSongDate(m: SongMeta): string | null {
  if (m.madeAt === null) return null;
  const d = new Date(m.madeAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
