'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ConsentGate, missingConsents } from '@/components/ConsentGate';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, PrimaryButton } from '@/components/ui';
import { hasConsent, lyricInputs } from '@/lib/domain';
import {
  approveScene,
  deleteScene,
  readScenes,
  saveScene,
  type Scene,
} from '@/lib/sceneStore';
import { getSupabase } from '@/lib/supabase';
import { uploadScene } from '@/lib/sceneSync';
import { useSession } from '@/lib/store';

/**
 * 사연 그림 — 확인된 이야기 한 문장을 그림 한 장으로.
 *
 * ── 왜 이 화면이 있나
 *
 * 관장님이 "노래만 만들지 말고 사연이 담긴 그림까지 되면 좋겠다"고 하셨고,
 * 기획팀장님은 "동화책처럼 이미지화해서 책으로" 라고 하셨다. 이 화면이 그
 * 첫 단계이고, 여기서 확정한 그림이 그대로 책(/session/book)으로 간다.
 *
 * ── 이 화면이 지키는 것
 *
 * 1. 그림 옆에 **그 문장이 반드시 붙어 있다.** 어느 말씀에서 나온 그림인지
 *    모르면 그건 근거 없는 그림이다.
 * 2. 만든 그림은 **초안**이다. 복지사가 「이 그림 쓰기」를 눌러야 책에
 *    들어간다(원칙 3). 잘못 그린 그림이 가족에게 건네지면 되돌릴 수 없다.
 * 3. 외부 AI 전송 동의가 없으면 만들지 않는다. 어르신 말씀이 밖으로 나가는
 *    일이라서다.
 */
export default function ScenesPage() {
  const { s } = useSession();
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const basis = lyricInputs(s.story);
  const allowed = hasConsent(s.elder.consents, 'externalAi');

  const reload = useCallback(() => {
    void readScenes().then(setScenes);
  }, []);

  useEffect(reload, [reload]);

  const make = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const sb = getSupabase();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      /*
       * 한 장씩 따로 부른다.
       *
       * 한 번에 넉 장을 부르면 함수가 한 요청 안에서 그 시간을 다 써야 한다 —
       * 실제로 한 장에 45초가 걸렸다. 배포 환경의 함수 시간 제한에 걸리면 넉
       * 장이 통째로 날아가고, 요금은 이미 나간 뒤다.
       *
       * 한 장씩 부르면 그린 것부터 화면에 쌓인다. 중간에 한 장이 실패해도
       * 앞의 것은 남는다.
       */
      const targets = basis.slice(0, 4);
      let made = 0;
      let failed = 0;
      for (const f of targets) {
        setNote(`${made + failed + 1}번째 그림을 그리는 중이에요… (전체 ${targets.length}장)`);
        const res = await fetch('/api/scene', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            // 그릴 것은 확인된 이야기뿐이다. 미확인·제외 항목은 나가지 않는다.
            facts: [{ id: f.id, text: f.text }],
            avoid: s.elder.avoidTopics,
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          scenes?: { id: string; text: string; image: string }[];
          error?: string;
        } | null;
        const one = json?.scenes?.[0];
        if (!res.ok || !one) {
          failed += 1;
          continue;
        }
        await saveScene(one.id, one.text, one.image);
        made += 1;
        reload();
      }

      if (!made) {
        setError('그림을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
        setNote(null);
        return;
      }
      setNote(
        failed
          ? `${made}장을 그렸어요. ${failed}장은 만들지 못했어요 — 다시 눌러 보셔도 됩니다.`
          : `${made}장을 그렸어요. 한 장씩 보시고 쓸 것만 골라 주세요.`,
      );
    } catch {
      setError('연결하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <Screen back title="사연 그림" subtitle="어르신 이야기를 그림으로 남겨요">
        <ConsentGate
          missing={missingConsents(s.elder.consents, ['externalAi'])}
          title="그림을 자동으로 만들지 않아요"
          why="그림을 만들려면 어르신 말씀을 외부 사업자에 보내야 해서, 외부 AI 전송에 동의하셨을 때만 씁니다."
        >
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
            동의가 없어도 노래와 가사 카드는 그대로 만드실 수 있어요. 그림 없이도
            회기는 끝까지 진행됩니다.
          </p>
        </ConsentGate>
      </Screen>
    );
  }

  const approved = (scenes ?? []).filter((x) => x.approved).length;

  return (
    <Screen
      back
      title="사연 그림"
      subtitle="확인된 이야기 한 문장이 그림 한 장이 돼요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton href="/session/book">
          {approved ? `이 ${approved}장으로 책 만들기` : '책 만들기'}
        </PrimaryButton>
      }
    >
      <Card className="p-4">
        <p className="text-[0.9375rem] leading-relaxed text-ink-700">
          어르신이 맞다고 확인해 주신 이야기 {basis.length}개 중 앞의 네 개를
          그립니다. 그림마다 어느 말씀에서 나왔는지 아래에 적혀 있어요.
        </p>
        <button
          type="button"
          onClick={() => void make()}
          disabled={busy || basis.length === 0}
          className={`mt-3 min-h-[60px] w-full rounded-[16px] text-[1.0625rem] font-extrabold ${
            busy || basis.length === 0
              ? 'pointer-events-none bg-surface-sunk text-ink-500'
              : 'bg-brand-700 text-white'
          }`}
        >
          {basis.length === 0
            ? '확인된 이야기가 필요해요'
            : busy
              ? '그리는 중이에요… 1분쯤 걸려요'
              : scenes?.length
                ? '다시 그리기'
                : '그림 만들기'}
        </button>
        {note ? (
          <p role="status" className="mt-2 text-[0.875rem] font-bold text-leaf-800">
            {note}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-[0.875rem] font-bold text-danger-600">
            {error}
          </p>
        ) : null}
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          사람 얼굴은 그리지 않아요. 닮은 얼굴이 만들어지면 그건 그분이 아닌
          사람이 그분인 척하는 것이 됩니다. 뒷모습·손·장면으로 그립니다.
        </p>
      </Card>

      {scenes === null ? (
        <p className="mt-4 text-center text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : scenes.length === 0 ? (
        <p className="mt-4 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[0.9375rem] leading-relaxed text-ink-700">
          아직 그린 그림이 없어요. 위 버튼을 눌러 주세요.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {scenes.map((sc) => (
            <li key={sc.key}>
              <Card className="overflow-hidden p-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URI 라 next/image 가 못 다룬다 */}
                <img
                  src={sc.image}
                  alt={`그림 — ${sc.text}`}
                  className="block w-full"
                />
                <div className="p-4">
                  {/* 출처. 이게 없으면 근거 없는 그림이다. */}
                  <p className="text-[1rem] font-bold leading-relaxed text-ink-900">
                    “{sc.text}”
                  </p>
                  <p className="mt-1 text-[0.8125rem] text-ink-500">
                    어르신이 확인해 주신 이야기에서 그렸어요
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={sc.approved}
                      onClick={() =>
                        void approveScene(sc.key, !sc.approved).then(() => {
                          /*
                           * 확정한 것만 기관 저장소로 올린다.
                           *
                           * 초안은 기기에만 둔다 — 확정하지 않은 그림이 서버에
                           * 쌓이면 그것도 기록이 되고, 어느 것이 사람 손을 거친
                           * 것인지 알 수 없어진다(원칙 3).
                           *
                           * 실패해도 막지 않는다. 센터 와이파이는 자주 끊기고,
                           * 다시 누르면 그때 올라간다.
                           */
                          if (!sc.approved) void uploadScene({ ...sc, approved: true });
                          reload();
                        })
                      }
                      className={`min-h-[52px] rounded-[12px] text-[0.9375rem] font-bold ${
                        sc.approved
                          ? 'bg-leaf-100 text-leaf-800'
                          : 'bg-brand-700 text-white'
                      }`}
                    >
                      {sc.approved ? '쓰기로 함 · 누르면 취소' : '이 그림 쓰기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteScene(sc.key).then(reload)}
                      className="min-h-[52px] rounded-[12px] border border-hairline bg-surface-strong text-[0.9375rem] font-bold text-ink-700"
                    >
                      지우기
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {approved > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/session/reel"
            className="flex min-h-[60px] items-center justify-center rounded-[16px] bg-leaf-100 text-[1rem] font-bold text-leaf-800"
          >
            노래와 함께 보기
          </Link>
          <Link
            href="/session/book"
            className="flex min-h-[60px] items-center justify-center rounded-[16px] bg-surface-strong text-[1rem] font-bold text-ink-700"
          >
            책으로 보기
          </Link>
        </div>
      ) : null}

      <p className="mt-4 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        그림은 이 태블릿에 저장돼요. 「이 그림 쓰기」를 누른 것만 책과 인쇄물에
        들어갑니다 —{' '}
        <Link href="/session/book" className="font-bold text-brand-700 underline">
          책 만들기
        </Link>
        에서 보실 수 있어요.
      </p>
    </Screen>
  );
}
