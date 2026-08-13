'use client';

import { Card } from './ui';
import { usePersonalQuestions } from '@/lib/usePersonalQuestions';

/**
 * 지난 이야기에서 나온 오늘의 질문.
 *
 * ── 이 카드가 하는 일
 *
 * 고정 질문지를 대신하지 않는다. 그 옆에 선다. 고정 질문은 어느 어르신께나
 * 통하는 밑바탕이고, 이건 **이분께만 나오는 질문**이다.
 *
 * ── 근거를 함께 보여 주는 이유
 *
 * "지난번에 순천 이야기를 해 주셨죠" 하고 여쭈려면 복지사가 그 이야기를 알고
 * 있어야 한다. 질문만 덩그러니 있으면 복지사는 어르신 앞에서 근거 없는 말을
 * 읽게 되고, 어르신이 "내가 그런 말 했나?" 하시면 답할 수가 없다.
 *
 * 그래서 어느 이야기에서 나왔는지를 질문 아래에 적는다. 그 이야기는 어르신이
 * 지난 회기에 **맞다고 확인해 주신 것**뿐이다(status='verified').
 *
 * ── 없을 때가 정상이다
 *
 * 첫 회기에는 지난 이야기가 없으므로 이 카드가 안 나온다. 그건 고장이 아니라
 * 아직 쌓인 것이 없다는 뜻이고, 화면이 그렇게 말한다 — 두 번째 회기부터
 * 나타난다는 것을 알면 복지사가 기다릴 수 있다.
 */
export function PersonalQuestions() {
  const { questions, loading, noHistory, withheld } = usePersonalQuestions();

  if (loading) return null;

  if (noHistory) {
    return (
      <Card className="mt-4 p-4">
        <p className="text-[1rem] font-bold text-ink-900">
          이번이 첫 이야기예요
        </p>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
          오늘 확인하신 이야기가 쌓이면, 다음 회기부터는 그 이야기에서 이어지는
          질문을 함께 준비해 드려요. 어르신마다 다른 질문이 됩니다.
        </p>
      </Card>
    );
  }

  /*
   * 지난 이야기가 전부 피하고 싶은 주제와 겹쳐 하나도 못 만든 경우.
   *
   * 아무것도 안 그리면 복지사는 개인화가 고장 난 줄 안다. 무엇을 뺐는지는
   * 적지 않는다 — 그걸 적으면 가리려던 것을 그대로 보여 주는 셈이다.
   */
  if (!questions.length) {
    if (withheld <= 0) return null;
    return (
      <Card className="mt-4 p-4">
        <p className="text-[1rem] font-bold text-ink-900">
          이번에는 이어지는 질문을 준비하지 못했어요
        </p>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
          지난 이야기가 피하고 싶은 주제와 겹쳐서 빼 두었어요. 정해진 질문지로
          진행하시면 됩니다.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 border-2 border-leaf-300 p-4">
      <p className="text-[1.0625rem] font-extrabold text-ink-900">
        지난 이야기에서 이어지는 질문
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        지난 회기에 어르신이 확인해 주신 이야기에서 나왔어요. 이 어르신께만
        나오는 질문입니다.
      </p>

      <ul className="mt-3 space-y-3">
        {questions.map((q) => (
          <li key={q.text} className="rounded-[14px] bg-surface-sunk p-3.5">
            <p className="text-[1.0625rem] font-bold leading-snug text-ink-900">
              {q.text}
            </p>
            {/* 근거. 이게 없으면 복지사가 어르신 앞에서 출처 없는 말을 읽게 된다. */}
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-500">
              지난 이야기 · “{q.basis}”
            </p>
          </li>
        ))}
      </ul>

      {/* 뺀 것이 있으면 말해 준다. 질문이 적게 나온 것이 고장이 아니다. */}
      {withheld > 0 ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          피하고 싶은 주제와 겹치는 지난 이야기 {withheld}개는 빼고 만들었어요.
        </p>
      ) : null}

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
        여쭤보시고 아니라고 하시면 그냥 넘어가 주세요. 지난 이야기를 잘못 옮겼을
        수도 있어요.
      </p>
    </Card>
  );
}
