'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, NoteBar, PrimaryButton } from '@/components/ui';
import { IconShield } from '@/components/icons';
import { useAccount } from '@/lib/auth';
import { createParticipant } from '@/lib/repo';
import type { ArtKey } from '@/lib/art';

/**
 * 어르신 등록.
 *
 * 받는 것을 일부러 적게 뒀다. 이름 표기와 그림, 내부 번호뿐이다.
 * 실명·생년월일·주민등록번호·연락처는 받지 않는다 — 이 서비스가 하는 일은
 * 생애 이야기를 노래로 남기는 것이고, 그 일에 필요 없는 정보는 받지 않는
 * 편이 안전하다(최소수집). 안 받은 정보는 새지 않는다.
 *
 * 기관 이용자 명부와 맞추는 것은 '기관 번호'로 한다. 그것도 이름이 아니라
 * 번호라 그 자체로는 누구인지 알 수 없다.
 */

const AVATARS: { key: ArtKey; label: string }[] = [
  { key: 'avatar_grandfather_leaf' as ArtKey, label: '할아버지 1' },
  { key: 'avatar_grandfather_round' as ArtKey, label: '할아버지 2' },
  { key: 'avatar_grandfather' as ArtKey, label: '할아버지 3' },
  { key: 'avatar_grandmother' as ArtKey, label: '할머니 1' },
  { key: 'avatar_grandmother_round' as ArtKey, label: '할머니 2' },
];

export default function NewElderPage() {
  const router = useRouter();
  const { account } = useAccount();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [avatar, setAvatar] = useState<ArtKey>(AVATARS[0].key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = account.status === 'in';

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await createParticipant(name.trim(), {
      honorific: `${name.trim()} 어르신`,
      avatarKey: avatar,
      internalNo: code.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.reason ?? '등록하지 못했어요.');
      return;
    }
    router.push('/elder');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void save();
  };

  return (
    <Screen
      title="어르신 등록"
      subtitle="이름 표기와 그림만 정하면 돼요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          onClick={live ? () => void save() : undefined}
          disabled={!live || busy || name.trim().length < 1}
        >
          {busy ? '등록하는 중…' : '등록'}
        </PrimaryButton>
      }
    >
      {!live ? (
        <Card className="p-4">
          <p className="text-[1rem] font-bold text-ink-900">기관 로그인이 필요해요</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
            어르신은 기관 기록에 남습니다. 로그인하지 않으면 이 기기에만 남고
            다른 태블릿에서는 보이지 않아요.
          </p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="mt-3 min-h-[52px] w-full rounded-[14px] bg-brand-700 text-[1rem] font-bold text-white"
          >
            로그인하기
          </button>
        </Card>
      ) : null}

      <form onSubmit={submit} className={live ? '' : 'pointer-events-none opacity-50'}>
        <Card className="mt-3 p-4">
          <label className="block">
            <span className="block text-[1rem] font-bold text-ink-900">
              이름 표기
              <span className="ml-2 text-[0.875rem] font-medium text-ink-500">
                화면에 이렇게 보여요
              </span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="김○○"
              className="mt-2 min-h-[56px] w-full rounded-[14px] border-2 border-hairline bg-surface-strong px-4 text-[1.125rem] text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
            />
          </label>

          <label className="mt-4 block">
            <span className="block text-[1rem] font-bold text-ink-900">
              기관 번호
              <span className="ml-2 text-[0.875rem] font-medium text-ink-500">
                선택 · 명부와 맞출 때
              </span>
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="A-01"
              className="mt-2 min-h-[56px] w-full rounded-[14px] border-2 border-hairline bg-surface-strong px-4 text-[1.125rem] text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
            />
          </label>
        </Card>

        <Card className="mt-3 p-4">
          <p className="text-[1rem] font-bold text-ink-900">그림 고르기</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {AVATARS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-pressed={avatar === a.key}
                aria-label={a.label}
                onClick={() => setAvatar(a.key)}
                className={`flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 ${
                  avatar === a.key
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-transparent bg-surface-sunk'
                }`}
              >
                <Art name={a.key} size={54} alt="" />
              </button>
            ))}
          </div>
        </Card>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-[12px] bg-surface-sunk px-4 py-3 text-[0.9375rem] font-bold text-danger-600"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-3">
          {/* 무엇을 안 받는지 적어 둔다. 복지사가 어르신께 설명할 때 그대로
              읽을 수 있어야 한다. */}
          <NoteBar tone="leaf" icon={<IconShield size={20} />}>
            생년월일·주민등록번호·연락처는 받지 않아요. 이 서비스에 필요 없는
            정보라 아예 저장하지 않습니다.
          </NoteBar>
        </div>
      </form>
    </Screen>
  );
}
