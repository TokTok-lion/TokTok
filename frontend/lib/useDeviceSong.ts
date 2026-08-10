'use client';

import { useCallback, useEffect, useState } from 'react';
import { songTitleForTopic } from './scenes';
import { loadSong, readSongShelf, type SongMeta } from './songStore';

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

export type SongShelfState = {
  /** 지금 어르신의 곡. 이번 회기 → 최근 순. */
  songs: SongMeta[];
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

/** 보관함·기록 화면이 함께 쓰는 목록. 파일은 읽지 않고 표만 읽는다. */
export function useSongShelf(): SongShelfState {
  const [nonce, setNonce] = useState(0);
  const [shelf, setShelf] = useState<Omit<SongShelfState, 'reload'>>({
    songs: [],
    total: 0,
    totalBytes: 0,
    sessionId: '',
    loading: true,
    available: false,
  });

  useEffect(() => {
    let alive = true;
    void readSongShelf()
      .then((s) => {
        if (!alive) return;
        setShelf({
          songs: s.songs,
          total: s.total,
          totalBytes: s.totalBytes,
          sessionId: s.sessionId,
          loading: false,
          available: s.available,
        });
      })
      .catch(() => {
        // 못 읽은 것을 '없음'으로 그리지 않는다. available 이 false 로 남아
        // 화면이 그 사실을 말한다.
        if (alive) setShelf((p) => ({ ...p, loading: false, available: false }));
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
