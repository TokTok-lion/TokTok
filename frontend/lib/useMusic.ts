'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MUSIC_STYLES, hasConsent } from './domain';
import { settled } from './longJob';
import { loadSong, saveSong } from './songStore';
import { findServerSong, lyricsHash, songQuotaLeft, uploadSong } from './songSync';
import { currentSession, useSession, type SessionState } from './store';
import { useDeviceSongState } from './useDeviceSong';

export type MusicState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done' }
  /**
   * 만들지 않았다. 이미 있던 곡을 그대로 쓴다 — 이 기기에 있었거나(device),
   * 다른 태블릿에서 만든 것을 기관 서버에서 받아왔거나(server).
   * 화면이 "만들었다"고 말하면 안 되는 경우라 done 과 구분한다.
   */
  | { kind: 'reused'; where: 'device' | 'server' }
  /** 요금제 문제 — 고장이 아니므로 다르게 안내한다 */
  | { kind: 'needsPaidPlan'; message: string }
  /** 이번 달 무료 한도를 다 씀 */
  | { kind: 'quotaSpent'; message: string }
  | { kind: 'error'; message: string };

/**
 * 이 표시가 누구의 어느 회기 것인지.
 *
 * 곡 보관 칸(songStore.slotKey)과 같은 기준으로 사람을 가리키고, 거기에
 * 회기 시작 시각을 붙여 회기까지 좁힌다. 시연 기기는 시작 시각이 없으므로
 * 한 칸으로 묶는다.
 */
function askOwner(s: SessionState): string {
  return `${s.remoteParticipantId ?? s.elder.id}::${s.remoteStartedAt ?? 'demo'}`;
}

/**
 * "다시 만들기를 눌렀다"는 표시.
 *
 * 재생성 의사는 화면을 하나 건너서 전달돼야 한다 — 누르는 곳은 미리듣기고,
 * 실제로 만드는 곳은 노래 만드는 중 화면이다. 예전에는 그냥 그 화면으로
 * 보내기만 해서, 캐시가 곧바로 같은 곡을 돌려주고 "다시 만들었는데 똑같다"가
 * 됐다.
 *
 * 세션 상태에 남기지 않고 모듈 안에 둔 이유가 있다. 저장소에 남기면
 * 새로고침 뒤에도 살아남아, 아무도 누르지 않은 재생성에 크레딧이 나간다.
 * 새로고침하면 그냥 없어지는 쪽이 안전하다. 한 번 읽으면 사라진다.
 *
 * 다만 표시만 남기면 안 되고 주인을 함께 남겨야 한다. 예전에는 그냥 불리언
 * 이라, 동의가 없어 generate() 가 앞에서 빠지면 표시가 그대로 남았다. 그
 * 상태로 다음 어르신이 처음 곡을 만들면 remake=true 로 시작해 기기·서버
 * 중복 확인을 건너뛴다 — 이미 있는 곡에 요금이 한 번 더 나가는 길이다.
 * 그래서 누른 사람의 회기에서만 유효하고, 남의 회기에서는 그냥 버려진다.
 */
let regenerateAsked: string | null = null;

export function askRegenerate(): void {
  regenerateAsked = askOwner(currentSession());
}

function takeRegenerateAsk(): boolean {
  const asked = regenerateAsked;
  regenerateAsked = null;
  return asked !== null && asked === askOwner(currentSession());
}

/**
 * 가사로 곡 만들기.
 *
 * 가사에는 어르신의 생애가 담겨 있으므로 외부 AI 전송 동의(C-02) 없이는
 * 부르지 않는다. 동의가 없으면 곡을 못 만드는 것이지 회기가 멈추는 것은
 * 아니다 — 가사 카드까지는 그대로 드릴 수 있다.
 */
export function useMusic() {
  const { s, set } = useSession();
  const [state, setState] = useState<MusicState>({ kind: 'idle' });

  const allowed = hasConsent(s.elder.consents, 'externalAi');

  /**
   * force 는 "같은 가사로 다른 느낌의 곡을 다시 받고 싶다"는 뜻이다.
   * 그때는 750크레딧을 다시 쓰는 것이 맞다 — 막아야 할 것은 의도치 않은
   * 재생성이지, 사람이 일부러 누르는 다시 만들기가 아니다.
   */
  const generate = useCallback(async (force = false) => {
    // 훅이 준 s 가 아니라 지금 저장소를 읽는다. 이 함수는 화면이 뜨자마자
    // 이펙트에서 불리는데, 그 시점의 s 는 아직 복원 전 값일 수 있다.
    const now = currentSession();

    // 동의도 그 값으로 본다. 복원 전 값은 시연용 씨앗 어르신(전부 허용)이라,
    // 렌더 시점의 allowed 로 판단하면 동의하지 않으신 어르신의 가사가 실제로
    // 외부 사업자에게 나갈 수 있다. 화면 표시용 allowed 와 실제 게이트를
    // 나눠 두는 이유가 이것이다.
    if (!hasConsent(now.elder.consents, 'externalAi')) {
      setState({
        kind: 'error',
        message: '외부 AI 전송에 동의하지 않으셔서 곡은 만들지 않아요.',
      });
      return;
    }

    // 앞 화면에서 "다시 만들기"를 누르고 왔으면 그것도 다시 만들기다.
    // 동의 확인보다 뒤에서 읽는다 — 곡을 못 만드는 경우에 표시만 소모하면
    // 나중에 진짜로 누른 재생성이 캐시에 걸린다. 표시에 주인이 붙어 있으므로
    // 여기 남아도 다른 어르신 회기로는 넘어가지 않는다.
    const remake = force || takeRegenerateAsk();

    // 가사 검수 화면에서 만든 그 가사가 그대로 노래가 된다.
    const lyrics = now.lyrics
      .map((sec) => `[${sec.label}]\n${sec.lines.join('\n')}`)
      .join('\n\n');

    const style = now.style ?? 'ballad';
    const key = `${style}::${lyrics}`;

    // 곡 하나가 1,125크레딧이라, 만들기 전에 두 곳을 먼저 본다.
    //
    //   1) 이 기기  — 새로고침이나 뒤로가기로 다시 들어온 경우
    //   2) 기관 서버 — 다른 태블릿에서 이미 만든 경우
    //
    // 2가 없으면 태블릿을 바꿀 때마다 같은 곡에 요금이 또 나간다.
    if (!remake && now.songKey === key && (await loadSong())) {
      set('songStatus', 'ready');
      // 만든 것이 아니라 있던 것을 찾은 것이다. 화면이 이 둘을 구분해서
      // 말해야 한다 — 안 만들었는데 만들었다고 하면 그것도 거짓말이다.
      setState({ kind: 'reused', where: 'device' });
      return;
    }

    setState({ kind: 'working' });
    set('songStatus', 'generating');

    const hash = await lyricsHash(lyrics, style);
    if (!remake) {
      const fromServer = await findServerSong(hash);
      if (fromServer) {
        await saveSong(fromServer);
        set('songKey', key);
        set('songStatus', 'ready');
        setState({ kind: 'reused', where: 'server' });
        return;
      }
    }

    // 여기서부터 진짜로 크레딧이 나간다. 그 전에 이번 달 한도를 본다 —
    // 만든 뒤에 막으면 이미 늦다. 서버를 안 쓰면 null 이고 한도도 없다.
    const left = await songQuotaLeft();
    if (left !== null && left <= 0) {
      setState({
        kind: 'quotaSpent',
        message:
          '이번 달 무료 노래를 다 만드셨어요. 다음 달에 다시 만드실 수 있고, ' +
          '지금 필요하시면 요금제를 올려 주세요.',
      });
      set('songStatus', 'draft');
      return;
    }

    try {
      // 곡 만들기는 1~3분이 걸린다. 서버가 작업 번호를 주면 끝날 때까지
      // 대신 물어봐 준다 — 화면은 그동안 진행률만 보여 준다.
      const res = await settled(
        await fetch('/api/music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            style: now.style ?? 'ballad',
            lyrics,
            title: now.topic,
          }),
        }),
        (job) => `/api/music?job=${encodeURIComponent(job)}`,
      );

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          needsPaidPlan?: boolean;
        };
        setState(
          j.needsPaidPlan
            ? { kind: 'needsPaidPlan', message: j.error ?? '유료 요금제가 필요해요.' }
            : { kind: 'error', message: j.error ?? '곡을 만들지 못했어요.' },
        );
        set('songStatus', 'draft');
        return;
      }

      const blob = await res.blob();
      await saveSong(blob);
      set('songKey', key);
      set('songStatus', 'ready');
      setState({ kind: 'done' });

      // 기관 저장소에도 올린다. 실패해도 회기를 막지 않는다 — 곡은 이미
      // 기기에 있고, 다음에 로그인된 상태로 열면 다시 올라간다.
      void uploadSong(blob, hash, {
        title: now.topic,
        style,
        lengthMs: Number(res.headers.get('X-Music-Length-Ms')) || 0,
        sessionId: now.remoteSessionId,
      });
    } catch {
      setState({ kind: 'error', message: '연결하지 못했어요. 가사는 남아 있습니다.' });
      set('songStatus', 'draft');
    }
    // 값은 전부 currentSession() 에서 읽으므로 s 의 조각들은 의존성이 아니다.
  }, [set]);

  const styleName =
    MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '따뜻한 발라드';

  return { state, generate, allowed, styleName };
}

/* ------------------------------------------------------------------ *
 * 만든 곡 듣기
 * ------------------------------------------------------------------ */

export type SongPlayer = {
  /** 이 기기에 곡이 있는가. 없으면 재생 UI 를 아예 감춘다. */
  ready: boolean;
  /**
   * 아직 기기 보관함을 읽는 중.
   *
   * ready 가 false 인 이유는 둘이다 — 곡이 없거나, 아직 못 읽었거나.
   * 화면이 이 둘을 같은 것으로 그리면 "곡 없음"을 보여 줬다가 뒤늦게
   * 플레이어로 바뀐다. 그 사이에 손이 닿는 자리에 요금 나가는 버튼이 있다.
   */
  loading: boolean;
  playing: boolean;
  /** 실제 재생 위치(초) */
  at: number;
  /** 실제 곡 길이(초). metadata 를 읽기 전에는 0 */
  total: number;
  slow: boolean;
  toggle: () => void;
  toggleSlow: () => void;
  seek: (sec: number) => void;
  restart: () => void;
};

/**
 * 이 기기에 있는 곡을 실제로 재생한다.
 *
 * 예전에는 미리듣기·노래 완성·함께 부르기 세 화면이 전부 재생하는 척만 했다.
 * 재생 버튼에 핸들러가 없거나, setInterval 로 초를 세면서 0:45 · 2:32 · 2:10
 * 같은 상수를 찍었다. 정작 곡은 진짜로 만들어져 기기에 들어와 있는데
 * (useMusic → saveSong) 어르신 앞에서만 소리가 안 났다.
 *
 * 위치·길이·속도는 전부 오디오에서 읽는다. 화면이 말하는 숫자와 실제 소리가
 * 어긋나면 그건 다시 거짓말이 된다.
 *
 * 엘리먼트는 JSX 가 아니라 여기서 만든다. 화면마다 버튼 모양이 다르고,
 * 무엇보다 소리는 한 번에 하나만 나야 한다 — 어르신 앞에서 두 곡이 겹치면
 * 회기가 흐트러진다(components/SamplePlayer.tsx 와 같은 이유).
 */
export function useSongPlayer(): SongPlayer {
  const { url, loading } = useDeviceSongState();
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!url) return;
    const a = new Audio(url);
    a.preload = 'metadata';

    const onTime = () => setAt(a.currentTime);
    // 길이를 못 읽는 파일이 있다(Infinity). 그때는 0 으로 두고 화면이 총
    // 길이를 아예 말하지 않게 한다 — 모르면 모른다고 하는 편이 낫다.
    const onMeta = () => setTotal(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setAt(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    ref.current = a;

    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      ref.current = null;
      setPlaying(false);
      setAt(0);
      setTotal(0);
    };
  }, [url]);

  // "천천히 재생"은 진행바가 아니라 소리가 느려져야 한다. 예전에는 타이머
  // 간격만 1000ms → 1400ms 로 늘려서, 숫자만 천천히 올라갔다.
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = slow ? 0.75 : 1;
  }, [slow, url]);

  const toggle = useCallback(() => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }, []);

  const toggleSlow = useCallback(() => setSlow((v) => !v), []);

  const seek = useCallback((sec: number) => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = sec;
    setAt(sec);
  }, []);

  const restart = useCallback(() => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = 0;
    setAt(0);
    void a.play().catch(() => setPlaying(false));
  }, []);

  return {
    ready: url !== null,
    loading,
    playing,
    at,
    total,
    slow,
    toggle,
    toggleSlow,
    seek,
    restart,
  };
}
