'use client';

import { getSupabase } from './supabase';
import { currentAccount } from './auth';
import { currentSession } from './store';

/**
 * 곡을 기관 저장소에 두기.
 *
 * 곡은 만든 기기 안에만 있었다. 센터에 태블릿이 두 대면 같은 어르신의 같은
 * 곡이 두 번 만들어지고, 90초 곡 하나가 1,125크레딧이다. 서버에 두면 어르신
 * 한 분의 한 곡은 정말 한 번만 만들어진다.
 *
 * 서버가 없거나 로그인 전이면 전부 조용히 건너뛴다. 곡 만들기 자체는 서버
 * 없이도 되어야 하고, 그때는 지금처럼 기기에만 남는다.
 */

/**
 * 가사에서 짧은 지문을 만든다.
 *
 * 가사 원문을 키로 쓰면 인덱스가 커지고, 무엇보다 DB 인덱스에 어르신의
 * 이야기가 그대로 박힌다. 같은지 다른지만 알면 되므로 해시로 충분하다.
 */
export async function lyricsHash(lyrics: string, style: string): Promise<string> {
  const data = new TextEncoder().encode(`${style}::${lyrics}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function ctx() {
  const sb = getSupabase();
  const a = currentAccount();
  const s = currentSession();
  if (!sb || a.status !== 'in' || !s.remoteParticipantId) return null;
  return { sb, tenantId: a.tenantId, participantId: s.remoteParticipantId };
}

/**
 * 이미 만들어 둔 곡이 서버에 있는지 본다.
 *
 * 있으면 내려받아 그대로 쓴다 — 이것이 다른 태블릿에서 다시 만들지 않게
 * 하는 지점이다.
 */
export async function findServerSong(hash: string): Promise<Blob | null> {
  const c = ctx();
  if (!c) return null;

  const { data, error } = await c.sb
    .from('songs')
    .select('audio_path')
    .eq('participant_id', c.participantId)
    .eq('lyrics_hash', hash)
    .not('audio_path', 'is', null)
    .limit(1)
    .maybeSingle();
  if (error || !data?.audio_path) return null;

  const file = await c.sb.storage.from('songs').download(data.audio_path);
  if (file.error || !file.data) return null;
  return file.data;
}

/**
 * 만든 곡을 기관 저장소에 올린다.
 *
 * 실패해도 회기를 막지 않는다. 곡은 이미 기기에 있고, 다음에 로그인된 상태로
 * 열면 다시 올라간다. 통신 때문에 어르신 앞에서 흐름이 멈추는 편이 더 나쁘다.
 */
export async function uploadSong(
  blob: Blob,
  hash: string,
  meta: { title: string; style: string; lengthMs: number; sessionId: string | null },
): Promise<boolean> {
  const c = ctx();
  if (!c) return false;

  const path = `${c.tenantId}/${c.participantId}/${hash}.mp3`;
  const up = await c.sb.storage
    .from('songs')
    .upload(path, blob, { contentType: 'audio/mpeg', upsert: true });
  if (up.error) return false;

  // 파일과 표를 함께 맞춘다. 표에만 있고 파일이 없으면 다음에 내려받다 실패한다.
  const row = {
    tenant_id: c.tenantId,
    participant_id: c.participantId,
    session_id: meta.sessionId,
    title: meta.title,
    style: meta.style,
    status: 'complete' as const,
    audio_path: path,
    lyrics_hash: hash,
    length_ms: meta.lengthMs,
    provider: 'elevenlabs',
  };

  const { error } = await c.sb
    .from('songs')
    .upsert(row, { onConflict: 'participant_id,lyrics_hash,style' });
  return !error;
}

/** 서버에 올려 둔 곡을 지운다 — 삭제 요청에 응할 수 있어야 한다. */
export async function deleteServerSongs(): Promise<void> {
  const c = ctx();
  if (!c) return;
  const { data } = await c.sb
    .from('songs')
    .select('audio_path')
    .eq('participant_id', c.participantId);
  const paths = (data ?? []).map((r) => r.audio_path).filter((p): p is string => !!p);
  if (paths.length) await c.sb.storage.from('songs').remove(paths);
  await c.sb.from('songs').delete().eq('participant_id', c.participantId);
}
