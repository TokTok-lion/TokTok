'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ornaments, Screen } from '@/components/Shell';
import { ViewElderPicker } from '@/components/ViewElderPicker';
import { Card } from '@/components/ui';
import { CARD, HOLD, useReel } from '@/lib/useReel';
import { useElderScenes } from '@/lib/useElderScenes';
import { useViewElder } from '@/lib/viewElder';
import { useSession } from '@/lib/store';

/**
 * 사연 숏츠 — 그림이 노래에 맞춰 넘어가는 세로 영상.
 *
 * ── 왜
 *
 * 관장님 말씀이다 — "노래만 만들지 말고 사연이 담긴 그림이나 숏츠 제작까지
 * 되면 좋겠다, 링크로 가족까지 공유되면 베스트".
 *
 * ── 두 가지가 다르다
 *
 * **재생**은 어디서나 된다. 어르신 앞에서 그대로 틀면 되고, 태블릿 기본
 * 화면 녹화로 숏츠를 뽑으실 수도 있다.
 *
 * **영상 저장**은 되는 기기에서만 된다. 브라우저마다 갈리는 기능이라, 눌러
 * 보고 아무 일도 안 일어나는 것보다 미리 재서 없으면 없다고 적는다.
 *
 * ── 왜 우리가 직접 그리나
 *
 * <img> 를 그냥 띄우면 그건 영상으로 담을 수 없다. 캔버스에 그려야 담을 수
 * 있고(captureStream), 어차피 글자를 그림 위에 얹어야 해서 어느 쪽이든
 * 캔버스가 필요하다. 세로 9:16 — 숏츠가 서는 모양이다.
 *
 * ── 움직임
 *
 * 처음 판은 그림이 뚝 바뀌었다. 정지화면 넘김이지 영상이 아니었다. 지금은
 * 겹치며 바뀌고(FADE), 머무는 동안 아주 천천히 커진다. 어르신이 보시기에
 * 어지럽지 않을 만큼만 — 오 초에 4% 다.
 *
 * ── 표지와 맺음
 *
 * 앞뒤 삼 초씩. 가족이 받는 것은 그림이 아니라 어르신의 이야기라, 누구의
 * 이야기인지가 첫 화면에 있어야 한다.
 */
export default function ReelPage() {
  const { s } = useSession();
  const view = useViewElder();
  const owner = view.id ?? undefined;
  const { scenes: found, shared } = useElderScenes(owner, { approvedOnly: true });
  // 새 배열이 매 렌더마다 만들어지면 아래 이펙트들이 계속 돈다.
  const scenes = useMemo(() => found ?? [], [found]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const imgs = useRef<Map<string, HTMLImageElement>>(new Map());

  const reel = useReel(scenes, canvas, owner);
  const who = view.id ? `${view.name} 어르신` : s.elder.honorific;

  // 그림을 미리 읽어 둔다. 넘어가는 순간에 읽으면 한 박자 빈 화면이 뜬다.
  useEffect(() => {
    for (const sc of scenes) {
      if (imgs.current.has(sc.key)) continue;
      const im = new Image();
      im.src = sc.image;
      imgs.current.set(sc.key, im);
    }
  }, [scenes]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    setCanvas(cv);
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const W = cv.width;
    const H = cv.height;

    /** 그림 한 장을 가운데 위쪽에 놓는다. zoom 은 아주 천천히 커지는 값. */
    const paint = (key: string, alpha: number, zoom: number) => {
      const im = imgs.current.get(key);
      if (!im || !im.complete || !im.naturalWidth) return;
      const scale = Math.min(W / im.naturalWidth, W / im.naturalHeight) * zoom;
      const w = im.naturalWidth * scale;
      const h = im.naturalHeight * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, (W - w) / 2, H * 0.1 - (h - W) / 2, w, h);
      ctx.globalAlpha = 1;
    };

    /** 가운데 맞춘 여러 줄 글자. 담을 수 있는 줄까지만. */
    const words = (text: string, y: number, size: number, max: number, rows: number) => {
      ctx.font = `bold ${Math.round(size)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const lines: string[] = [];
      let line = '';
      for (const word of text.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > max && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      // 담기지 않은 줄이 있으면 말없이 자르지 않고 줄임표를 붙인다.
      const shown = lines.slice(0, rows);
      if (lines.length > rows && shown.length) {
        shown[shown.length - 1] = `${shown[shown.length - 1]}…`;
      }
      shown.forEach((l, i) => ctx.fillText(l, W / 2, y + i * size * 1.35));
    };

    let raf = 0;
    /** 한 장면을 그린다. 화면이 살아 있으면 매 프레임, 아니면 시계가 부른다. */
    const frame = () => {
      ctx.fillStyle = '#fdf6ec';
      ctx.fillRect(0, 0, W, H);

      const at = reel.at;
      const ending = at > reel.length - CARD;

      if (at < CARD) {
        // 표지
        ctx.fillStyle = '#8a7a68';
        words(`${who}의 이야기`, H * 0.44, W * 0.045, W * 0.86, 1);
        ctx.fillStyle = '#3d2b1a';
        words('우리들의 그림책', H * 0.52, W * 0.075, W * 0.86, 2);
      } else if (ending) {
        // 맺음
        ctx.fillStyle = '#3d2b1a';
        words('어르신께서 들려주신 이야기로', H * 0.46, W * 0.05, W * 0.86, 1);
        words('만든 노래입니다', H * 0.53, W * 0.05, W * 0.86, 1);
        ctx.fillStyle = '#8a7a68';
        words('똑똑 생애여정 음악지도', H * 0.62, W * 0.038, W * 0.86, 1);
      } else {
        const sc = scenes[reel.index];
        const prev = scenes[(reel.index - 1 + scenes.length) % scenes.length];
        // 머무는 동안 아주 천천히 커진다. 오 초에 4%.
        const held = (at - CARD) % HOLD;
        const zoom = 1 + (held / HOLD) * 0.04;
        if (prev && reel.fade < 1 && prev !== sc) paint(prev.key, 1 - reel.fade, 1.04);
        if (sc) paint(sc.key, reel.fade, zoom);

        if (sc) {
          ctx.fillStyle = '#3d2b1a';
          ctx.globalAlpha = reel.fade;
          words(sc.text, H * 0.79, W * 0.052, W * 0.86, 3);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#8a7a68';
          words(`${who}의 이야기`, H * 0.955, W * 0.034, W * 0.86, 1);
        }
      }

    };

    const draw = () => {
      frame();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    /*
     * 화면이 꺼지거나 다른 앱으로 넘어가면 requestAnimationFrame 이 멈춘다.
     * 담는 중이었다면 그 순간부터 영상이 얼어붙는다 — 소리는 흐르는데 그림만
     * 멎은 파일이 남는다. 태블릿 화면이 잠깐 어두워지는 것만으로도 그렇게 된다.
     *
     * 그래서 안 보이는 동안에는 시계로 대신 그린다. 초당 열 장이면 충분하다.
     */
    const spare = setInterval(() => {
      if (document.hidden) frame();
    }, 100);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(spare);
    };
  }, [scenes, reel.index, reel.fade, reel.at, reel.length, who]);

  const count = scenes.length;
  const secs = Math.round(reel.length);

  return (
    <Screen
      back
      title="사연 숏츠"
      subtitle="그림이 노래에 맞춰 넘어가요"
      decoration={<Ornaments variant="notes" />}
    >
      <ViewElderPicker />

      {found === null ? (
        <p className="text-center text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : count === 0 ? (
        <Card className="p-4">
          <p className="text-[1rem] font-bold text-ink-900">
            {shared === 'off' ? '이 기기에는 쓸 그림이 없어요' : '쓸 그림이 아직 없어요'}
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            {shared === 'off'
              ? '기관 저장소를 못 읽었어요. 통신이 되는 곳에서 다시 열어 봐 주세요.'
              : '사연 그림에서 「이 그림 쓰기」를 누른 그림만 여기에 나옵니다.'}
          </p>
          <Link
            href="/session/scenes"
            className="mt-3 inline-flex min-h-[52px] items-center rounded-[14px] bg-brand-700 px-5 text-[1rem] font-bold text-white"
          >
            사연 그림으로 가기
          </Link>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-[20px] bg-surface-sunk">
            <canvas
              ref={canvasRef}
              width={720}
              height={1280}
              className="block h-auto w-full"
              aria-label={`사연 숏츠 미리보기 — ${count}장 중 ${reel.index + 1}번째`}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={reel.toggle}
              className="min-h-[60px] rounded-[16px] bg-brand-700 text-[1.0625rem] font-extrabold text-white"
            >
              {reel.playing ? '멈춤' : '재생'}
            </button>
            <Link
              href="/session/book"
              className="flex min-h-[60px] items-center justify-center rounded-[16px] border border-hairline bg-surface-strong text-[1.0625rem] font-bold text-ink-700"
            >
              책으로 보기
            </Link>
          </div>

          <p className="mt-2 text-center text-[0.875rem] text-ink-500">
            그림 {count}장 · 한 장에 {HOLD}초 · 영상 길이 약 {secs}초
            <br />
            {reel.hasSong ? '이 기기의 노래와 함께' : '이 기기에 곡이 없어 그림만 넘어가요'}
          </p>

          {/* 영상으로 담기 — 되는 기기에서만 */}
          <Card className="mt-4 p-4">
            <p className="text-[1rem] font-extrabold text-ink-900">영상으로 담기</p>
            {reel.canRecord ? (
              <>
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-700">
                  담는 동안 화면을 끄거나 다른 화면으로 넘어가지 말아 주세요. 담기는
                  실제 시간만큼 걸립니다 — 아래 길이가 기다리셔야 하는 시간이에요.
                </p>

                {/*
                  짧게 담기.

                  숏츠는 삼십 초 안쪽이 낫고, 무엇보다 백 초짜리 곡이면 복지사가
                  백 초를 서서 기다려야 한다. 기본을 짧게 둔다.
                */}
                <label className="mt-3 flex min-h-[52px] items-center gap-3 rounded-[12px] bg-surface-sunk px-3.5">
                  <input
                    type="checkbox"
                    checked={reel.short}
                    onChange={(e) => reel.setShort(e.target.checked)}
                    disabled={reel.recording}
                    className="h-6 w-6 accent-brand-700"
                  />
                  <span className="text-[0.9375rem] font-bold text-ink-900">
                    30초로 짧게 담기
                  </span>
                </label>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={reel.recording ? reel.stopRecording : reel.startRecording}
                    className={`min-h-[52px] rounded-[12px] text-[0.9375rem] font-bold ${
                      reel.recording ? 'bg-danger-600 text-white' : 'bg-brand-700 text-white'
                    }`}
                  >
                    {reel.recording ? '담기 멈춤' : `영상 담기 (${secs}초)`}
                  </button>
                  {reel.video ? (
                    <a
                      href={reel.video.url}
                      download={`${who} 사연숏츠.${
                        reel.video.type.includes('mp4') ? 'mp4' : 'webm'
                      }`}
                      className="flex min-h-[52px] items-center justify-center rounded-[12px] bg-leaf-100 text-[0.9375rem] font-bold text-leaf-800"
                    >
                      영상 저장하기
                    </a>
                  ) : (
                    <span className="flex min-h-[52px] items-center justify-center rounded-[12px] bg-surface-sunk text-[0.9375rem] font-bold text-ink-500">
                      담고 나면 저장
                    </span>
                  )}
                </div>

                {reel.problem ? (
                  <p role="alert" className="mt-2 text-[0.875rem] font-bold leading-relaxed text-danger-600">
                    영상을 담지 못했어요. 다시 눌러 보시고, 계속 안 되면 아래 내용을
                    알려 주세요 — {reel.problem}
                  </p>
                ) : null}

                {reel.recording ? (
                  <p role="status" className="mt-2 text-[0.875rem] font-bold text-brand-700">
                    담는 중… {Math.round(reel.at)}초 / {secs}초
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-700">
                이 기기에서는 앱이 영상 파일을 만들 수 없어요. 대신 태블릿의
                <strong className="font-bold"> 화면 녹화</strong>를 켜고 위 「재생」을
                누르시면 같은 영상이 됩니다.
              </p>
            )}
          </Card>

          <p className="mt-4 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
            가족에게 보내시려면 가족 공유에 동의하셨는지 먼저 확인해 주세요. 앱에서
            바로 보내는 기능은 아직 없어서, 저장한 영상을 복지사님이 직접
            전달하셔야 합니다.
          </p>
        </>
      )}
    </Screen>
  );
}
