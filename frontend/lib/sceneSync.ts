'use client';

import { accountReady } from './auth';
import { cacheServerScene, type Scene } from './sceneStore';
import { currentSession } from './store';
import { getSupabase } from './supabase';

/**
 * 사연 그림을 기관 저장소에 남긴다.
 *
 * ── 왜
 *
 * 그림이 태블릿 안에만 있었다. 다른 복지사 태블릿에서는 안 보이고, 기기를
 * 초기화하면 사라지고, 지난 회기 그림을 다시 볼 방법도 없었다. 노래는 이미
 * 이 길로 다니고 있어서(lib/songSync) 같은 모양으로 낸다.
 *
 * ── 확정한 것만 올린다
 *
 * 복지사가 「이 그림 쓰기」를 누른 그림만 서버에 간다. 초안은 기기에만 둔다 —
 * 확정하지 않은 그림이 기관 저장소에 쌓이면 그것도 기록이 되고, 어느 것이
 * 사람 손을 거친 것인지 알 수 없어진다(원칙 3).
 *
 * ── 실패해도 회기를 막지 않는다
 *
 * 센터 와이파이는 자주 끊긴다. 못 올리면 기기에 그대로 남고, 화면은 기기
 * 것을 그린다. 다음에 다시 누르면 올라간다.
 */

function warn(what: string, why: string) {
  // 조용히 삼키지 않는다. 곡이 넉 달 동안 한 곡도 안 올라간 적이 있는데
  // 아무도 몰랐던 이유가 이 자리에 로그가 없어서였다.
  console.warn(`[똑똑] 그림 ${what} 실패: ${why}`);
}

async function ctx() {
  const sb = getSupabase();
  if (!sb) return null;
  const a = await accountReady();
  const s = currentSession();
  if (a.status !== 'in' || !s.remoteParticipantId) return null;
  return { sb, tenantId: a.tenantId, participantId: s.remoteParticipantId };
}

/** data: URI 를 올릴 수 있는 덩어리로. */
function toBlob(dataUri: string): Blob | null {
  const at = dataUri.indexOf(',');
  if (at < 0) return null;
  const mime = /data:([^;]+)/.exec(dataUri)?.[1] ?? 'image/png';
  try {
    const bin = atob(dataUri.slice(at + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/** 확정한 그림 한 장을 기관 저장소에 올린다. */
export async function uploadScene(scene: Scene): Promise<boolean> {
  const c = await ctx();
  if (!c) return false;
  const blob = toBlob(scene.image);
  if (!blob) return false;

  const path = `${c.tenantId}/${c.participantId}/${scene.factId}.png`;
  const up = await c.sb.storage
    .from('scenes')
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (up.error) {
    warn('파일 올리기', up.error.message);
    return false;
  }

  const { error } = await c.sb.from('scenes').upsert(
    {
      tenant_id: c.tenantId,
      participant_id: c.participantId,
      session_key: scene.sessionId,
      fact_id: scene.factId,
      text: scene.text,
      image_path: path,
      approved: true,
    },
    { onConflict: 'participant_id,fact_id' },
  );
  if (error) {
    warn('표에 적기', error.message);
    return false;
  }
  return true;
}

/** 서버에 있는 이 어르신의 그림들. 못 읽으면 빈 목록. */
export async function listServerScenes(): Promise<Scene[]> {
  const c = await ctx();
  if (!c) return [];

  const { data, error } = await c.sb
    .from('scenes')
    .select('session_key, fact_id, text, image_path, created_at')
    .eq('participant_id', c.participantId)
    .order('created_at', { ascending: false });
  if (error || !data) {
    if (error) warn('목록 읽기', error.message);
    return [];
  }

  const out: Scene[] = [];
  for (const row of data) {
    const file = await c.sb.storage.from('scenes').download(row.image_path);
    if (file.error || !file.data) continue;
    const image = await new Promise<string>((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => res('');
      fr.readAsDataURL(file.data);
    });
    if (!image) continue;

    const scene: Scene = {
      key: `${c.participantId}::${row.session_key ?? 'server'}::${row.fact_id}`,
      ownerId: c.participantId,
      sessionId: row.session_key ?? 'server',
      factId: row.fact_id,
      text: row.text,
      image,
      madeAt: new Date(row.created_at).getTime(),
      // 서버에 있는 것은 확정된 것뿐이다(uploadScene 이 그것만 올린다).
      approved: true,
    };
    out.push(scene);
    // 다음에는 통신을 기다리지 않게 기기에도 둔다.
    void cacheServerScene(scene);
  }
  return out;
}
