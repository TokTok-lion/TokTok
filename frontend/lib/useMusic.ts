'use client';

import { useCallback, useState } from 'react';
import { MUSIC_STYLES, hasConsent } from './domain';
import { loadSong, saveSong } from './songStore';
import { currentSession, useSession } from './store';

export type MusicState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done' }
  /** 요금제 문제 — 고장이 아니므로 다르게 안내한다 */
  | { kind: 'needsPaidPlan'; message: string }
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

    // 같은 가사·스타일로 만든 곡이 이미 있으면 다시 만들지 않는다.
    // 곡 하나가 750크레딧이라, 새로고침 한 번이 그대로 요금이 된다.
    const key = `${now.style ?? 'ballad'}::${lyrics}`;
    if (!force && now.songKey === key && (await loadSong())) {
      set('songStatus', 'ready');
      setState({ kind: 'done' });
      return;
    }

    setState({ kind: 'working' });
    set('songStatus', 'generating');

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

      await saveSong(await res.blob());
      set('songKey', key);
      set('songStatus', 'ready');
      setState({ kind: 'done' });
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
