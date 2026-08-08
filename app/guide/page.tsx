import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, PrimaryButton } from '@/components/ui';
import type { ArtKey } from '@/lib/art';

const CARDS: { art: ArtKey; title: string; desc: string }[] = [
  {
    art: 'icon_mic_live',
    title: '인터뷰는 어떻게 하나요?',
    desc: '음성으로 편하게 이야기해요',
  },
  {
    art: 'icon_fast_forward',
    title: '불편한 질문은 건너뛰기',
    desc: '원하지 않으면 넘길 수 있어요',
  },
  {
    art: 'icon_envelope_heart',
    title: '가족 미션 보내기',
    desc: '가족에게 미션을 보내 보세요',
  },
  {
    art: 'icon_record_note',
    title: '노래가 완성된 뒤',
    desc: '추억의 노래로 완성돼요',
  },
];

/** 이용 안내 (deck p.19) */
export default function GuidePage() {
  return (
    <Screen
      back
      title="이용 안내"
      subtitle="처음 쓰는 분도 쉽게 시작할 수 있어요"
      decoration={<Ornaments variant="notes" />}
      footer={<PrimaryButton href="/home" trailing={<Chevron className="text-white" />}>안내 확인했어요</PrimaryButton>}
    >
      <ul className="grid grid-cols-2 gap-3">
        {CARDS.map((c) => (
          <Card as="li" key={c.title} className="flex flex-col items-center px-3 py-5 text-center">
            <Art name={c.art} size={72} alt="" />
            <p className="mt-3 text-[1rem] font-extrabold leading-snug text-ink-900">
              {c.title}
            </p>
            <p className="mt-1.5 text-[0.875rem] leading-snug text-ink-500">{c.desc}</p>
          </Card>
        ))}
      </ul>

      <Card className="mt-4 flex items-center gap-2 overflow-hidden py-3 pl-4 pr-0">
        <p className="shrink-0 text-[1.4375rem] font-extrabold leading-[1.35] text-ink-900">
          어르신과
          <br />
          <span className="text-brand-700">천천히 함께</span>
          <br />
          진행하세요
        </p>
        <ArtBox
          name="scene_couple_hands"
          alt="어르신 두 분이 손을 맞잡고 계신 그림"
          className="min-w-0 flex-1"
          fit="contain"
          priority
        />
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <a
          href="#faq"
          className="flex min-h-[68px] items-center gap-2.5 rounded-[16px] bg-surface px-3.5 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[1.25rem] font-black text-ink-900">
            ?
          </span>
          <span className="flex-1 text-[1.0625rem] font-bold text-ink-900">
            자주 묻는 질문
          </span>
          <Chevron className="text-ink-300" />
        </a>
        <a
          href="#support"
          className="flex min-h-[68px] items-center gap-2.5 rounded-[16px] bg-surface px-3.5 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
        >
          <Art name="icon_headset" size={34} alt="" />
          <span className="flex-1 text-[1.0625rem] font-bold text-ink-900">문의하기</span>
          <Chevron className="text-ink-300" />
        </a>
      </div>

      <section id="faq" className="mt-6">
        <h2 className="text-[1.1875rem] font-extrabold text-ink-900">자주 묻는 질문</h2>
        <div className="mt-3 space-y-2.5">
          {[
            {
              q: '녹음을 원하지 않으시면 어떻게 하나요?',
              a: '녹음 없이도 진행할 수 있어요. 복지사가 어르신 말씀을 받아 적어 기록하고, 그 기록이 그대로 출처가 됩니다.',
            },
            {
              q: '가족이 참여하지 않으면 못 쓰나요?',
              a: '아니요. 가족 참여가 없어도 인터뷰부터 노래, 활동일지까지 모두 끝까지 진행할 수 있어요.',
            },
            {
              q: 'AI가 지어낸 이야기가 섞이지 않나요?',
              a: '모든 문장에는 음성·카드·복지사 기록·가족 제보 중 하나가 출처로 붙어요. 어르신이 확인한 이야기만 가사에 쓰입니다.',
            },
            {
              q: '치매나 우울을 진단해 주나요?',
              a: '하지 않습니다. 이 서비스는 문화·인지 활동 도구이고, 눈으로 관찰한 참여 반응만 기록해요.',
            },
          ].map((f) => (
            <details
              key={f.q}
              className="rounded-[16px] bg-surface p-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <summary className="cursor-pointer text-[1.0625rem] font-bold text-ink-900 marker:content-none">
                {f.q}
              </summary>
              <p className="mt-2 text-[1rem] leading-relaxed text-ink-700">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="support" className="mt-6">
        <h2 className="text-[1.1875rem] font-extrabold text-ink-900">문의하기</h2>
        <Card className="mt-3 p-4">
          <p className="text-[1rem] leading-relaxed text-ink-700">
            사용 중 어려운 점이 있으면 센터 담당자에게 알려 주세요. 오류가 난
            화면과 시각을 함께 전달해 주시면 더 빨리 도와드릴 수 있어요.
          </p>
        </Card>
      </section>
    </Screen>
  );
}
