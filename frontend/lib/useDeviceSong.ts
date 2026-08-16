'use client';

import { useCallback, useEffect, useState } from 'react';
import { songTitleForTopic } from './scenes';
import {
  SERVER_SESSION,
  cacheServerSong,
  loadSong,
  loadSongAt,
  readSongShelf,
  saveSongLyrics,
  songTag,
  type SongMeta,
} from './songStore';
import {
  backfillSongLyrics,
  downloadServerSong,
  listServerSongs,
  matchesHash,
  pushSongLyrics,
} from './songSync';
import { downloadBlob, safeFileName } from './export';
import { currentSession } from './store';

export type DeviceSong = {
  /** 이 기기에 있는 곡의 재생 주소. 없으면 null. */
  url: string | null;
  /** 아직 기기 보관함을 읽는 중. "곡이 없다"와는 다른 상태다. */
  loading: boolean;
};

/** 위에 '다시 읽기'를 얹은 것. 화면이 받는 값이다. */
export type DeviceSongState = DeviceSong & { reload: () => void };

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
export function useDeviceSongState(
  /**
   * 특정 곡을 걸 때 그 칸 이름.
   *
   * 없으면 예전 그대로 이번 회기의 곡을 찾는다. 보관함에서 지난 곡을 골라
   * 「함께 부르기」로 열 때만 이 값이 들어온다 — 회기 상태를 건드리지 않고
   * 그 곡만 재생하기 위해서다. 회기 상태를 덮으면 진행 중인 회기가 망가진다.
   */
  key?: string | null,
): DeviceSongState {
  const [song, setSong] = useState<DeviceSong>({ url: null, loading: true });
  /*
   * 곡이 화면 밖에서 바뀌면 다시 읽어야 한다. 지금은 「다른 연주로 바꾸기」가
   * 그 경우다 — 회기의 곡이 통째로 갈리는데, 다시 읽지 않으면 앞 연주가
   * 계속 흐른다.
   */
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let made: string | null = null;
    let alive = true;

    // 값은 오직 아래 콜백에서만 바뀐다. 이펙트 본문에서 미리 상태를 되돌려
    // 놓지 않는 이유: 이 훅의 시작 상태가 이미 '읽는 중'이고, 이펙트가 다시
    // 도는 경우(개발 모드 이중 마운트)에도 정리가 곧바로 이어지므로 그 사이에
    // IndexedDB 가 답할 틈이 없다 — made 가 null 이라 되돌릴 주소도 없다.
    void (key ? loadSongAt(key) : loadSong())
      .then(async (blob) => {
        if (!alive) return;
        if (!blob) {
          // 기기에 없으면 기관 저장소를 본다. 이어받은 회기가 여기로 온다.
          const fetched = await sessionSongFromServer().catch(() => null);
          if (!alive) return;
          if (!fetched) {
            setSong({ url: null, loading: false });
            return;
          }
          made = URL.createObjectURL(fetched);
          setSong({ url: made, loading: false });
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
  }, [nonce, key]);

  return { ...song, reload };
}

/**
 * 이 회기의 곡을 기관 저장소에서 찾아 온다 — 가사 지문으로 맞춰서.
 *
 * ── 왜 필요한가
 *
 * 곡은 '어르신 + 회기 칸'으로 기기에 저장된다(songStore). 회기 칸은 회기를 연
 * 시각이라, 다른 태블릿에서 이어받으면 그 칸이 없다. 그래서 보관함에서 곡을
 * 받아 와도 「함께 부르기」와 「미리듣기」는 "이 기기에 곡 파일이 없어요"라고
 * 했다 — 곡이 바로 그 기기에 있는데도. 어르신 앞에서 노래를 들려드리는 자리라
 * 이 구멍이 제일 나쁘다.
 *
 * ── 무엇을 근거로 '이 회기의 곡'이라 하는가
 *
 * 가사 지문이다. 서버 행에 그 곡을 만든 가사의 지문(lyrics_hash)이 있고,
 * 지금 회기의 가사로 같은 지문을 다시 만들어 견준다. 같으면 같은 가사로 만든
 * 곡이니 이 회기의 곡이 맞다.
 *
 * 시각이나 '가장 최근'으로 고르지 않는다. 그러면 다른 회기의 곡이 이 회기에
 * 딸려 올 수 있고, 그건 어르신 앞에서 남의 생애로 만든 노래를 트는 일이다.
 * 지문이 다르면 아무것도 돌려주지 않는다.
 */
async function sessionSongFromServer(): Promise<Blob | null> {
  const s = currentSession();
  if (!s.lyrics.length) return null;

  const rows = await listServerSongs();
  if (!rows?.length) return null;

  for (const row of rows) {
    // 지문은 분위기까지 넣어 만든다(songSync.lyricsHash). 서버 행이 들고 있는
    // 분위기로 계산해야 같은 자리에서 만든 값과 견줄 수 있다.
    if (!(await matchesHash(s.lyrics, row.style, row.hash))) continue;

    const blob = await downloadServerSong(row.path);
    if (!blob) return null;

    /*
     * 받은 김에 이 회기의 곡으로 기기에 남긴다. 다음에 「함께 부르기」를 열 때
     * 통신을 기다리지 않는다 — 어르신 앞에서 재생을 누르는 자리다.
     */
    void cacheServerSong(blob, {
      ownerId: s.remoteParticipantId ?? s.elder.id,
      sessionId: s.remoteStartedAt ?? 'demo',
      madeAt: row.madeAt,
      topic: row.topic,
      cover: row.cover,
      style: row.style,
      hash: row.hash,
      lyrics: row.lyrics,
    });
    return blob;
  }
  return null;
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
   * 말하는 화면은 복지사에게 한 번 더 만들라고 권하는 것과 같다 — 요금도
   * 요금이지만, 어르신 앞에서 같은 일을 두 번 하게 만든다.
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
export function useSongShelf(
  /**
   * 누구의 보관함인가. 없으면 지금 회기의 어르신 — 예전 동작 그대로다.
   *
   * 기록에서 「보는 어르신」을 바꾸면 이 값이 들어온다. 회기는 그대로 두고
   * 읽는 대상만 갈린다(lib/viewElder).
   */
  ownerId?: string,
): SongShelfState {
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

    void readSongShelf(ownerId)
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

        /*
         * 가사 칸이 생기기 전에 만든 곡에 가사를 뒤늦게 붙인다. 그 곡들은
         * 「함께 부르기」가 안 떴다 — 기능은 있는데 열 수 있는 곡이 없었다.
         * 한 번 채우면 다음부터는 채울 것이 없어 바로 지나간다.
         */
        await backfillSongLyrics(ownerId).catch(() => 0);
        const server = await listServerSongs(ownerId).catch(() => null);
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
        /*
         * ── 계정이 원본, 기기는 사본
         *
         * 예전에는 화면이 기기 사본을 그리고 서버는 없는 것만 채웠다. 그래서
         * 기기 사본이 낡으면 서버를 고쳐도 화면이 안 고쳐졌다 — 다른 회기의
         * 가사가 붙은 곡이 정확히 그랬다. 서버에서 떼어 냈는데도 이 태블릿에는
         * 그대로 떠 있었다.
         *
         * 순서를 뒤집는다. 서버를 읽을 수 있었다면 **서버 말이 이긴다.** 기기
         * 사본은 오프라인일 때와 파일 재생을 위해 남는다.
         *
         * 다만 기기가 더 아는 경우가 있다 — 통신이 끊긴 채로 만든 곡, 가사 칸이
         * 생기기 전에 올라간 곡이다. 그때는 덮지 않고 **빈자리를 채워 올린다.**
         *
         * 가사는 어느 쪽에서 왔든 지문을 확인하고 받는다. 서버 값이라고 그냥
         * 믿지 않는다 — 잘못 붙은 가사가 서버에 있었던 적이 이미 있다.
         */
        const srv = new Map(
          server.filter((r) => r.hash).map((r) => [r.hash as string, r]),
        );

        for (const m of mine) {
          const row = m.hash ? srv.get(m.hash) : undefined;

          // 곁들이 값은 서버가 아는 것만 따른다. 서버가 모르는 자리를 null 로
          // 덮으면, 기기가 들고 있던 주제·표지가 사라진다.
          if (row) {
            if (row.topic !== null) m.topic = row.topic;
            if (row.cover !== null) m.cover = row.cover;
            if (row.style !== null) m.style = row.style;
            if (row.madeAt !== null) m.madeAt = row.madeAt;
          }

          const ok = await matchesHash(row?.lyrics, row?.style ?? m.style, m.hash);
          if (ok && row?.lyrics) {
            // 서버 가사가 원본이다. 기기 것과 다르면 덮고, 기기 표에도 남긴다 —
            // 다음에 열 때 통신을 기다리지 않고 「함께 부르기」가 뜬다.
            if (JSON.stringify(m.lyrics ?? null) !== JSON.stringify(row.lyrics)) {
              m.lyrics = row.lyrics;
              void saveSongLyrics(m.key, row.lyrics);
            }
            continue;
          }

          // 여기부터는 서버에 쓸 만한 가사가 없다. 기기 것을 확인한다.
          if (!m.lyrics?.length) continue;
          if (!(await matchesHash(m.lyrics, m.style, m.hash))) {
            m.lyrics = null;
            void saveSongLyrics(m.key, null);
            continue;
          }
          // 지문이 맞는 가사를 기기만 들고 있다. 계정에 올려 둔다.
          if (row && m.hash) void pushSongLyrics(m.hash, m.lyrics, ownerId);
        }

        const here = new Set(
          mine.map((m) => m.hash).filter((h): h is string => typeof h === 'string' && h.length > 0),
        );
        const owner = ownerId ?? songTag().ownerId;
        const extra: ShelfItem[] = server
          .filter((r) => !r.hash || !here.has(r.hash))
          .map((r) => ({
            key: `srv:${r.id}`,
            ownerId: owner,
            // 서버 목록에서 온 곡도 가사를 들고 온다. 없으면 보관함의
            // 「함께 부르기」가 안 뜬다(가사 없는 곡은 노래방을 못 연다).
            lyrics: r.lyrics,
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
  }, [nonce, ownerId]);

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

/* ------------------------------------------------------------------ *
 * 노래 파일 받기
 *
 * 곡은 어르신께 드리는 결과물이다. 앱 안에서만 들을 수 있으면 드린 것이
 * 아니다 — 가족께 보내 드리고, 기관 일지에 첨부하고, 종강 잔치에서 트는
 * 자리가 전부 앱 밖이다.
 * ------------------------------------------------------------------ */

/** 파일 확장자. 실제로 받은 소리 형식을 따른다 — 이름만 mp3 로 적지 않는다. */
function audioExt(type: string): string {
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a';
  if (type.includes('wav')) return 'wav';
  if (type.includes('ogg')) return 'ogg';
  return 'mp3';
}

/**
 * 이 곡의 파일 이름.
 *
 * 어르신 표기는 화면에 쓰는 그대로 넣는다(박○○). 파일은 앱 밖으로 나가므로
 * 여기서 이름이 늘어나면 안 된다 — 가려 적는 자리가 무너진다.
 *
 * 날짜를 모르면 날짜를 빼고 적는다. 오늘 날짜를 붙이면, 3년 전 노래가 오늘
 * 만든 것처럼 보이는 파일이 기관 폴더에 남는다.
 */
export function songFileName(elder: string, m: SongMeta, type: string): string {
  const date = m.madeAt === null ? null : new Date(m.madeAt);
  const stamp =
    date && !Number.isNaN(date.getTime())
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
          date.getDate(),
        ).padStart(2, '0')}`
      : null;
  const parts = [elder, shelfSongTitle(m), stamp].filter(Boolean).join(' ');
  return `${safeFileName(parts)}.${audioExt(type)}`;
}

/**
 * 곡 파일을 기기에 내려받는다.
 *
 * 기기에 사본이 있으면 그것으로, 없으면 계정 저장소에서 받아서 준다. 복지사
 * 입장에서는 둘이 같은 버튼이어야 한다 — 어느 태블릿에서 만든 곡인지는 파일을
 * 드리는 일과 상관이 없다.
 */
export async function downloadShelfSong(elder: string, m: ShelfItem): Promise<boolean> {
  const blob = m.path ? await downloadServerSong(m.path) : await loadSongAt(m.key);
  if (!blob) return false;
  downloadBlob(songFileName(elder, m, blob.type), blob);
  return true;
}

/** '2026년 8월 10일'. 만든 시각을 모르면 null — 날짜를 지어내지 않는다. */
export function shelfSongDate(m: SongMeta): string | null {
  if (m.madeAt === null) return null;
  const d = new Date(m.madeAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
