import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/Shell';
import { PrimaryButton, Chevron } from '@/components/ui';
import { LaunchPopup } from '@/components/LaunchPopup';

/** 스플래시 · 시작 (deck p.1) */
export default function SplashPage() {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[440px] flex-col overflow-hidden">
      {/* warmer, more saturated wash than the inner screens */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(90% 42% at 22% 12%, rgba(254,220,158,0.85) 0%, rgba(254,220,158,0) 62%),' +
            'linear-gradient(180deg, #fef0d6 0%, #fdeacb 46%, #fdd9a0 100%)',
        }}
      />
      {/* soft dunes at the foot of the screen */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10" aria-hidden>
        <svg viewBox="0 0 440 260" className="w-full" preserveAspectRatio="none">
          <path d="M0 96C86 52 150 118 232 96s142-58 208-30v194H0Z" fill="#fde3b4" opacity=".8" />
          <path d="M0 158c92-46 156 22 244-4s136-46 196-18v124H0Z" fill="#fcd699" opacity=".85" />
        </svg>
      </div>

      {/* 인앱 브라우저면 크롬으로 넘기고, 아니면 홈 화면 설치를 권한다.
          X로 닫으면 첫 화면을 그대로 쓸 수 있다. */}
      <LaunchPopup />

      <main id="main" className="flex flex-1 flex-col items-center px-6 pb-8 pt-14">
        <Logo size="lg" />

        <h1 className="mt-5 text-center text-[1.875rem] font-extrabold leading-tight tracking-[-0.02em] text-ink-900">
          생애여정 음악지도
        </h1>
        <p className="mt-2.5 text-center text-[0.9375rem] font-semibold text-ink-500">
          어르신의 삶을 노래로 남기는 따뜻한 기록
        </p>

        <div className="mt-7 w-full max-w-[320px]">
          <Image
            src="/art/scene-couple-reading.webp"
            alt="어르신 두 분이 사진첩을 함께 보고 계신 그림"
            width={800}
            height={489}
            priority
            className="h-auto w-full"
          />
        </div>

        <div className="mt-auto w-full pt-8">
          <PrimaryButton href="/home" trailing={<Chevron className="text-white" />}>
            시작하기
          </PrimaryButton>

          <div className="mt-5 text-center">
            <Link
              href="/guide"
              className="inline-flex min-h-[44px] items-center gap-1 border-b-2 border-leaf-300 px-1 text-[1rem] font-bold text-leaf-700"
            >
              서비스 소개 보기
              <Chevron className="text-leaf-700" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
