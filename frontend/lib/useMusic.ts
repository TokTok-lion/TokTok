'use client';

import { useCallback, useState } from 'react';
import { MUSIC_STYLES, hasConsent } from './domain';
import { loadSong, saveSong } from './songStore';
import { findServerSong, lyricsHash, songQuotaLeft, uploadSong } from './songSync';
import { currentSession, useSession } from './store';

export type MusicState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done' }
  /** 요금제 문제 — 고장이 아니므로 다르게 안내한다 */
  | { kind: 'needsPaidPlan'; message: string }
  /** 이번 달 무료 한도를 다 씀 */
  | { kind: 'quotaSpent'; message: string }
  | { kind: 'error'; message: string };

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
    if (!allowed) {
      setState({
        kind: 'error',
        message: '외부 AI 전송에 동의하지 않으셔서 곡은 만들지 않아요.',
      });
      return;
    }

    // 훅이 준 s 가 아니라 지금 저장소를 읽는다. 이 함수는 화면이 뜨자마자
    // 이펙트에서 불리는데, 그 시점의 s 는 아직 복원 전 값일 수 있다.
    const now = currentSession();

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
    if (!force && now.songKey === key && (await loadSong())) {
      set('songStatus', 'ready');
      setState({ kind: 'done' });
      return;
    }

    setState({ kind: 'working' });
    set('songStatus', 'generating');

    const hash = await lyricsHash(lyrics, style);
    if (!force) {
      const fromServer = await findServerSong(hash);
      if (fromServer) {
        await saveSong(fromServer);
        set('songKey', key);
        set('songStatus', 'ready');
        setState({ kind: 'done' });
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
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: now.style ?? 'ballad',
          lyrics,
          title: now.topic,
        }),
      });

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
  }, [allowed, set]);

  const styleName =
    MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '따뜻한 발라드';

  return { state, generate, allowed, styleName };
}
