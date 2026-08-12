'use client';

import { useEffect, useRef } from 'react';
import { flowState } from './flow';
import { saveProgress } from './repo';
import { useSession } from './store';

/**
 * 회기가 어디까지 왔는지를 서버에 따라 붙인다.
 *
 * ── 왜
 *
 * 서버에 회기를 쓰는 곳이 활동일지의 「저장하고 내보내기」 하나뿐이었다.
 * 복지사가 인터뷰를 하고 이야기를 정리하고 노래까지 만들어도, 그 버튼을
 * 누르기 전에는 기관 쪽에 회기가 **존재하지 않았다**. 다른 복지사도, 센터장
 * 콘솔도 그 회기를 볼 수 없다. 기관 단위로 쓰는 제품에서 그건 "오늘 아무도
 * 일하지 않았다"로 읽힌다.
 *
 * 단계를 넘길 때마다 회기 행 하나만 맞춘다. 올리는 것은 주제·상태·단계뿐이다.
 *
 * ── 무엇을 올리지 않는가
 *
 * 전사·이야기·가사는 여기서 올리지 않는다. 그것들은 사람이 확인한 뒤에
 * 기관 기록이 되어야 한다(원칙 3: AI 출력은 초안이다). 여기서 함께 올리면
 * 확인 전 초안이 기관 기록으로 굳는다.
 *
 * ── 어떻게 한 번만 부르는가
 *
 * 보낸 값을 ref 에 적어 두고 같으면 건너뛴다. 저장이 성공하면 remoteSessionId
 * 와 remoteStep 이 바뀌고, 그것이 다시 이 훅을 깨우기 때문이다. 표시를 안
 * 두면 그 자리에서 서로를 부르며 돈다.
 */
export function useSessionProgress(): void {
  const { s, set } = useSession();
  const sent = useRef<string | null>(null);

  const participant = s.remoteParticipantId;
  const step = flowState(s).done;

  useEffect(() => {
    // 서버를 안 쓰거나 둘러보기 회기면 할 일이 없다.
    if (!participant) return;

    /*
     * 단계 0 은 아직 아무것도 하지 않은 상태다. 그때 회기 행을 만들면, 어르신을
     * 골랐다가 곧바로 나온 것까지 전부 '진행한 회기'로 콘솔에 쌓인다. 목록을
     * 훑어보는 일이 근무 기록이 되어서는 안 된다.
     */
    if (step < 1) return;

    const mark = `${participant}::${step}`;
    if (sent.current === mark) return;

    /*
     * 성공했을 때만 '보냈다'고 적는다.
     *
     * 처음에는 부르기 전에 적었는데, 그러면 실패가 성공처럼 기록된다. 실제로
     * 그렇게 한 번 놓쳤다 — 로그인 확인이 끝나기 전이라 저장이 조용히 걸러진
     * 회기가, 표시만 남아 그 단계에서 다시 시도되지 않았다.
     */
    let alive = true;
    void saveProgress(s, step)
      .then((out) => {
        if (!alive || !out) return;
        sent.current = mark;
        if (s.remoteSessionId !== out.sessionId) set('remoteSessionId', out.sessionId);
        if (s.remoteStep !== out.step) set('remoteStep', out.step);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
    // s 전체를 의존성에 넣지 않는다. 회기 상태는 글자 하나 고칠 때마다 바뀌고,
    // 그때마다 서버를 부르면 전사 교정 중에 요청이 수십 번 나간다. 보내는
    // 근거는 '누구의 몇 단계인가' 둘뿐이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant, step]);
}
