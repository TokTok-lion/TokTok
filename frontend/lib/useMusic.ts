'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { claimSound, releaseSound } from '@/components/SamplePlayer';
import { hasConsent, type LyricSection } from './domain';
import { membersMissing } from './groupConsent';
import { settled } from './longJob';
import {
  cacheServerSong,
  loadSong,
  loadSongAt,
  saveSong,
  songTag,
  type SaveOutcome,
  type SongMeta,
} from './songStore';
import {
  downloadServerSong,
  findServerSong,
  lyricsHash,
  songQuotaLeft,
  uploadSong,
} from './songSync';
import { cueFractions, lineAtFraction } from './align';
import { currentSession, useSession } from './store';
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
 * 곡 보관과 같은 기준(songStore.songTag)으로 사람과 회기를 가리킨다. 두
 * 곳이 각자 계산하면 언젠가 어긋나고, 어긋나는 순간 남의 회기에서 누른
 * 재생성이 이 회기에 먹힌다.
 */
function askOwner(): string {
  const t = songTag();
  return `${t.ownerId}::${t.sessionId}`;
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
  regenerateAsked = askOwner();
}

function takeRegenerateAsk(): boolean {
  const asked = regenerateAsked;
  regenerateAsked = null;
  return asked !== null && asked === askOwner();
}

/**
 * 만든 곡을 기기에 저장하지 못했을 때 할 말.
 *
 * 요금을 이미 낸 자리라 그냥 '실패했어요'로 끝낼 수 없다. 무엇이 남았고
 * 다시 누르면 어떻게 되는지까지 같은 문장에서 말해야 한다 — 이 화면의
 * '다시 시도' 버튼은 곡을 새로 만드는 버튼이라, 자리를 비우지 않은 채
 * 누르면 같은 실패에 요금만 한 번 더 나간다.
 */
function storeFailMessage(
  outcome: SaveOutcome,
  where: { made: boolean; keptOnServer: boolean },
): string {
  // 만든 것과 받아온 것을 구분해서 말한다. 안 만들었는데 만들었다고 하면
  // 복지사는 요금이 나갔다고 믿는다.
  const got = where.made ? '노래는 만들었는데' : '이미 만들어 둔 노래를 받아왔는데';

  if (outcome === 'full') {
    return (
      `${got} 이 기기에 저장할 자리가 없어요. ` +
      (where.keptOnServer
        ? '곡은 기관 서버에 남아 있어요. 보관함에서 지난 노래를 지우고 다시 시도하시면, 새로 만들지 않고 그대로 받아옵니다.'
        : '보관함에서 지난 노래를 지우신 뒤에 다시 시도해 주세요. 그 전에 누르면 곡을 새로 만들어 요금이 한 번 더 나가요.')
    );
  }

  // 자리가 아니라 보관함 자체를 못 여는 경우다. 지운다고 해결되지 않으므로
  // 지우라고 하지 않는다 — 안 되는 일을 시키는 것도 막다른 길이다.
  return (
    `${got} 이 기기의 보관함을 열지 못했어요. ` +
    (where.keptOnServer
      ? '곡은 기관 서버에 남아 있어요. 다른 브라우저나 앱으로 다시 여시면 그대로 받아옵니다.'
      : '브라우저의 비밀 모드에서는 노래를 기기에 담아 둘 수 없어요. 앱을 다시 열어 보시고, 곡 없이 가사 카드로 진행하실 수도 있어요.')
  );
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
   * 그때는 값을 다시 쓰는 것이 맞다 — 막아야 할 것은 의도치 않은 재생성이지,
   * 사람이 일부러 누르는 다시 만들기가 아니다.
   */
  const generate = useCallback(async (force = false) => {
    // 훅이 준 s 가 아니라 지금 저장소를 읽는다. 이 함수는 화면이 뜨자마자
    // 이펙트에서 불리는데, 그 시점의 s 는 아직 복원 전 값일 수 있다.
    const now = currentSession();

    // 동의도 그 값으로 본다. 복원 전 값은 시연용 씨앗 어르신(전부 허용)이라,
    // 렌더 시점의 allowed 로 판단하면 동의하지 않으신 어르신의 가사가 실제로
    // 외부 사업자에게 나갈 수 있다. 화면 표시용 allowed 와 실제 게이트를
    // 나눠 두는 이유가 이것이다.
    /*
     * 참여하신 분 **전원**의 동의라야 보낸다.
     *
     * 그룹 회기의 가사는 그 방에서 나온 이야기로 만들어진다. 기준 어르신만
     * 보고 내보내면 나머지 분들의 말씀이 동의 없이 외부 사업자에게 나간다.
     */
    const noConsent = await membersMissing('externalAi');
    if (noConsent.length > 0) {
      const names = noConsent.map((m) => m.displayName).join(' · ');
      setState({
        kind: 'error',
        message: `${names} 어르신이 외부 AI 전송에 동의하지 않으셔서 곡은 만들지 않아요.`,
      });
      return;
    }

    // 앞 화면에서 "다시 만들기"를 누르고 왔으면 그것도 다시 만들기다.
    // 동의 확인보다 뒤에서 읽는다 — 곡을 못 만드는 경우에 표시만 소모하면
    // 나중에 진짜로 누른 재생성이 캐시에 걸린다. 표시에 주인이 붙어 있으므로
    // 여기 남아도 다른 어르신 회기로는 넘어가지 않는다.
    const remake = force || takeRegenerateAsk();

    /*
     * 이 곡이 누구의 어느 회기 것인지를 여기서 붙잡는다.
     *
     * 곡 만들기는 1~3분이 걸린다. 그 사이에 복지사가 다음 어르신으로 넘어가는
     * 일이 실제로 있다(태블릿을 들고 옮겨 다닌다). 저장할 때 그때의 회기를
     * 다시 읽으면, 앞 어르신의 생애로 만든 곡이 다음 어르신의 보관함에
     * 들어간다 — 화면상으로는 정상과 구분되지 않는 사고다.
     */
    const tag = songTag();

    // 가사 검수 화면에서 만든 그 가사가 그대로 노래가 된다.
    const lyrics = now.lyrics
      .map((sec) => `[${sec.label}]\n${sec.lines.join('\n')}`)
      .join('\n\n');

    /*
     * 보낼 때는 절 이름을 영어로 바꾼다.
     *
     * 우리는 [1절]·[후렴]으로 적어 보내고 있었는데, Suno 가 알아듣는 구조
     * 표시는 [Verse]·[Chorus] 다. 모르는 표시를 받으면 편곡을 자기 마음대로
     * 짠다 — 팀원분이 사이트에서 뽑은 60초짜리와 우리 곡을 재 보니 우리 쪽만
     * 앞 13초가 전주고 한가운데 36초가 반주뿐이었다. 반주는 크게 나오니
     * 조용한 게 아니라 **부를 것이 없는** 36초다.
     *
     * 화면과 인쇄물은 그대로 한국어를 쓴다. 이 변환은 업체에 보내는 자리에서만
     * 일어난다. 곡을 찾는 열쇠(songKey·lyricsHash)도 한국어 쪽을 그대로 쓴다 —
     * 여기서 바꾸면 이미 만들어 둔 곡을 못 찾고 "가사가 바뀌었다"고 잘못
     * 말하게 된다.
     */
    const forSuno = now.lyrics
      .map((sec) => `[${sunoTag(sec.label)}]\n${sec.lines.join('\n')}`)
      .join('\n\n');

    const style = now.style ?? 'ballad';
    const key = `${style}::${lyrics}`;

    // 만들기 전에 두 곳을 먼저 본다. 요금도 요금이지만, 이미 있는 곡을 다시
    // 만들면 어르신께 같은 노래를 새로 들려드리는 셈이 된다.
    //
    //   1) 이 기기  — 새로고침이나 뒤로가기로 다시 들어온 경우
    //   2) 기관 서버 — 다른 태블릿에서 이미 만든 경우
    //
    // 2가 없으면 태블릿을 바꿀 때마다 같은 곡에 요금이 또 나간다.
    if (!remake && now.songKey === key && (await loadSong())) {
      set('songStatus', 'ready');
      set('lyricsStale', false);
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
        const stored = await saveSong(fromServer, tag, hash, now.lyrics);
        if (stored !== 'ok') {
          // 서버에는 그대로 있으므로 잃은 것은 없다. 요금도 나가지 않았다.
          setState({
            kind: 'error',
            message: storeFailMessage(stored, { made: false, keptOnServer: true }),
          });
          set('songStatus', 'draft');
          return;
        }
        set('songKey', key);
        // 새 열쇠를 적었으니 '가사가 노래보다 새것' 표시는 뜻을 잃는다.
        // 안 지우면 방금 만든 노래에도 "옛 가사로 부르고 있어요"가 남는다.
        set('lyricsStale', false);
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
            lyrics: forSuno,
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

      /*
       * 잰 길이가 있을 때만 길이를 적는다.
       *
       * 라우트(app/api/music/route.ts)는 제공자가 길이를 알려 주지 않으면
       * X-Music-Length-Ms 를 **일부러 안 붙인다** — 아무도 재지 않은 값이
       * 기관 표에 앉는 것을 막으려고 그렇게 해 뒀다. 그런데 여기서
       * Number(res.headers.get(...)) || 0 으로 읽는 바람에, 헤더가 없으면
       * Number(null) === 0 이 되어 그 빈칸을 클라이언트가 0 으로 메웠다.
       * 라우트가 비워 둔 칸에 '0밀리초짜리 곡'이라는 거짓이 들어간 것이다.
       * 나중에 이 칸을 실측으로 읽는 사람이 반드시 생긴다.
       *
       * 없는 것은 없는 채로 넘긴다. 컬럼은 null 을 받게 되어 있다.
       * 숫자가 아닌 값(중간 프록시가 헤더를 망친 경우)도 같은 취급이다 —
       * 못 믿을 값을 적느니 안 적는 편이 낫다.
       */
      /*
       * 같은 요청에서 나온 연주가 몇 개인지, 그 작업 번호가 무엇인지.
       *
       * Suno 는 한 번에 트랙을 두 개 내고 값은 두 개를 합쳐 한 번치로
       * 매겨진다. 두 번째는 이미 치른 값이라, 미리듣기에서 "둘 중에
       * 고르시겠어요"를 요금 없이 내밀 수 있다. 그러려면 작업 번호가 필요한데
       * 폴링이 끝나면 잃어버리므로 여기서 붙잡아 회기에 남긴다.
       */
      const takes = Number(res.headers.get('X-Music-Takes')) || 1;
      const job = res.headers.get('X-Music-Job');
      set('songTakes', takes);
      set('songTake', 1);
      set('songJob', job);

      const lengthHeader = res.headers.get('X-Music-Length-Ms');
      const measured = lengthHeader === null ? Number.NaN : Number(lengthHeader);
      const lengthMs = Number.isFinite(measured) && measured > 0 ? measured : null;

      const shelfMeta = {
        title: now.topic,
        style,
        lengthMs,
        sessionId: now.remoteSessionId,
        // 고른 그림도 함께 올린다. 안 올리면 다른 태블릿의 보관함이 주제에서
        // 그림을 다시 계산해, 복지사가 바꾼 적 없는 그림을 보여 준다.
        cover: tag.cover,
        // 가사도 곡을 따라간다. 보관함에서 지난 곡을 다시 「함께 부르기」로
        // 열려면 이 값이 있어야 한다 — 회기 상태는 회기가 끝나면 사라진다.
        lyrics: now.lyrics,
      };

      /*
       * 저장 결과를 확인한다.
       *
       * 예전에는 saveSong 이 아무 말 없이 실패할 수 있었다(기기가 꽉 참 ·
       * IndexedDB 가 막힌 브라우저). 그러면 화면은 '노래가 완성됐어요'라고
       * 하고 다음 화면에는 곡이 없다 — 요금은 이미 나간 뒤다.
       */
      const stored = await saveSong(blob, tag, hash, now.lyrics);
      if (stored !== 'ok') {
        // 여기서만은 업로드 결과를 기다린다. 서버에 사본이 남았는지에 따라
        // 복지사가 할 일이 다르고(자리를 비우고 다시 받기 vs 다시 만들기),
        // 그걸 모르면 요금이 걸린 버튼 앞에서 찍어야 한다.
        const kept = await uploadSong(blob, hash, shelfMeta);
        setState({
          kind: 'error',
          message: storeFailMessage(stored, { made: true, keptOnServer: kept }),
        });
        set('songStatus', 'draft');
        return;
      }

      // 만드는 사이에 회기가 바뀌었으면 지금 회기 값은 건드리지 않는다. 곡은
      // 주문한 회기(tag)의 보관함에 들어갔고, 그 회기의 노래로 남는다.
      const at = songTag();
      if (at.ownerId === tag.ownerId && at.sessionId === tag.sessionId) {
        set('songKey', key);
        set('lyricsStale', false);
        set('songStatus', 'ready');
        setState({ kind: 'done' });
      } else {
        setState({
          kind: 'error',
          message:
            '노래는 만들었어요. 다만 만드는 사이에 다른 회기로 넘어가서, 이 노래는 ' +
            '만들기를 시작한 회기의 보관함에 넣어 두었어요. 지금 회기에는 아직 노래가 없습니다.',
        });
      }

      // 기관 저장소에도 올린다. 실패해도 회기를 막지 않는다 — 곡은 이미
      // 기기에 있고, 다음에 로그인된 상태로 열면 다시 올라간다.
      void uploadSong(blob, hash, shelfMeta);
    } catch {
      setState({ kind: 'error', message: '연결하지 못했어요. 가사는 남아 있습니다.' });
      set('songStatus', 'draft');
    }
    // 값은 전부 currentSession() 에서 읽으므로 s 의 조각들은 의존성이 아니다.
  }, [set]);

  // styleName 은 여기서 돌려주지 않는다. 읽는 화면이 하나도 없었고(grep 0건),
  // 폴백이 '따뜻한 발라드'라 고른 적 없는 분위기를 이름 대어 말할 준비만 된
  // 값이었다. 필요한 화면은 각자 MUSIC_STYLES 에서 찾아 쓰되, 없으면 없다고
  // 그린다.
  return { state, generate, allowed };
}

/* ------------------------------------------------------------------ *
 * 만든 곡 듣기
 * ------------------------------------------------------------------ */

export type SongPlayer = {
  /** 곡이 화면 밖에서 갈렸을 때 다시 읽는다(다른 연주로 바꾸기). */
  reload: () => void;
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
  /** 실제 곡 길이(초). 아직 못 읽었거나 읽어도 알 수 없으면 0 */
  total: number;
  /**
   * 곡 길이를 아직 읽는 중.
   *
   * total === 0 인 이유도 둘이다 — 아직 metadata 가 안 왔거나(거의 모든 곡의
   * 첫 몇 프레임), 읽었는데 길이를 알 수 없거나(Infinity). 이 둘을 같은
   * 것으로 그리면 멀쩡한 곡에도 "길이를 읽지 못했다"가 한 번 스친다.
   * 아직 모르는 것과 못 읽은 것은 다른 말이다.
   */
  measuring: boolean;
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
export function useSongPlayer(
  /** 보관함에서 고른 지난 곡을 걸 때만 준다. 없으면 이번 회기의 곡. */
  key?: string | null,
): SongPlayer {
  const { url, loading, reload } = useDeviceSongState(key);
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);
  // 새 곡을 걸면 길이는 다시 모르는 상태에서 시작한다. url 이 없을 때의 값은
  // 아래 반환에서 걸러지므로 여기서는 true 로 두어도 화면에 새지 않는다.
  const [measuring, setMeasuring] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!url) return;
    const a = new Audio(url);
    a.preload = 'metadata';
    // 여기서 setMeasuring(true) 로 되돌리지 않는다. 시작값이 이미 '읽는 중'
    // 이고, 곡이 바뀔 때는 앞 이펙트의 정리가 먼저 되돌려 놓는다. 이펙트
    // 본문에서 상태를 건드리면 렌더가 한 번 더 돈다(useDeviceSongState 와
    // 같은 이유, react-hooks/set-state-in-effect).

    const onTime = () => setAt(a.currentTime);
    // 길이를 못 읽는 파일이 있다(Infinity). 그때는 0 으로 두고 화면이 총
    // 길이를 아예 말하지 않게 한다 — 모르면 모른다고 하는 편이 낫다.
    // 여기까지 왔으면 '읽는 중'은 끝났다. 0 이든 아니든 답은 나온 것이다.
    const onMeta = () => {
      setTotal(Number.isFinite(a.duration) ? a.duration : 0);
      setMeasuring(false);
    };
    /*
     * 못 읽고 끝나는 길도 반드시 닫아 둔다.
     *
     * 파일이 깨졌거나 코덱이 없으면 loadedmetadata 는 영영 안 온다. 그때
     * measuring 을 true 로 놔 두면 "길이를 읽는 중이에요"가 회기 내내 떠
     * 있는다 — 어르신 앞에서 끝나지 않는 화면은 그 자체로 고장이다.
     */
    const onFail = () => setMeasuring(false);
    const onEnd = () => {
      setPlaying(false);
      setAt(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    // 스트리밍으로 받은 곡은 loadedmetadata 때 Infinity 였다가 나중에
    // durationchange 로 진짜 길이가 온다. 그때도 화면이 따라가야 한다.
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('error', onFail);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    ref.current = a;

    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('error', onFail);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      ref.current = null;
      setPlaying(false);
      setAt(0);
      setTotal(0);
      setMeasuring(true);
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
    // 곡이 화면 밖에서 갈렸을 때 부른다(다른 연주로 바꾸기).
    reload,
    playing,
    at,
    total,
    // 곡이 없으면 잴 것도 없다. 그 경우까지 '읽는 중'이라고 말하지 않는다.
    measuring: url !== null && measuring,
    slow,
    toggle,
    toggleSlow,
    seek,
    restart,
  };
}

/* ------------------------------------------------------------------ *
 * 보관함 목록 재생
 * ------------------------------------------------------------------ */

export type ShelfSound =
  | { kind: 'idle' }
  | { kind: 'loading'; key: string }
  | { kind: 'playing'; key: string }
  | { kind: 'error'; key: string };

/**
 * 목록에서 고른 곡 하나를 재생한다.
 *
 * 회기별로 곡이 쌓이면서 보관함이 목록이 됐다. 카드마다 플레이어를 두면 두
 * 곡이 겹쳐 흐르는데, 어르신 앞에서 두 노래가 동시에 나오면 어느 것이 그분
 * 노래인지 귀로 가릴 수 없다. 그래서 소리는 언제나 하나만 살려 두고, 예시
 * 선반과도 같은 자리(claimSound/releaseSound)를 나눠 쓴다.
 *
 * 파일은 누를 때 읽는다. 곡 하나가 몇 MB라, 목록을 여는 것만으로 열 곡을
 * 통째로 메모리에 올릴 이유가 없다. 대신 읽는 동안 표시를 남긴다 —
 * 눌렀는데 몇 초 조용하면 복지사는 한 번 더 누르거나 태블릿을 의심한다
 * (components/SamplePlayer 에서 겪은 그대로다).
 *
 * 다른 태블릿에서 만든 곡은 이 기기에 파일이 없다. 그때는 기관 저장소에서
 * 내려받아 재생하고, 받은 김에 기기에도 남긴다 — 다음번에 어르신 앞에서
 * 누를 때 통신을 기다리지 않게.
 */

/** 재생할 곡. 기기에 없으면 path 로 기관 저장소에서 받는다. */
export type PlayTarget = SongMeta & { path?: string };

/**
 * 곡 파일을 구해 온다 — 기기를 먼저 보고, 없으면 기관 저장소에서.
 *
 * 기기가 먼저인 것이 중요하다. 어르신 앞에서 재생을 누르는 자리라, 이미
 * 가지고 있는 곡까지 통신을 기다리게 하면 안 된다.
 */
async function fetchSong(m: PlayTarget): Promise<Blob | null> {
  const here = await loadSongAt(m.key).catch(() => null);
  if (here) return here;
  if (!m.path) return null;

  const got = await downloadServerSong(m.path).catch(() => null);
  if (!got) return null;

  /*
   * 받은 김에 기기에도 남긴다. 결과는 기다리지 않는다 — 저장이 안 되더라도
   * (기기가 꽉 찼거나 비밀 모드) 지금 이 재생은 되어야 한다. 다음번에 다시
   * 받으면 그만이다.
   */
  void cacheServerSong(got, {
    ownerId: m.ownerId,
    sessionId: m.sessionId,
    madeAt: m.madeAt,
    topic: m.topic,
    cover: m.cover,
    style: m.style,
    hash: m.hash,
  });
  return got;
}
export function useSongShelfPlayer() {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  /** 요청 일련번호 — 늦게 도착한 읽기가 최신 표시를 덮지 못하게 한다. */
  const seq = useRef(0);
  const alive = useRef(true);
  const [sound, setSound] = useState<ShelfSound>({ kind: 'idle' });

  const settle = useCallback((n: number, next: ShelfSound) => {
    if (n !== seq.current || !alive.current) return;
    setSound(next);
  }, []);

  /** 소리를 끊고 만들어 둔 주소를 되돌려 준다. 안 놓으면 곡이 메모리에 쌓인다. */
  const drop = useCallback(() => {
    elRef.current?.pause();
    elRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  /** 소리 주인 자리에 등록해 두는 정지 함수. 신원이 곧 소유권이라 고정이다. */
  const stop = useCallback(() => {
    seq.current += 1; // 읽는 중이던 곡이 뒤늦게 '재생 중'으로 켜지지 않게
    drop();
    if (alive.current) setSound({ kind: 'idle' });
  }, [drop]);

  const toggle = useCallback(
    (m: PlayTarget) => {
      const key = m.key;
      // 같은 곡을 다시 누르면 멈춘다. 아직 읽는 중이어도 멈출 수 있어야 한다.
      if ((sound.kind === 'playing' || sound.kind === 'loading') && sound.key === key) {
        stop();
        releaseSound(stop);
        return;
      }

      // 예시 곡이나 앞서 누른 곡이 흐르고 있으면 그쪽을 먼저 멈춘다.
      claimSound(stop);
      stop();

      // 일련번호는 stop 뒤에 딴다 — stop 이 번호를 올리므로 순서를 바꾸면
      // 방금 딴 번호가 그 자리에서 낡아 버린다.
      const n = ++seq.current;
      setSound({ kind: 'loading', key });

      void fetchSong(m).then(
        (blob) => {
          if (n !== seq.current || !alive.current) return;
          if (!blob) {
            // 표에는 있는데 파일이 없다. 조용히 지나가면 눌러도 아무 일이
            // 없는 카드가 된다.
            settle(n, { kind: 'error', key });
            return;
          }
          const url = URL.createObjectURL(blob);
          const el = document.createElement('audio');
          el.onended = () => {
            if (n !== seq.current) return;
            drop();
            settle(n, { kind: 'idle' });
          };
          el.onerror = () => settle(n, { kind: 'error', key });
          el.src = url;
          elRef.current = el;
          urlRef.current = url;
          void el.play().then(
            () => settle(n, { kind: 'playing', key }),
            () => settle(n, { kind: 'error', key }),
          );
        },
        () => settle(n, { kind: 'error', key }),
      );
    },
    [sound, stop, drop, settle],
  );

  // 화면을 떠나면 소리도 함께 멎어야 한다. 자리도 비워 준다 — 안 비우면
  // 다음에 재생하는 쪽이 이미 사라진 플레이어를 멈추려 든다.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      drop();
      releaseSound(stop);
    };
  }, [drop, stop]);

  return { sound, toggle, stop };
}

/* ------------------------------------------------------------------ *
 * 지금 부르는 줄
 * ------------------------------------------------------------------ */

/** 가사 한 줄. 절 라벨은 그 절이 시작하는 줄에만 붙는다. */
export type CueLine = {
  text: string;
  /** 1절 · 후렴 처럼 화면에 그대로 보이는 라벨 */
  label: string;
  opensSection: boolean;
};

export type LyricCue = {
  /** 절 순서대로 펼친 전체 가사 */
  lines: CueLine[];
  /** 지금 부르고 있다고 보는 줄. 가사가 없으면 -1 */
  index: number;
  /**
   * 시간으로 줄을 짚을 수 있는가.
   *
   * 곡 길이를 못 읽는 파일이 있다(useSongPlayer 의 total=0). 그때는 자동으로
   * 넘길 근거가 아예 없으므로 손으로만 넘긴다 — 화면도 자동 스위치 대신
   * 그 사실을 적어야 한다.
   *
   * 다만 timed 가 false 라고 곧바로 "못 읽었다"고 적으면 안 된다. metadata 가
   * 오기 전에도 total 은 0 이라, 멀쩡한 곡에 그 문장이 한 번 스친다.
   * 아직 읽는 중인지는 player.measuring 으로 가른다.
   */
  timed: boolean;
  /**
   * 지금 줄이 잰 값인가, 어림인가.
   *
   * 화면이 이 둘을 다르게 말해야 한다. 어림일 때 "정확히 맞춰져 있어요"라고
   * 하면 어긋난 자막을 복지사가 믿게 되고, 잰 값일 때까지 "어림이에요"라고
   * 적어 두면 애써 맞춘 것이 쓰이지 않는다.
   */
  measured: boolean;
  auto: boolean;
  setAuto: (on: boolean) => void;
  toPrev: () => void;
  toNext: () => void;
  canPrev: boolean;
  canNext: boolean;
};

/**
 * 화면에 뜨는 순서 그대로의 줄 글자만.
 *
 * 맞추기(useSongAlign)가 이 목록으로 곡과 견준다. 화면이 짚는 줄과 맞춘 줄이
 * 같은 목록에서 나와야, 셋째 줄을 맞춰 놓고 넷째 줄을 짚는 일이 없다.
 */
export function lyricLineTexts(sections: LyricSection[]): string[] {
  return flattenLyrics(sections).map((l) => l.text);
}

/**
 * 우리 절 이름을 Suno 가 아는 구조 표시로.
 *
 * 모르는 이름이면 절로 본다. 지어내지 않는다 — [Bridge] 같은 것을 임의로
 * 붙이면 우리가 쓰지도 않은 구조를 업체에 지시하는 셈이다.
 */
export function sunoTag(label: string): string {
  if (/후렴|코러스/.test(label)) return 'Chorus';
  if (/다리|브리지/.test(label)) return 'Bridge';
  return 'Verse';
}

/** 절 배열을 줄 하나짜리 목록으로 펼친다. */
export function flattenLyrics(sections: LyricSection[]): CueLine[] {
  const out: CueLine[] = [];
  for (const sec of sections) {
    let first = true;
    for (const raw of sec.lines) {
      const text = raw.trim();
      // 빈 줄에 차례가 오면 화면에 크게 뜨는 글자가 없다. 넘길 자리에서 뺀다.
      if (!text) continue;
      out.push({ text, label: sec.label, opensSection: first });
      first = false;
    }
  }
  return out;
}

/**
 * 줄마다 곡의 어디쯤에서 시작한다고 보는지 — 0~1 사이 비율. 길이는 줄 수 + 1.
 *
 * 줄별 시각은 우리에게 없다. 곡은 Suno 가 소리로만 주고, 가사는 절과 줄
 * 배열로만 들고 있다. 그래서 글자 수로 나눈다 — "긴 줄은 오래 부른다" 하나만
 * 가정한 어림이다. 전주·간주·반복·늘여 부르기는 알 수 없으니 이 어림은
 * 반드시 어긋난다. 어긋남을 화면이 밝히고 복지사가 손으로 맞출 수 있다는
 * 것이, 이 계산을 쓰는 전제다. 정확한 척하면 그때부터 거짓말이 된다.
 */
function lineStarts(lines: CueLine[]): number[] {
  const weights = lines.map((l) => Math.max(1, l.text.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = [0];
  let acc = 0;
  for (const w of weights) {
    acc += w;
    out.push(sum > 0 ? acc / sum : 1);
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}


/**
 * 노래방처럼 지금 줄을 짚어 준다.
 *
 * 예전에는 후렴 한 절만 크게 띄워 놓고 2분 내내 그대로였다. 여러 분이 함께
 * 보며 부르는 화면인데 지금 어디를 부르는지 알 수 없었다.
 *
 * 여기서 하는 일은 어림이지 받아쓰기가 아니다. 그래서 손으로 맞추는 길을
 * 같이 낸다 — 한 번 맞추면 그 시점을 기준으로 나머지가 다시 나뉜다(mark).
 * 그렇게 하지 않으면 눌러서 맞춰 놔도 몇 초 뒤 어림이 제자리로 끌고 가고,
 * 손으로 맞춘 것이 없던 일이 된다. 두 번 겪으면 아무도 안 누른다.
 */
export function useLyricCue(
  sections: LyricSection[],
  player: SongPlayer,
  /**
   * 실제 노래에서 잰 줄별 시작 시각(초). 없으면 예전처럼 글자 수로 어림한다.
   *
   * 여기서 비율로 바꿔 쓰는 이유는 아래 손맞춤 계산이 전부 비율로 되어
   * 있어서다 — 잰 값이 들어와도 복지사가 손으로 맞추는 길은 그대로 남는다.
   * 잰 값도 틀릴 수 있고, 그 자리에서 고칠 방법이 없으면 화면을 못 쓴다.
   */
  cues?: number[] | null,
): LyricCue {
  const lines = useMemo(() => flattenLyrics(sections), [sections]);
  const total = player.total;
  const measured =
    Array.isArray(cues) && cues.length === lines.length && lines.length > 0 && total > 0;
  const starts = useMemo(
    () => (measured ? cueFractions(cues as number[], total) : lineStarts(lines)),
    [measured, cues, total, lines],
  );

  const [auto, setAutoState] = useState(true);
  /**
   * 복지사가 손으로 맞춘 기준점 — "이 시각에 이 줄을 부르고 있었다".
   *
   * 어느 가사에 대고 맞춘 것인지 함께 들고 다닌다. 가사가 바뀌면(다른
   * 회기·다시 만든 가사) 3번째 줄이라는 표시는 남의 노래의 3번째 줄이 된다.
   * 이펙트로 지우지 않고 그리는 김에 걸러내는 이유는, 지우는 렌더가 한 번 더
   * 돌아 그 사이에 옛 기준점으로 짚은 줄이 한 프레임 뜨기 때문이다.
   */
  const [marked, setMark] = useState<{
    lines: CueLine[];
    at: number;
    index: number;
  } | null>(null);
  const mark = marked && marked.lines === lines ? marked : null;

  const at = player.at;
  const timed = total > 0;
  const count = lines.length;

  const index = useMemo(() => {
    if (count === 0) return -1;
    // 자동이 꺼져 있거나 곡 길이를 모르면 시간은 아무것도 말해 주지 않는다.
    if (!auto || !timed) return clamp(mark?.index ?? 0, 0, count - 1);

    let f: number;
    if (!mark) {
      f = at / total;
    } else if (at <= mark.at) {
      // 맞춘 지점 앞은 [0, mark.at] 안으로 접어 넣는다. '처음부터 듣기'로
      // 돌아가도 첫 줄부터 다시 짚이도록.
      f = mark.at > 0 ? (at / mark.at) * starts[mark.index] : starts[mark.index];
    } else if (total > mark.at) {
      // 맞춘 지점 뒤는 남은 시간에 남은 줄을 다시 비례로 나눈다.
      f =
        starts[mark.index] +
        ((at - mark.at) / (total - mark.at)) * (1 - starts[mark.index]);
    } else {
      f = 1;
    }
    return lineAtFraction(starts, f);
  }, [count, auto, timed, mark, at, total, starts]);

  const step = useCallback(
    (delta: number) => {
      setMark({ lines, at, index: clamp(index + delta, 0, Math.max(count - 1, 0)) });
    },
    [lines, at, index, count],
  );

  const toPrev = useCallback(() => step(-1), [step]);
  const toNext = useCallback(() => step(1), [step]);

  const setAuto = useCallback(
    (on: boolean) => {
      // 켜든 끄든 지금 보고 있는 줄에서 이어져야 한다. 기준점을 지금으로
      // 옮겨 두지 않으면, 자동을 다시 켜는 순간 화면이 엉뚱한 줄로 튄다.
      setMark({ lines, at, index: Math.max(index, 0) });
      setAutoState(on);
    },
    [lines, at, index],
  );

  return {
    lines,
    index,
    timed,
    measured,
    auto,
    setAuto,
    toPrev,
    toNext,
    canPrev: index > 0,
    canNext: index >= 0 && index < count - 1,
  };
}
