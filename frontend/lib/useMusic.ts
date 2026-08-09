'use client';

import { useCallback, useState } from 'react';
import { MUSIC_STYLES, hasConsent } from './domain';
import { saveSong } from './songStore';
import { useSession } from './store';

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

  const generate = useCallback(async () => {
    if (!allowed) {
      setState({
        kind: 'error',
        message: '외부 AI 전송에 동의하지 않으셔서 곡은 만들지 않아요.',
      });
      return;
    }

    setState({ kind: 'working' });
    set('songStatus', 'generating');

    // 가사 검수 화면에서 만든 그 가사가 그대로 노래가 된다.
    const lyrics = s.lyrics
      .map((sec) => `[${sec.label}]\n${sec.lines.join('\n')}`)
      .join('\n\n');

    try {
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: s.style ?? 'ballad',
          lyrics,
          title: s.topic,
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
      set('songStatus', 'ready');
      setState({ kind: 'done' });
    } catch {
      setState({ kind: 'error', message: '연결하지 못했어요. 가사는 남아 있습니다.' });
      set('songStatus', 'draft');
    }
  }, [allowed, s.lyrics, s.style, s.topic, set]);

  const styleName =
    MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '따뜻한 발라드';

  return { state, generate, allowed, styleName };
}
