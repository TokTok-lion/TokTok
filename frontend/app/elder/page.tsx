'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, PrimaryButton } from '@/components/ui';
import { IconInfo, IconPlus } from '@/components/icons';
import { TOTAL_STEPS } from '@/lib/flow';
import {
  FAMILY_AVAILABILITY_LABELS,
  SERVICE_STATUS_LABELS,
  type ElderSummary,
  type ServiceStatus,
} from '@/lib/seed';
import { findOpenSession, lastGroupMembers, type OpenSession } from '@/lib/repo';
import { recordingCountOf } from '@/lib/recordingStore';
import { useElders } from '@/lib/useElders';
import { beginSession, resumeSession, useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

const FILTERS: { id: ServiceStatus | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '이용 중' },
  { id: 'paused', label: '일시중지' },
  { id: 'ended', label: '종료' },
];

/** 검색은 2자 이상부터 (F-SW-PTC-002). */
const MIN_QUERY = 2;

/**
 * 어르신 목록 (SW-PTC-L · 12 functions)
 *
 * The deck has no frame for this, but the spec does, and the app needs it:
 * a centre runs ~22 people at once and the tab used to open straight into a
 * single hard-coded profile.
 *
 * Only what the work needs is on screen — 가명, 내부번호, 진행 단계, 다음
 * 일정. 명세서 F-SW-PTC-002 forbids searching by resident number or health
 * information, so search covers name, code and topic only.
 */
export default function ElderListPage() {
  const { s } = useSession();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<ServiceStatus | 'all'>('all');
  /** 진행 중인 회기를 지우기 전에 물어볼 대상 */
  const [ask, setAsk] = useState<ElderSummary | null>(null);
  /**
   * 지금 어르신의 녹음이 이 기기에 몇 개 있는가.
   *
   * 어르신을 바꾸면 그 녹음들이 지워지는데(recorder.keepOnlyRecordingsOf),
   * 녹음은 서버로 올라가지 않아 되찾을 길이 없다. 그래서 묻기 전에 센다.
   */
  const [recCount, setRecCount] = useState(0);
  /**
   * 다른 태블릿에서 열어 둔 회기. 있으면 이어받을지 먼저 여쭙는다.
   *
   * 말없이 가져오지 않는다 — 두 복지사가 같은 회기를 서로 모른 채 고치는
   * 일이 생긴다. 반대로 묻지 않고 새로 시작해 버리면, 앞 선생님이 어르신께
   * 들은 이야기를 못 본 채 같은 것을 다시 여쭙게 된다.
   */
  const [resume, setResume] = useState<{ elder: ElderSummary; open: OpenSession } | null>(null);
  /** 서버에 물어보는 동안. 누른 뒤 아무 반응이 없으면 두 번 누른다. */
  const [checking, setChecking] = useState<string | null>(null);
  /**
   * 그룹 회기로 함께 모실 어르신들.
   *
   * 비어 있으면 지금까지처럼 1:1 이다 — 어르신을 누르면 바로 회기가 열린다.
   * 한 분이라도 담기면 목록이 '고르는 화면'으로 바뀐다.
   *
   * 현장이 대개 복지사 한 분에 어르신 서넛이라 넣었다. 다만 그룹은 조심할
   * 것이 있어서(누가 한 말인지 잘못 붙이면 남의 생애가 그분 노래에 들어간다)
   * 기본은 1:1 로 두고, 그룹은 눌러서 들어가는 길로 만든다.
   */
  const [picked, setPicked] = useState<ElderSummary[]>([]);
  /**
   * 오늘 누구와 하는가 — 한 분과, 아니면 여럿이 함께.
   *
   * '모드'라는 말을 화면에 쓰지 않는다. 복지사에게 이건 설정 전환이 아니라
   * 오늘의 일정이다. 기본은 「한 분과」다 — 앱 전체가 그것을 전제로 지어졌고,
   * 잘못 눌러 그룹으로 열리는 것보다 그 반대가 안전하다.
   */
  const [many, setMany] = useState(false);
  /** 지난번 명단을 불러오는 중 */
  const [loadingLast, setLoadingLast] = useState(false);

  useEffect(() => {
    const owner = s.remoteParticipantId;
    let alive = true;
    // 이펙트 본문에서 곧장 setState 하지 않는다 — 렌더가 연쇄로 돈다.
    // 어르신이 없을 때도 콜백을 거쳐 0 으로 되돌린다.
    void (owner ? recordingCountOf(owner) : Promise.resolve(0))
      .then((n) => {
        if (alive) setRecCount(n);
      })
      // 못 셌으면 0 이 아니라 '모른다'인데, 화면이 할 일은 같다 — 아래
      // losing() 의 다른 근거들이 여전히 묻게 만든다.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [s.remoteParticipantId]);
  // 로그인해서 기관이 정해졌으면 서버 목록, 아니면 시연용 씨앗
  const { elders, live, loading } = useElders();

  const query = q.trim();
  const list = useMemo(() => {
    const byStatus = elders.filter(
      (e) => filter === 'all' || e.status === filter,
    );
    if (query.length < MIN_QUERY) return byStatus;
    const needle = query.toLowerCase();
    return byStatus.filter((e) =>
      [e.displayName, e.code, e.topic, e.worker].some((v) =>
        v.toLowerCase().includes(needle),
      ),
    );
  }, [elders, filter, query]);

  /**
   * 어르신을 고르면 작업대 전체가 바뀐다.
   *
   * 예전에는 이름표만 갈아 끼웠다. 그래서 앞 어르신의 전사·이야기·가사·
   * 녹음이 다음 회기에 그대로 따라왔고, 그 상태로 곡을 만들면 다른 분의
   * 생애가 들어갔다. beginSession 이 작업대를 비운다.
   *
   * 더 나빴던 것은 그 다음이다. 작업대는 비웠는데 이 자리에서 `...s.elder`
   * 로 앞 어르신 객체를 펼쳐 넘기는 바람에 동의·선호·회피 주제가 조용히
   * 따라갔다. 박 어르신을 골라도 김 어르신의 '외부 AI 전송 허용'이 켜진 채로
   * 시작되고, 그 값 하나가 원음성 전송의 문이다. 이제는 신원 표시만 넘긴다 —
   * 동의는 beginSession 이 어르신별로 새로 세운다.
   *
   * 다만 말없이 비우지는 않는다. 30분짜리 인터뷰가 잘못 누른 한 번에
   * 사라지면 안 된다.
   */
  /**
   * 지난번 그룹과 같은 분들로 채운다.
   *
   * 인원이 고정이 아니어도 대개 비슷하다. 불러온 뒤 빠진 분만 빼면 되므로
   * 다섯 번 누를 일이 한 번과 얼마간으로 줄어든다.
   *
   * 지금 목록에 없는 분(종료·일시중지로 내려간 분)은 조용히 빠진다 — 명단에
   * 넣어 두고 회기를 열면 그분이 오늘 계신 것처럼 기록된다.
   */
  const fillFromLast = async () => {
    setLoadingLast(true);
    const ids = await lastGroupMembers().catch((): string[] => []);
    setLoadingLast(false);
    const found = elders.filter((e) => ids.includes(e.id) && e.status === 'active');
    if (found.length) setPicked(found);
  };

  const identity = (e: ElderSummary) => ({
    id: e.id,
    displayName: e.displayName,
    honorific: `${e.displayName} 어르신`,
    avatar: e.avatar,
    stage: e.step,
    nextTopic: e.topic,
  });

  const start = (e: ElderSummary, withGroup: ElderSummary[] = []) => {
    beginSession({
      // 함께 모신 분들. 기준 어르신은 여기 넣지 않는다 — 두 번 세어진다.
      group: withGroup.filter((g) => g.id !== e.id).map(identity),
      // 서버 목록에서 고른 경우에만 실제 participants.id 를 물린다. 씨앗
      // 어르신의 id 를 서버로 보내면 없는 행을 가리키게 된다.
      participantId: live ? e.id : null,
      topic: e.topic,
      elder: identity(e),
    });
    router.push('/elder/profile');
  };

  /**
   * 넘어가면 사라질 것들. 이름을 댈 수 있어야 물어보는 의미가 있다.
   *
   * 예전에는 전사·이야기·곡만 봤다. 그래서 **녹음만 해 둔 회기**가 구멍이었다 —
   * 어르신 말씀을 30분 받아 놓고 아직 글로 옮기기 전이면 transcript 도 story 도
   * 비어 있어서, 아무 말 없이 다음 어르신으로 넘어가고 그 소리가 지워졌다.
   * 되찾을 길이 없는 유일한 자료가 정확히 그것이다(녹음은 서버로 안 간다).
   */
  const losing = (): string[] => {
    const out: string[] = [];
    if (recCount > 0) out.push(recCount > 1 ? `녹음 ${recCount}개` : '녹음');
    if (s.transcript.length > 0) out.push(`전사 ${s.transcript.length}줄`);
    if (s.story.length > 0) out.push(`이야기 ${s.story.length}개`);
    if (s.lyrics.length > 0) out.push('가사');
    if (s.reactions.length > 0 || s.reactionNote.trim()) out.push('관찰 기록');
    if (s.logDraft.trim() && !s.logSaved) out.push('활동일지 초안');
    return out;
  };

  /**
   * 이 어르신에게 다른 태블릿이 열어 둔 회기가 있는지 보고, 있으면 여쭙는다.
   *
   * 이미 이 기기가 그 회기를 들고 있으면(같은 sessionId) 물을 것이 없다 —
   * 내가 하던 일이다.
   */
  const openOrAsk = async (e: ElderSummary) => {
    if (!live) {
      start(e);
      return;
    }
    setChecking(e.id);
    const found = await findOpenSession(e.id).catch(() => null);
    setChecking(null);

    const worthResuming =
      found !== null &&
      found.sessionId !== s.remoteSessionId &&
      (found.transcript.length > 0 || found.story.length > 0 || found.lyrics.length > 0);

    if (worthResuming) {
      setResume({ elder: e, open: found });
      return;
    }
    start(e);
  };

  const toggle = (e: ElderSummary) =>
    setPicked((was) =>
      was.some((x) => x.id === e.id)
        ? was.filter((x) => x.id !== e.id)
        : [...was, e],
    );

  const open = (e: ElderSummary) => {
    // 「여럿이 함께」에서는 카드를 눌러 담는다. 회기는 아래 바에서 연다 —
    // 담으려다 회기가 열리면 앞 회기가 지워진다.
    if (many) {
      toggle(e);
      return;
    }
    const switching = live && s.remoteParticipantId !== null && s.remoteParticipantId !== e.id;
    if (switching && losing().length > 0) {
      setAsk(e);
      return;
    }
    void openOrAsk(e);
  };

  const attention = elders.filter(
    (e) => e.consentExpiresInDays !== null && e.consentExpiresInDays <= 14,
  ).length;

  return (
    <Screen
      root
      title="어르신"
      subtitle={
        loading
          ? '불러오는 중…'
          : `이용 중 ${elders.filter((e) => e.status === 'active').length}명`
      }
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/elder/new"
          leading={
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/90">
              <IconPlus size={16} />
            </span>
          }
        >
          어르신 등록
        </PrimaryButton>
      }
    >
      {/* 다른 태블릿이 열어 둔 회기.
          말없이 가져오지도, 말없이 새로 시작하지도 않는다 — 앞엣것은 두
          선생님이 같은 회기를 모른 채 고치게 하고, 뒤엣것은 어르신께 같은
          이야기를 두 번 여쭙게 한다. */}
      {resume ? (
        <Card className="mb-4 border-2 border-leaf-300 p-4">
          <p className="text-[1.0625rem] font-extrabold text-ink-900">
            {resume.elder.displayName} 어르신 회기가 진행 중이에요
          </p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
            다른 태블릿에서 <strong className="text-ink-900">{resume.open.step}단계</strong>까지
            진행했어요. 지금까지 정리된 내용을 이어받을 수 있어요 —{' '}
            <strong className="text-ink-900">
              {[
                resume.open.transcript.length > 0 && `전사 ${resume.open.transcript.length}줄`,
                resume.open.story.length > 0 && `이야기 ${resume.open.story.length}개`,
                resume.open.lyrics.length > 0 && '가사',
              ]
                .filter(Boolean)
                .join(' · ')}
            </strong>
            .
          </p>
          {/* 녹음은 못 따라온다. 그 사실을 여기서 말해야, 이어받은 뒤에
              출처를 눌렀다가 소리가 안 나는 것을 고장으로 여기지 않는다. */}
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            녹음은 그 태블릿에만 있어요. 이어받으면 글로 옮긴 내용은 그대로
            보이지만, 출처를 눌러 어르신 목소리를 다시 듣는 것은 그 태블릿에서만
            됩니다.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const it = resume;
                setResume(null);
                start(it.elder);
              }}
              className="min-h-[52px] rounded-[14px] border border-hairline bg-surface-strong text-[1rem] font-bold text-ink-700"
            >
              새로 시작
            </button>
            <button
              type="button"
              onClick={() => {
                const it = resume;
                setResume(null);
                resumeSession(
                  {
                    participantId: it.elder.id,
                    topic: it.elder.topic,
                    elder: {
                      id: it.elder.id,
                      displayName: it.elder.displayName,
                      honorific: `${it.elder.displayName} 어르신`,
                      avatar: it.elder.avatar,
                      stage: it.elder.step,
                      nextTopic: it.elder.topic,
                    },
                  },
                  it.open,
                );
                router.push('/session');
              }}
              className="tk-cta min-h-[52px] rounded-[14px] text-[1rem] font-extrabold text-white"
            >
              이어받기
            </button>
          </div>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
            「새로 시작」을 고르시면 그 회기는 기관 기록에 그대로 남고, 이
            태블릿에서만 빈 회기로 시작합니다.
          </p>
        </Card>
      ) : null}

      {/* 30분짜리 인터뷰가 잘못 누른 한 번에 사라지면 안 된다.
          무엇이 사라지는지 이름을 대고 묻고, 살릴 길을 함께 준다. */}
      {ask ? (
        <Card className="mb-4 border-2 border-brand-300 p-4">
          <p className="text-[1.0625rem] font-extrabold text-ink-900">
            {s.elder.honorific} 회기가 진행 중이에요
          </p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
            {ask.displayName} 어르신으로 넘어가면 이 기기에서{' '}
            <strong className="text-ink-900">{losing().join(' · ')}</strong>이(가)
            지워집니다.
          </p>
          {/*
            녹음은 따로 말한다. 다른 자료와 무게가 다르다 — 기관 서버로 올라가지
            않으므로, 여기서 지워지면 어르신 목소리는 어디에도 남지 않는다.
          */}
          {recCount > 0 ? (
            <p className="mt-1.5 text-[0.9375rem] font-bold leading-relaxed text-danger-600">
              녹음은 이 기기에만 있어요. 지워지면 되살릴 수 없습니다.
            </p>
          ) : null}
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            {s.logSaved
              ? '활동일지는 기관 기록에 저장돼 있어요. 그 내용은 그대로 남습니다.'
              : '이 회기는 아직 기관 기록에 저장되지 않았어요. 활동일지에서 저장하시면 이야기와 관찰이 남고, 다른 태블릿에서도 보입니다.'}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAsk(null)}
              className="min-h-[52px] rounded-[14px] border border-hairline bg-surface-strong text-[1rem] font-bold text-ink-700"
            >
              지금 회기 계속
            </button>
            <button
              type="button"
              onClick={() => {
                const target = ask;
                setAsk(null);
                void openOrAsk(target);
              }}
              className="min-h-[52px] rounded-[14px] bg-danger-600 text-[1rem] font-bold text-white"
            >
              지우고 넘어가기
            </button>
          </div>

          {/* 저장하지 않은 회기에는 세 번째 길을 준다. '계속'과 '지우기' 둘만
              있으면, 저장할 수 있다는 사실을 아는 사람만 저장한다. */}
          {!s.logSaved ? (
            <button
              type="button"
              onClick={() => {
                setAsk(null);
                router.push('/session/log');
              }}
              className="mt-2 min-h-[52px] w-full rounded-[14px] border-2 border-brand-300 bg-surface-strong text-[1rem] font-bold text-brand-800"
            >
              먼저 기관 기록에 저장하기
            </button>
          ) : null}
        </Card>
      ) : null}

      <label htmlFor="elder-search" className="sr-only">
        어르신 검색
      </label>
      <input
        id="elder-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름 · 내부번호 · 주제로 찾기"
        className="min-h-[52px] w-full rounded-[16px] border border-hairline bg-surface-strong px-4 text-[1rem] text-ink-900 placeholder:text-ink-500"
      />
      {query.length > 0 && query.length < MIN_QUERY ? (
        <p className="mt-1.5 px-1 text-[0.8125rem] font-semibold text-brand-700">
          {MIN_QUERY}자 이상 입력해 주세요.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="이용 상태">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.id)}
              // 19px/800 keeps white-on-orange in WCAG "large text", where the
              // deck's vivid fill clears the 3:1 bar
              className={`min-h-[44px] shrink-0 rounded-full px-4 text-[1.1875rem] font-extrabold ${
                on ? 'tk-cta text-white' : 'border border-hairline bg-surface-strong text-ink-700'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {attention > 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-[14px] bg-amber-100/70 px-3.5 py-2.5 text-[0.875rem] font-semibold text-amber-700">
          <IconInfo size={17} className="mt-0.5 shrink-0" />
          동의 만료가 2주 안에 다가온 어르신이 {attention}명 있어요.
        </p>
      ) : null}

      {/*
        오늘 누구와 하는가.

        '모드'라는 말을 쓰지 않는다. 복지사에게 이건 설정 전환이 아니라 오늘의
        일정이다. 그리고 이 자리가 없으면 화면 어디에도 '여럿이 함께'라는 말이
        없어서, 그런 기능이 있는 줄 아무도 모른다.
      */}
      {live ? (
        <div
          role="group"
          aria-label="오늘 누구와 하실지"
          className="mt-3 grid grid-cols-2 gap-2"
        >
          {[
            { on: false, label: '한 분과' },
            { on: true, label: '여럿이 함께' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={many === opt.on}
              onClick={() => {
                setMany(opt.on);
                // 「한 분과」로 돌아가면 담아 둔 명단은 뜻을 잃는다. 남겨 두면
                // 다음에 「여럿이 함께」를 켰을 때 어제 명단이 되살아난다.
                if (!opt.on) setPicked([]);
              }}
              className={`min-h-[56px] rounded-[14px] border-2 text-[1.0625rem] font-bold ${
                many === opt.on
                  ? 'border-brand-400 bg-brand-50 text-brand-800'
                  : 'border-hairline bg-surface-strong text-ink-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {/*
        오늘 함께하실 분들.

        「여럿이 함께」를 켜면 한 분도 안 담겼어도 나타난다 — 무엇을 해야 하는지
        (카드를 눌러 담기) 말해 주는 자리이기도 하다.

        그룹은 조심할 것이 있다. 목소리로 누가 말했는지 갈라도 그게 어느
        어르신인지 앱은 모른다. 그래서 여기서 그 사실을 미리 적는다 — 이야기는
        기본이 '함께 나눈 이야기'이고, 개인 기록으로 올리는 것은 복지사가
        지정했을 때뿐이다.
      */}
      {many ? (
        <Card className="mt-3 border-2 border-leaf-300 p-4">
          <p className="text-[1.0625rem] font-extrabold text-ink-900">
            오늘 함께하실 어르신 {picked.length}분
          </p>

          {picked.length === 0 ? (
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-700">
              아래 목록에서 오늘 나오신 분들을 눌러 담아 주세요.
            </p>
          ) : (
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-700">
              {picked.map((x) => x.displayName).join(' · ')}
            </p>
          )}

          {/*
            여섯 분부터는 알린다. 막지는 않는다 — 현장에서 여섯 분이 앉아 계신
            날이 있고, 그때 앱이 막으면 복지사는 앱을 덮고 종이로 간다.
            대신 무엇이 나빠지는지는 정확히 적는다.
          */}
          {picked.length >= 6 ? (
            <p className="mt-2 text-[0.875rem] font-bold leading-relaxed text-brand-800">
              여섯 분이 넘으면 목소리를 가르는 정확도가 크게 떨어져요. 서로 다른
              분들의 말씀이 한 사람으로 뭉칠 수 있고, 한 분당 말씀하실 시간도
              5분이 채 안 됩니다. 진행하실 수는 있어요.
            </p>
          ) : null}

          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            함께 한 회기를 진행하고 <strong className="text-ink-700">노래 한 곡</strong>을
            만듭니다. 나온 이야기는 「함께 나눈 이야기」로 남고, 어느 분의
            생애인지는 복지사께서 지정하신 것만 개인 기록에 들어가요.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {/*
              지난번 명단 불러오기. 인원이 고정이 아니어도 대개 비슷하다 —
              불러온 뒤 빠진 분만 빼면 되므로 다섯 번 누를 일이 한 번이 된다.
            */}
            <button
              type="button"
              onClick={() => void fillFromLast()}
              disabled={loadingLast}
              className="min-h-[52px] rounded-[14px] border border-hairline bg-surface-strong text-[0.9375rem] font-bold text-ink-700 disabled:opacity-70"
            >
              {loadingLast ? '불러오는 중…' : '지난번과 같은 분들'}
            </button>
            <button
              type="button"
              onClick={() => setPicked([])}
              className="min-h-[52px] rounded-[14px] border border-hairline bg-surface-strong text-[0.9375rem] font-bold text-ink-700"
            >
              모두 빼기
            </button>
          </div>

          <button
            type="button"
            disabled={picked.length < 2 || checking !== null}
            onClick={() => {
              // 맨 앞 분이 저장 기준이 된다. 회기의 임자라는 뜻이 아니라
              // 녹음·곡의 칸 이름이 그 값으로 만들어진다는 뜻이다.
              const [head, ...rest] = picked;
              setPicked([]);
              start(head, rest);
            }}
            className="tk-cta mt-2 min-h-[60px] w-full rounded-[14px] text-[1.0625rem] font-extrabold text-white disabled:bg-hairline disabled:text-ink-500"
          >
            {picked.length < 2
              ? '두 분 이상 담아 주세요'
              : `${picked.length}분과 함께 회기 시작`}
          </button>
        </Card>
      ) : null}

      <ul className="mt-3 space-y-2.5">
        {list.map((e) => (
          <Card as="li" key={e.id} className="p-3">
            <button
              type="button"
              onClick={() => open(e)}
              aria-pressed={many ? picked.some((x) => x.id === e.id) : undefined}
              // 서버에 진행 중인 회기를 물어보는 동안 한 번 더 눌리면 두 번
              // 간다. 오래 걸리는 일은 아니지만, 조용하면 사람은 다시 누른다.
              disabled={checking !== null}
              aria-busy={checking === e.id}
              className={`flex w-full items-center gap-3.5 rounded-[12px] text-left disabled:opacity-70 ${
                many && picked.some((x) => x.id === e.id)
                  ? 'bg-leaf-50 ring-2 ring-leaf-400'
                  : ''
              }`}
            >
              <Art
                name={e.avatar as ArtKey}
                size={56}
                alt=""
                className={`shrink-0 ${e.status === 'active' ? '' : 'opacity-60'}`}
              />

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[1.1875rem] font-extrabold text-ink-900">
                    {e.displayName}
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-ink-500">
                    {e.code}
                  </span>
                  {e.status !== 'active' ? (
                    <Chip tone="neutral" size="sm">
                      {SERVICE_STATUS_LABELS[e.status]}
                    </Chip>
                  ) : null}
                  {e.consentExpiresInDays !== null && e.consentExpiresInDays <= 14 ? (
                    <Chip tone="amber" size="sm">
                      동의 D-{e.consentExpiresInDays}
                    </Chip>
                  ) : null}
                </span>

                <span className="mt-1 block text-[0.9375rem] text-ink-500">
                  {e.topic}
                </span>

                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-500">
                  <span className="font-semibold text-leaf-700">
                    {e.step}/{TOTAL_STEPS}단계
                  </span>
                  <span>담당 {e.worker}</span>
                  <span>{e.nextSession}</span>
                </span>

                <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-track">
                  <span
                    className="block h-full rounded-full bg-leaf-500"
                    style={{ width: `${(e.step / TOTAL_STEPS) * 100}%` }}
                  />
                </span>
              </span>

              <Chevron />
            </button>

            {e.family !== 'available' ? (
              <p className="mt-2 pl-[70px] text-[0.8125rem] text-ink-500">
                {FAMILY_AVAILABILITY_LABELS[e.family]} · 가족 없이도 끝까지 진행할 수
                있어요
              </p>
            ) : null}

          </Card>
        ))}
      </ul>

      {/* 검색해서 없는 것과, 아직 한 분도 등록 안 한 것은 다른 상황이다.
          갓 가입한 기관에 "찾는 어르신이 없어요"만 뜨면 무엇을 해야 할지
          알 수 없다. */}
      {list.length === 0 ? (
        elders.length === 0 && !loading ? (
          <div className="mt-8 text-center">
            <p className="text-[1.0625rem] font-bold text-ink-900">
              아직 등록된 어르신이 없어요
            </p>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
              첫 어르신을 등록하면 회기를 시작할 수 있어요.
            </p>
          </div>
        ) : (
          <p className="mt-10 text-center text-[1rem] font-semibold text-ink-500">
            찾는 어르신이 없어요.
          </p>
        )
      ) : null}

      <p className="mt-4 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        목록에는 업무에 필요한 최소 정보만 표시해요. 주민등록번호나 건강정보는
        저장하지도, 검색하지도 않습니다.
      </p>
    </Screen>
  );
}
