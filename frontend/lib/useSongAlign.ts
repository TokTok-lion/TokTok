'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { currentSongMeta, loadSong, saveCues } from './songStore';
import { getSupabase } from './supabase';

/**
 * 이 곡의 가사 줄이 몇 초에 불리는지 — 잰 값을 구해 온다.
 *
 * ── 왜
 *
 * 함께 부르기 화면의 "지금 이 줄"은 글자 수로 나눈 어림이었다. 전주가 길거나
 * 후렴이 늘어지면 어긋난다. 여러 어르신이 한 화면을 건너다보며 부르는
 * 자리에서 글자가 어긋나면 그 순간 노래방이 아니게 된다.
 *
 * ── 곡마다 한 번
 *
 * 맞춘 결과는 곡에 붙여 저장한다(songStore.saveCues). 다음부터는 그걸 읽고
 * 끝이라, 인식 요금도 기다림도 한 번뿐이다.
 *
 * 어느 가사에 맞춘 것인지도 함께 둔다. 가사를 고치면 그 시각은 남의 가사의
 * 시각이 되므로 안 쓴다 — 고친 가사에 옛 시각을 붙이면, 화면은 잰 값이라고
 * 믿으면서 어림보다 더 어긋난 자리를 짚는다.
 *
 * ── 못 맞추면 조용히 물러난다
 *
 * 노래하는 목소리는 알아듣기 어렵고, 실패할 수 있다. 실패하면 아무 말도
 * 하지 않고 예전 어림으로 남는다 — 화면은 계속 "어림"이라고 적고 있다.
 * 복지사가 할 수 있는 일이 없는 실패를 화면에 띄우면 걱정만 는다.
 */

export type AlignState =
  /** 이 곡에 붙은 표를 아직 못 읽었다. */
  | 'checking'
  /** 잰 값이 있다. 화면이 그걸 쓴다. */
  | 'ready'
  /** 지금 맞추는 중. */
  | 'running'
  /** 맞출 수 없었다. 어림으로 남는다. */
  | 'none';

export type SongAlign = {
  state: AlignState;
  /** 줄마다 시작 시각(초). 없으면 null — 화면은 어림을 쓴다. */
  cues: number[] | null;
  /** 복지사가 다시 맞추게 할 때. */
  run: () => void;
};

/** 어느 가사에 맞춘 것인지 — 줄 내용이 바뀌면 값이 바뀐다. */
function hashOf(lines: string[]): string {
  return lines.join('\n');
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const sb = getSupabase();
    if (!sb) return {};
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

type AlignReply = {
  aligned?: boolean;
  starts?: number[];
  job?: string;
  error?: string;
};

/**
 * 곡을 보내고 맞추기를 건다. 실패는 null 이다.
 *
 * 곡 파일을 그대로 올린다. 브라우저가 저장소로 바로 올리는 길(녹음이 쓰는
 * 길)은 저장소 CORS 설정에 달려 있고 지금 배포에서는 막혀 있는데, 노래는
 * 3~4MB 라 함수를 지나갈 수 있다(Vercel 본문 한도 4.5MB).
 */
const MAX_BYTES = 4 * 1024 * 1024;

async function measure(lines: string[], duration: number): Promise<number[] | null> {
  const blob = await loadSong();
  if (!blob || blob.size > MAX_BYTES) return null;
  const auth = await authHeader();

  const call = async (body: Record<string, unknown>) =>
    fetch('/api/align', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ ...body, lines, duration }),
    }).catch(() => null);

  const form = new FormData();
  form.append('file', blob, 'song.mp3');
  form.append('lines', JSON.stringify(lines));
  form.append('duration', String(duration));
  let res = await fetch('/api/align', {
    method: 'POST',
    headers: auth,
    body: form,
  }).catch(() => null);
  /*
   * 202 는 "아직"이다. 표를 들고 다시 묻는다. 곡은 3분 안쪽이라 오래 걸리지
   * 않지만, 몇 번 물어볼지는 한도를 둔다 — 끝나지 않는 작업에 화면이 매달려
   * 있으면 회기가 그 자리에서 멈춘다.
   */
  for (let i = 0; i < 4 && res?.status === 202; i += 1) {
    const { job } = (await res.json().catch(() => ({}))) as AlignReply;
    if (!job) return null;
    res = await call({ job });
  }
  if (!res?.ok) return null;

  const out = (await res.json().catch(() => null)) as AlignReply | null;
  if (!out?.aligned || !Array.isArray(out.starts)) return null;
  if (out.starts.length !== lines.length) return null;
  return out.starts;
}

export function useSongAlign(lines: string[], duration: number): SongAlign {
  const [state, setState] = useState<AlignState>('checking');
  const [cues, setCues] = useState<number[] | null>(null);
  /** 이 가사로 이미 한 번 걸었는가. 같은 곡에 요금을 두 번 쓰지 않는다. */
  const tried = useRef<string>('');
  const key = hashOf(lines);

  const load = useCallback(async () => {
    const meta = await currentSongMeta().catch(() => null);
    if (!meta) return { meta: null, cues: null };
    const ok =
      Array.isArray(meta.cues) &&
      meta.cues.length === lines.length &&
      meta.cueHash === key;
    return { meta, cues: ok ? (meta.cues as number[]) : null };
  }, [key, lines.length]);

  const run = useCallback(async () => {
    const { meta } = await load();
    if (!meta) {
      setState('none');
      return;
    }
    setState('running');
    const starts = await measure(lines, duration);
    if (!starts) {
      setState('none');
      return;
    }
    void saveCues(meta.key, starts, key);
    setCues(starts);
    setState('ready');
  }, [load, lines, duration, key]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // 곡 길이를 아직 모르면 기다린다. 못 걸린 뒷줄을 채울 근거가 없다.
      if (lines.length < 2 || duration <= 0) {
        if (alive) setState('checking');
        return;
      }
      const found = await load();
      if (!alive) return;
      if (found.cues) {
        setCues(found.cues);
        setState('ready');
        return;
      }
      if (tried.current === key) {
        setState('none');
        return;
      }
      tried.current = key;
      await run();
    })();
    return () => {
      alive = false;
    };
  }, [key, lines.length, duration, load, run]);

  return {
    state,
    cues,
    run: useCallback(() => {
      tried.current = '';
      void run();
    }, [run]),
  };
}
