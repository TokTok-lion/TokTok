'use client';

import { useState } from 'react';
import { OutlineButton } from './ui';
import { lyricsHash, uploadSong } from '@/lib/songSync';
import { deleteSong, saveSong, songTag } from '@/lib/songStore';
import { useSession } from '@/lib/store';

/**
 * 다른 연주로 바꾸기.
 *
 * ── 왜 요금이 들지 않는가
 *
 * Suno 는 한 번 만들 때 트랙을 **두 개** 낸다. 같은 가사·같은 분위기로 서로
 * 다른 두 번의 연주다. 값은 두 개를 합쳐 한 번치(11크레딧)로 매겨지므로,
 * 두 번째는 이미 치른 것이다. 그런데 앱은 오래 첫 번째만 쓰고 두 번째를
 * 버렸다 — 값을 내고 받아 놓은 것을 쓰지 않은 셈이다.
 *
 * 미리듣기 화면에 원래 '세 버전 중 고르기'가 있었는데 "곡값이 세 배로 든다"는
 * 이유로 걷어냈다. 그 판단은 맞았지만 전제가 하나 빠져 있었다 — 두 번째는
 * 이미 우리 것이다. 셋이 아니라 둘이면 요금이 0이다.
 *
 * ── 왜 고르는 일이 의미가 있는가
 *
 * 어르신이 직접 고르시는 순간이 회상요법에서는 그 자체로 활동이다. 같은
 * 이야기가 두 가지 연주로 들리면 "이게 더 좋네" 하는 말씀이 나오고, 그 말씀이
 * 또 기억을 연다.
 *
 * ── 순서
 *
 * 새 연주를 **먼저 받고** 그다음에 기기의 곡을 바꾼다. 반대로 하면 통신이
 * 끊긴 순간 어르신 앞에서 곡이 통째로 사라진다.
 */
export function OtherTakeButton({ onSwitched }: { onSwitched?: () => void }) {
  const { s, set } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 고를 것이 없으면 아무것도 그리지 않는다. 업체를 바꿔 하나만 나오면
  // songTakes 가 1 이라 이 자리가 저절로 사라진다.
  if (s.songTakes < 2 || !s.songJob) return null;

  const next = s.songTake === 1 ? 2 : 1;

  const swap = async () => {
    setBusy(true);
    setError(null);

    let blob: Blob;
    try {
      const res = await fetch(
        `/api/music?job=${encodeURIComponent(s.songJob!)}&take=${next}`,
      );
      if (!res.ok) throw new Error('실패');
      blob = await res.blob();
      // 소리가 없으면 바꾸지 않는다. 빈 파일로 갈아 끼우면 어르신 앞에서
      // 재생을 눌렀을 때 아무 일도 안 일어난다.
      if (blob.size < 1024) throw new Error('빈 곡');
    } catch {
      setBusy(false);
      setError('다른 연주를 받아 오지 못했어요. 지금 곡은 그대로 있어요.');
      return;
    }

    // 받은 뒤에 바꾼다. 회기에 곡은 하나만 남긴다 — 보관함에 같은 노래가
    // 두 줄로 쌓이면 어느 것이 지금 곡인지 알 수 없다.
    const tag = songTag();
    const lyrics = s.lyrics
      .map((sec) => `[${sec.label}]\n${sec.lines.join('\n')}`)
      .join('\n\n');
    const style = s.style ?? 'ballad';
    const hash = await lyricsHash(lyrics, style);

    await deleteSong();
    const stored = await saveSong(blob, tag, hash);
    if (stored !== 'ok') {
      setBusy(false);
      setError('이 기기에 저장하지 못했어요. 보관함에서 지난 곡을 지워 주세요.');
      return;
    }

    set('songTake', next);
    /*
     * 기관 저장소도 바꾼다. 파일 이름이 가사 지문이라 같은 자리에 덮인다 —
     * 고른 연주가 곧 이 회기의 곡이고, 다른 태블릿에서도 그게 나와야 한다.
     */
    void uploadSong(blob, hash, {
      title: s.topic,
      style,
      lengthMs: null,
      sessionId: s.remoteSessionId,
      cover: s.cover,
    });

    setBusy(false);
    onSwitched?.();
  };

  return (
    <div className="mt-3">
      {/* OutlineButton 에는 disabled 가 없다. 받는 중에 또 누르면 같은 요청이
          두 번 나가므로 여기서 걸러 낸다 — 요금은 안 들지만 곡이 두 번 갈리며
          앞뒤가 어긋난다. */}
      <OutlineButton tone="leaf" onClick={() => (busy ? undefined : void swap())}>
        {busy ? '다른 연주를 받아 오는 중…' : `다른 연주로 들어보기 (지금 ${s.songTake === 1 ? 'A' : 'B'})`}
      </OutlineButton>
      <p className="mt-2 text-center text-[0.875rem] leading-relaxed text-ink-500">
        같은 가사로 만들어진 다른 연주예요. 이미 함께 만들어진 것이라{' '}
        <strong className="text-ink-700">요금이 들지 않아요.</strong> 어르신께 두 가지를
        들려드리고 편한 쪽을 고르셔도 좋아요.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-center text-[0.875rem] font-bold text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
