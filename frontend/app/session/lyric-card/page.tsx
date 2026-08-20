'use client';

import { useEffect, useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, IconCircle, OutlineButton, PrimaryButton } from '@/components/ui';
import { IconEdit, IconExport } from '@/components/icons';
import { StaleLyricsNote } from '@/components/StaleLyricsNote';
import { printLog } from '@/lib/export';
import { songTitleForTopic } from '@/lib/scenes';
import { songMetaAt } from '@/lib/songStore';
import { matchesHash } from '@/lib/songSync';
import { useSession } from '@/lib/store';
import { useViewElder } from '@/lib/viewElder';
import type { LyricSection } from '@/lib/domain';

/**
 * 가사 카드 보기 (deck p.27)
 *
 * 이 화면은 어르신이 직접 눈으로 읽으시는 산출물이다. 게다가 곡 생성이
 * 실패했을 때 노래 만드는 중 화면이 내미는 대안이 "가사 카드로 진행"이라,
 * 곡이 안 나온 날에는 이것이 그날의 유일한 결과물이 된다.
 *
 * 그런데 여기 오래 박혀 있던 것은 SEED_LYRIC_CARD 네 줄과 '첫 월급 이야기'
 * 라는 고정 제목이었다. 고향 이야기를 하신 어르신께 남의 문장을 가장 큰
 * 글씨로 읽어 드리는 화면이었다는 뜻이다. 회상요법 도구에서 이보다 나쁜
 * 오류는 없다. 제목도 본문도 이 회기의 값(s.topic · s.lyrics)에서만 나온다.
 */
/**
 * 보관함에서 고른 지난 곡의 가사도 여기서 연다.
 *
 * 복지사 피드백이다 — "가사 PDF도 나중에 추가로 다운받을 수 있게 할 수
 * 있을까요. 중간 몇 어르신 PDF로 가사 다운을 못 해서". 이 화면이 회기
 * 상태만 읽어서, 회기가 끝나면 그 가사를 종이로 뽑을 길이 없었다.
 *
 * 노래방(sing)과 같은 방식이다 — 주소에 ?song=<칸이름> 이 붙으면 그 곡에
 * 붙어 있는 가사를 쓰고, 지문(matchesHash)이 맞을 때만 보여 준다. 회기
 * 상태는 건드리지 않는다.
 */
function pastSongKey(): string | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('song');
  return v && v.startsWith('s2:') ? v : null;
}

export default function LyricCardPage() {
  const { s, set } = useSession();
  const view = useViewElder();

  const [pastKey] = useState(pastSongKey);
  const [past, setPast] = useState<{
    topic: string | null;
    lyrics: LyricSection[];
  } | null>(null);
  useEffect(() => {
    if (!pastKey) return;
    let alive = true;
    void songMetaAt(pastKey)
      .then(async (m) => {
        const ok = await matchesHash(m?.lyrics, m?.style, m?.hash).catch(() => false);
        if (!alive) return;
        setPast({ topic: m?.topic ?? null, lyrics: ok && m?.lyrics ? m.lyrics : [] });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pastKey]);

  // 지난 곡이면 그 곡의 것만 쓴다. 회기 가사로 넘어가면 다른 노래의 글자가
  // 종이에 찍힌다 — 노래방에서 실제로 났던 사고다.
  const lyrics = pastKey ? (past?.lyrics ?? []) : s.lyrics;
  const topic = pastKey ? (past?.topic ?? null) : s.topic;
  // 종이에 적는 어르신 표기. 「보는 어르신」을 바꿨으면 그분이다.
  const elderName = pastKey && view.id ? view.name : s.elder.displayName;

  // 제목은 옆 화면(/session/song)과 같은 규칙을 쓴다. 두 화면이 나란히
  // 이어지는데 제목이 서로 다르면 어르신 눈앞에서 바로 들킨다.
  const title = topic ? songTitleForTopic(topic) : '주제가 남지 않은 노래';

  // 카드에 크게 싣는 대표 구절. 후렴이 있으면 후렴이다 — 여러 번 부르는
  // 대목이라 어르신도 가족도 그 줄을 기억하신다. 후렴이 없으면 첫 절.
  const feature = lyrics.find((sec) => sec.tone === 'chorus') ?? lyrics[0] ?? null;

  return (
    <Screen
      title="가사 카드 보기"
      subtitle="어르신과 함께 큰 글씨로 읽어 보세요"
      decoration={<Ornaments variant="notes" />}
      footer={
        feature ? (
          <>
            {/* 어르신 댁이나 기관 게시판에 붙일 종이. 화면에서 큰 글씨로
                읽는 것과 종이로 드리는 것은 다른 일이다 — 회기가 끝나도
                남는 것은 종이 쪽이다. */}
            <div className="mb-3">
              <OutlineButton tone="leaf" onClick={printLog} leading={<IconExport size={22} />}>
                가사 인쇄 · PDF로 저장
              </OutlineButton>
            </div>
          <PrimaryButton
            href={pastKey ? `/session/sing?song=${encodeURIComponent(pastKey)}` : '/session/sing'}
            leading={
              <IconCircle tone="neutral" size={30}>
                <Art name="ui_music" size={17} alt="" />
              </IconCircle>
            }
          >
            함께 부르기
          </PrimaryButton>
          </>
        ) : pastKey ? null : (
          // 막다른 길을 두지 않는다. 가사가 없으면 다음 단계로 미는 대신
          // 만들러 갈 수 있는 곳을 준다.
          <PrimaryButton href="/session/lyrics" leading={<IconEdit size={22} />}>
            가사 만들러 가기
          </PrimaryButton>
        )
      }
    >
      {/* 이 카드와 인쇄본은 고치신 대로 나가지만 노래는 아직 옛 가사다.
          어르신께 종이를 드리면서 노래를 함께 트는 자리라 여기서도 말한다. */}
      <StaleLyricsNote where="card" />

      {feature ? (
        <Card className="p-3.5">
          <p className="flex items-center justify-center gap-2 text-[1.0625rem] font-bold text-ink-900">
            <Art name="leaf_sprig" size={22} alt="" />
            {title}
            <Art name="leaf_sprig" size={22} alt="" className="-scale-x-100" />
          </p>

          <div className="relative mt-3 overflow-hidden rounded-[18px] border border-brand-200 bg-[#fdf5e8] px-4 py-9">
            <span className="absolute left-4 top-4 text-[1.375rem] text-brand-300" aria-hidden>
              ♥
            </span>
            <span className="absolute bottom-4 right-4 text-[1.375rem] text-brand-300" aria-hidden>
              ♥
            </span>
            <Art
              name="leaf_branch_1"
              size={70}
              alt=""
              className="absolute -right-2 top-1 opacity-70"
            />
            <Art
              name="leaf_branch_2"
              size={58}
              alt=""
              className="absolute -left-1 bottom-2 opacity-60"
            />

            {/* 노래의 어느 대목인지 밝힌다 — 함께 부를 때 짚기 쉽다. */}
            <p className="relative text-center text-[0.9375rem] font-bold text-brand-700">
              · {feature.label} ·
            </p>
            <p className="relative mt-2 text-center text-[1.625rem] font-extrabold leading-[1.6] tracking-[-0.01em] text-ink-900">
              {feature.lines.map((line, i) => (
                <span key={`${i}-${line}`} className="block">
                  {line}
                </span>
              ))}
            </p>
          </div>

          {s.lyrics.length > 1 ? (
            <p className="mt-3 text-center text-[0.875rem] text-ink-500">
              가사 전체는 가사 검수 화면에서 볼 수 있어요.
            </p>
          ) : null}
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-[1.0625rem] font-bold text-ink-900">
            {pastKey ? '이 곡에 남아 있는 가사가 없어요' : '아직 가사가 없어요'}
          </p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
            {pastKey
              ? /*
                 * 없어진 가사를 지어내지 않는다. 곡을 만든 그 가사가 확인될
                 * 때만 종이로 나간다 — 다른 노래의 글자가 어르신 이름으로
                 * 인쇄되는 것이 최악이다.
                 */
                '가사 칸이 생기기 전에 만든 곡이거나, 만들고 나서 가사를 고친 곡이에요. 노래는 보관함에서 그대로 들으실 수 있어요.'
              : '어르신이 확인해 주신 이야기로 가사를 만들면, 그 문장이 여기에 큰 글씨로 올라와요.'}
          </p>
        </Card>
      )}

      {/* 예전에는 여기에 '이미지 저장'·'가족에게 공유'·'다시 수정' 버튼이
          세 개 놓여 있었고 셋 다 onClick 이 없었다. 이미지로 굽는 코드도,
          가족에게 보내는 코드도 이 저장소에 없다 — 없는 것을 있다고 해 두면
          복지사는 보냈다고 믿고 화면을 넘긴다. 실제로 되는 것 하나만 남기고
          나머지는 아래 문장으로 정직하게 밝힌다.

          가사가 없을 때는 이 묶음을 통째로 내린다. 없는 가사를 '고치러' 갈
          수는 없고(푸터의 '가사 만들러 가기'와 같은 곳으로 가는 버튼이 둘이
          되기도 했다), 읽어 드릴 문장이 한 줄도 없는 화면에서 "함께 크게 읽어
          드리고"는 하지 않은 일을 한 것처럼 말한다. */}
      {feature && !pastKey ? (
        <>
          <div className="mt-4">
            <OutlineButton href="/session/lyrics" leading={<IconEdit size={22} />}>
              가사 고치러 가기
            </OutlineButton>
          </div>

          <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
            이미지로 저장하거나 가족에게 바로 보내는 기능은 아직 없어요. 지금은
            이 화면을 어르신과 함께 크게 읽어 드리고, 문장을 바꾸시려면 가사
            검수로 돌아가 다시 만들어 주세요.
          </p>
        </>
      ) : null}

      {/* 글자 크기 조절 — 카드가 실제로 커진다 (NFR-A11Y-003) */}
      {feature ? (
        <Card className="mt-4 p-3.5">
          <div className="flex items-center gap-3">
            <Art name="icon_text_size" size={48} alt="" className="shrink-0" />
            <p className="flex-1 text-[0.9375rem] leading-snug text-ink-700">
              큰 글씨로 보여드려 어르신이 함께 읽기 쉬워요
            </p>
          </div>
          <div className="mt-3 flex gap-2" role="group" aria-label="글자 크기">
            {[
              { v: 1, label: '보통' },
              { v: 1.15, label: '크게' },
              { v: 1.3, label: '아주 크게' },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={s.textScale === o.v}
                onClick={() => set('textScale', o.v)}
                className={`min-h-[48px] flex-1 rounded-[12px] text-[0.9375rem] font-bold ${
                  s.textScale === o.v
                    ? 'bg-leaf-600 text-white'
                    : 'bg-leaf-100 text-leaf-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {/* 종이에 나가는 가사. 화면 카드와 따로 두는 이유는 크기다 — 화면은
          한 절씩 크게 보여 주지만 종이는 전곡이 한 장에 들어가야 한다. */}
      <div data-print className="hidden">
        <h1 style={{ fontSize: '22pt', fontWeight: 800, marginBottom: '2mm' }}>
          {title}
        </h1>
        <p style={{ fontSize: '10pt', color: '#555', marginBottom: '8mm' }}>
          {elderName} 어르신 · {new Date().getFullYear()}년{' '}
          {new Date().getMonth() + 1}월 {new Date().getDate()}일
        </p>
        {lyrics.map((sec, i) => (
          <div key={`${sec.label}-${i}`} style={{ marginBottom: '7mm' }}>
            <p style={{ fontSize: '11pt', fontWeight: 700, color: '#7a542e', marginBottom: '2mm' }}>
              {sec.label}
            </p>
            {sec.lines.map((line, j) => (
              <p key={j} style={{ fontSize: '15pt', lineHeight: 1.9, margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        ))}
        <p style={{ marginTop: '8mm', fontSize: '9pt', color: '#555' }}>
          어르신께서 들려주신 이야기로 만든 가사입니다 · 똑똑 생애여정 음악지도
        </p>
      </div>
    </Screen>
  );
}
