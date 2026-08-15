'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Ornaments, Screen } from '@/components/Shell';
import { Card } from '@/components/ui';
import { readScenes, type Scene } from '@/lib/sceneStore';
import { songTitleForTopic } from '@/lib/scenes';
import { useReel } from '@/lib/useReel';
import { useSession } from '@/lib/store';

/**
 * 사연 숏츠 — 그림이 노래에 맞춰 넘어가는 화면.
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
 * ── 그림 위에 글자를 얹는다
 *
 * 그 그림이 어느 말씀에서 나왔는지가 영상에도 남아야 한다. 가족이 받는 것은
 * 그림이 아니라 어르신의 이야기다.
 */
export default function ReelPage() {
  const { s } = useSession();
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const imgs = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    void readScenes().then((all) => setScenes(all.filter((x) => x.approved)));
  }, []);

  const reel = useReel(scenes ?? [], canvas);
  const title = songTitleForTopic(s.topic);

  // 그림을 미리 읽어 둔다. 넘어가는 순간에 읽으면 한 박자 빈 화면이 뜬다.
  useEffect(() => {
    for (const sc of scenes ?? []) {
      if (imgs.current.has(sc.key)) continue;
      const im = new Image();
      im.src = sc.image;
      imgs.current.set(sc.key, im);
    }
  }, [scenes]);

  /*
   * 화면을 우리가 직접 그린다.
   *
   * <img> 를 그냥 띄우면 그건 영상으로 담을 수 없다. 캔버스에 그려야 담을
   * 수 있고(captureStream), 어차피 글자를 그림 위에 얹어야 해서 어느 쪽이든
   * 캔버스가 필요하다. 세로 9:16 — 숏츠가 서는 모양이다.
   */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    setCanvas(cv);
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const W = cv.width;
      const H = cv.height;
      ctx.fillStyle = '#fdf6ec';
      ctx.fillRect(0, 0, W, H);

      const sc = (scenes ?? [])[reel.index];
      const im = sc ? imgs.current.get(sc.key) : null;
      if (im && im.complete && im.naturalWidth) {
        // 가로세로를 지키며 가운데 위쪽에 놓는다.
        const box = W;
        const scale = Math.min(box / im.naturalWidth, box / im.naturalHeight);
        const w = im.naturalWidth * scale;
        const h = im.naturalHeight * scale;
        ctx.drawImage(im, (W - w) / 2, H * 0.1, w, h);
      }

      // 아래쪽에 그 말씀을 얹는다.
      if (sc) {
        ctx.fillStyle = '#3d2b1a';
        ctx.font = `bold ${Math.round(W * 0.052)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        const max = W * 0.86;
        const words = sc.text.split(' ');
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > max && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        const startY = H * 0.79;
        lines.slice(0, 3).forEach((l, i) => {
          ctx.fillText(l, W / 2, startY + i * W * 0.075);
        });

        ctx.fillStyle = '#8a7a68';
        ctx.font = `${Math.round(W * 0.034)}px system-ui, sans-serif`;
        ctx.fillText(`${title} · 어르신이 들려주신 이야기`, W / 2, H * 0.955);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scenes, reel.index, title]);

  const count = scenes?.length ?? 0;

  return (
    <Screen
      back
      title="사연 숏츠"
      subtitle="그림이 노래에 맞춰 넘어가요"
      decoration={<Ornaments variant="notes" />}
    >
      {scenes === null ? (
        <p className="text-center text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : count === 0 ? (
        <Card className="p-4">
          <p className="text-[1rem] font-bold text-ink-900">쓸 그림이 아직 없어요</p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            사연 그림에서 「이 그림 쓰기」를 누른 그림만 여기에 나옵니다.
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
            그림 {count}장 · {reel.hasSong ? '이 기기의 노래와 함께' : '이 기기에 곡이 없어 그림만 넘어가요'}
          </p>

          {/* 영상으로 담기 — 되는 기기에서만 */}
          <Card className="mt-4 p-4">
            <p className="text-[1rem] font-extrabold text-ink-900">영상으로 담기</p>
            {reel.canRecord ? (
              <>
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-700">
                  처음부터 끝까지 담깁니다. 담는 동안 화면을 끄거나 다른 화면으로
                  넘어가지 말아 주세요.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={reel.recording ? reel.stopRecording : reel.startRecording}
                    className={`min-h-[52px] rounded-[12px] text-[0.9375rem] font-bold ${
                      reel.recording ? 'bg-danger-600 text-white' : 'bg-brand-700 text-white'
                    }`}
                  >
                    {reel.recording ? '담기 멈춤' : '영상 담기 시작'}
                  </button>
                  {reel.video ? (
                    <a
                      href={reel.video.url}
                      download={`${title}-숏츠.${reel.video.type.includes('mp4') ? 'mp4' : 'webm'}`}
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
