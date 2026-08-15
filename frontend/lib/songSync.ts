'use client';

import { getSupabase } from './supabase';
import { accountReady } from './auth';
import { currentSession } from './store';
import type { LyricSection, MusicStyleId } from './domain';
import { MUSIC_STYLES } from './domain';

/**
 * 곡을 기관 저장소에 두기.
 *
 * 곡은 만든 기기 안에만 있었다. 센터에 태블릿이 두 대면 같은 어르신의 같은
 * 곡이 두 번 만들어진다. 서버에 두면 어르신 한 분의 한 곡은 정말 한 번만
 * 만들어진다 — 요금보다도, 같은 노래를 새로 들려드리는 일이 없어야 한다.
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

/**
 * 서버에 말을 걸 수 있는 상태인가 — 로그인 확인이 끝나기를 기다린 뒤에 답한다.
 *
 * 예전에는 currentAccount() 를 그 자리에서 읽었다. 앱이 막 뜬 순간에는 그
 * 값이 아직 'loading' 이라, 화면이 뜨자마자 부르는 쪽은 전부 "로그인 안 됨"
 * 으로 취급됐다. 보관함이 정확히 그랬다 — 열자마자 서버를 읽으니 늘 한 발
 * 빨랐고, 그래서 기관에 있는 곡을 한 곡도 못 가져오면서 화면에는 "이 기기에
 * 있는 노래만 보여 드려요"라고 적었다. 있는 것을 없다고 말한 것이다.
 *
 * accountReady 는 그 확인이 끝날 때까지만 기다리고, 통신이 끊긴 곳에서는
 * 시간이 지나면 그때 상태로 답한다 — 회기가 서버 때문에 멈추지는 않는다.
 */
async function ctx(participantId?: string) {
  const sb = getSupabase();
  if (!sb) return null;
  const a = await accountReady();
  const s = currentSession();
  // 보는 어르신을 따로 준 경우가 있다(기록의 「보는 어르신」). 없으면 회기.
  const who = participantId ?? s.remoteParticipantId;
  if (a.status !== 'in' || !who) return null;
  return { sb, tenantId: a.tenantId, participantId: who };
}

/**
 * 이미 만들어 둔 곡이 서버에 있는지 본다.
 *
 * 있으면 내려받아 그대로 쓴다 — 이것이 다른 태블릿에서 다시 만들지 않게
 * 하는 지점이다.
 */
export async function findServerSong(hash: string): Promise<Blob | null> {
  const c = await ctx();
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

/* ------------------------------------------------------------------ *
 * 기관에 있는 곡 목록
 *
 * 곡은 처음부터 서버에 올라가고 있었는데, 보관함은 기기(IndexedDB)만
 * 읽었다. 그래서 A 태블릿에서 만든 노래를 B 태블릿에서 열면 "아직 저장된
 * 곡이 없어요"였다 — 서버에는 멀쩡히 있는데도. 같은 기관으로 로그인했으면
 * 그 기관의 노래가 보여야 한다.
 *
 * 목록만 읽는다. 파일은 누를 때 내려받는다 — 보관함을 여는 것만으로 몇
 * MB짜리 곡을 여러 개 당기면, 센터 와이파이에서 화면이 한참 멎는다.
 * ------------------------------------------------------------------ */

export type ServerSong = {
  /** songs.id — 기기 칸 이름과 겹치지 않게 앞에 표시를 붙여 쓴다 */
  id: string;
  /** storage 안의 위치. 누를 때 이걸로 내려받는다. */
  path: string;
  /**
   * 주제. 서버 title 칸에 들어 있는 값이 그대로 주제다(uploadSong 이
   * now.topic 을 넣는다). 목록의 제목·그림은 둘 다 여기서 나온다.
   */
  topic: string | null;
  cover: string | null;
  style: MusicStyleId | null;
  madeAt: number | null;
  hash: string | null;
  /** 이 곡의 가사. 예전 곡은 비어 있다(0011 이전에 만든 곡). */
  lyrics: LyricSection[] | null;
};

/** 아는 분위기 이름일 때만 돌려준다. 모르는 값은 없는 것으로 둔다. */
function knownStyle(v: string | null): MusicStyleId | null {
  return MUSIC_STYLES.some((s) => s.id === v) ? (v as MusicStyleId) : null;
}

/** 서버에서 온 주제 칸을 기기와 같은 규칙으로 다듬는다(songStore.songTag). */
function cleanTopic(v: string | null): string | null {
  const t = v?.trim();
  return !t || t === '—' ? null : t;
}

/**
 * 지금 어르신의 곡 중 기관 저장소에 있는 것.
 *
 * null 은 "곡이 없다"가 아니라 "못 읽었다"다 — 서버를 안 쓰는 기기, 로그인
 * 전, 통신 실패가 여기 들어온다. 화면이 둘을 같게 그리면 있는 곡을 없다고
 * 말하게 되고, 그러면 복지사가 한 번 더 만든다. 그게 요금이다.
 */
/**
 * 이 가사가 **그 곡을 만든 가사**인가.
 *
 * 곡 행에는 만들 때 쓴 가사의 지문이 있다(lyrics_hash). 가사로 같은 지문을
 * 다시 만들어 견주면, 한 글자만 달라도 다른 가사임이 드러난다.
 *
 * 이 규칙은 여기 한 곳에만 둔다. 서버에서 붙일 때, 기기 사본을 확인할 때,
 * 회기의 곡을 알아볼 때가 모두 같은 답을 해야 한다 — 규칙이 두 곳에 있으면
 * 언젠가 어긋나고, 어긋난 쪽이 어르신 앞에서 남의 가사를 띄운다.
 */
export async function matchesHash(
  lyrics: LyricSection[] | null | undefined,
  style: string | null | undefined,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!lyrics?.length || !style || !hash) return false;
  const text = lyrics.map((sec) => `[${sec.label}]\n${sec.lines.join('\n')}`).join('\n\n');
  return (await lyricsHash(text, style)) === hash;
}

/**
 * 기기만 알고 있는 가사를 계정에 올린다.
 *
 * 계정이 원본이지만, 기기가 더 아는 경우가 있다 — 통신이 끊긴 채로 만든
 * 곡이거나, 가사 칸이 생기기 전에 다른 태블릿에서 올린 곡이다. 그때는
 * 빈자리를 채운다. 덮어쓰지는 않는다 — 서버에 값이 있으면 그쪽이 원본이다.
 */
export async function pushSongLyrics(
  hash: string,
  lyrics: LyricSection[],
  participantId?: string,
): Promise<void> {
  const c = await ctx(participantId);
  if (!c) return;
  const { error } = await c.sb
    .from('songs')
    .update({ lyrics })
    .eq('participant_id', c.participantId)
    .eq('lyrics_hash', hash)
    .is('lyrics', null);
  if (error) warn('가사 올리기', error.message);
}

/**
 * 예전 곡에 가사를 뒤늦게 붙인다 — **지문이 맞을 때만.**
 *
 * ── 왜 필요한가
 *
 * 가사 칸(0011)이 생기기 전에 만든 곡은 그 칸이 비어 있어서 보관함의
 * 「함께 부르기」가 안 뜬다. 그 가사는 회기 기록에 남아 있으니 이어 붙이면 된다.
 *
 * ── 회기 번호만 보고 이으면 안 된다
 *
 * 처음에는 곡 행의 회기 번호로 lyrics 표를 찾아 그대로 붙였다. 실제로 열어
 * 보니 **다른 노래의 가사가 떴다.**
 *
 * lyrics 표는 회기마다 한 줄이고 고칠 때마다 덮인다. 곡을 만든 뒤에 복지사가
 * 가사를 손보거나 다시 만들면, 그 회기의 마지막 가사는 곡을 만든 가사와
 * 다르다. 그걸 붙이면 어르신 앞에서 다른 노래의 글자가 흐른다 — 이 서비스에서
 * 가장 나쁜 종류의 오류다.
 *
 * ── 그래서 지문으로 대조한다
 *
 * 곡 행에는 그 곡을 만든 가사의 지문이 있다(lyrics_hash). 회기 가사로 같은
 * 지문을 다시 계산해 보고, 한 글자라도 다르면 붙이지 않는다. 못 붙인 곡은
 * 「함께 부르기」가 안 뜰 뿐이다 — 안 뜨는 것이 틀린 가사가 뜨는 것보다 낫다.
 *
 * 이미 잘못 붙은 가사도 여기서 지운다. 한 번 잘못 붙으면 다음부터는 비어
 * 있지 않으니 아무도 다시 보지 않는다.
 */
export async function backfillSongLyrics(participantId?: string): Promise<number> {
  const c = await ctx(participantId);
  if (!c) return 0;

  const { data: songs } = await c.sb
    .from('songs')
    .select('id, session_id, style, lyrics_hash, lyrics')
    .eq('participant_id', c.participantId)
    .not('session_id', 'is', null);
  if (!songs?.length) return 0;

  // 지문이 없으면 대조할 방법이 없다. 그런 곡은 손대지 않는다.
  const todo = songs.filter((r) => r.lyrics_hash && r.style);
  if (!todo.length) return 0;

  const ids = [...new Set(todo.map((r) => r.session_id).filter(Boolean))] as string[];
  const { data: rows } = await c.sb
    .from('lyrics')
    .select('session_id, sections')
    .in('session_id', ids);
  if (!rows?.length) return 0;

  const bySession = new Map(rows.map((r) => [r.session_id, r.sections]));
  let filled = 0;

  for (const song of todo) {
    const sections = song.session_id ? bySession.get(song.session_id) : null;

    // 곡을 만든 그 가사인지 지문으로 확인한다.
    const same = await matchesHash(
      Array.isArray(sections) ? (sections as LyricSection[]) : null,
      song.style as string,
      song.lyrics_hash,
    );

    if (same && !song.lyrics) {
      const { error } = await c.sb.from('songs').update({ lyrics: sections }).eq('id', song.id);
      if (!error) filled += 1;
    } else if (!same && song.lyrics) {
      /*
       * 앞선 판이 회기 번호만 보고 붙인 가사다. 지문이 다르면 남의 가사이므로
       * 지운다. 화면은 「함께 부르기」를 감추고, 그게 맞는 상태다.
       */
      await c.sb.from('songs').update({ lyrics: null }).eq('id', song.id);
      warn('가사 대조', `지문이 달라 떼어 냈습니다 (${song.id.slice(0, 8)})`);
    }
  }
  return filled;
}

export async function listServerSongs(
  /** 누구의 곡을 볼 것인가. 없으면 지금 회기의 어르신. */
  participantId?: string,
): Promise<ServerSong[] | null> {
  const c = await ctx(participantId);
  if (!c) return null;

  /*
   * 이 어르신의 곡 + 이 어르신이 함께하신 회기의 곡.
   *
   * 그룹 회기는 노래를 한 곡 만들고, 그 곡은 기준 어르신 앞으로 저장된다
   * (저장 칸 이름이 그 값으로 만들어지기 때문이다). 그러면 함께 부르신 나머지
   * 분들 보관함에는 그 노래가 안 보인다 — 같이 만든 노래인데.
   *
   * 그래서 참여자 표를 거쳐 '내가 함께한 회기'의 곡도 가져온다. 1:1 회기는
   * 그 표에 한 줄뿐이라 결과가 지금과 같다.
   */
  const { data: joined } = await c.sb
    .from('session_participants')
    .select('session_id')
    .eq('participant_id', c.participantId);
  const sessions = (joined ?? []).map((r) => r.session_id);

  const mine = `participant_id.eq.${c.participantId}`;
  const shared = sessions.length ? `,session_id.in.(${sessions.join(',')})` : '';

  const { data, error } = await c.sb
    .from('songs')
    .select('id, title, style, art_key, audio_path, lyrics_hash, lyrics, created_at')
    .or(`${mine}${shared}`)
    .not('audio_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return null;

  return data.flatMap((r) => {
    if (!r.audio_path) return [];
    const at = Date.parse(r.created_at);
    return [
      {
        id: r.id,
        path: r.audio_path,
        topic: cleanTopic(r.title),
        cover: r.art_key,
        style: knownStyle(r.style),
        // 못 읽은 시각을 지어내지 않는다. 목록이 날짜를 말하면 잰 값이어야 한다.
        madeAt: Number.isNaN(at) ? null : at,
        hash: r.lyrics_hash,
        lyrics: Array.isArray(r.lyrics) ? (r.lyrics as LyricSection[]) : null,
      },
    ];
  });
}

/** 목록에서 고른 서버 곡을 내려받는다. 실패하면 null — 화면이 그렇게 말한다. */
export async function downloadServerSong(path: string): Promise<Blob | null> {
  const c = await ctx();
  if (!c) return null;
  const file = await c.sb.storage.from('songs').download(path);
  if (file.error || !file.data) return null;
  return file.data;
}

/**
 * 올리기가 실패하면 콘솔에 남긴다.
 *
 * 이 함수가 왜 있는지: uploadSong 은 실패해도 회기를 막지 않는다. 어르신
 * 앞에서 통신 때문에 흐름이 멈추는 편이 더 나쁘기 때문이고, 그 판단은
 * 지금도 맞다. 그런데 결과를 아무 데도 안 남긴 탓에, 표 쓰기가 **한 번도**
 * 성공하지 못한 채로 오래 지나갔다 — 인덱스 문제(42P10)로 upsert 가 계속
 * 거절당하고 있었는데 화면에도, 로그에도 흔적이 없었다. 파일만 storage 에
 * 쌓이고 표는 빈 채였다.
 *
 * 회기는 그대로 계속하되, 흔적은 남긴다.
 */
function warn(what: string, message: string): void {
  console.warn(`[똑똑] 곡을 기관 저장소에 두지 못했어요 — ${what}: ${message}`);
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
  // lengthMs 는 잰 값이 없으면 null 이다. 제공자가 길이를 안 알려 주는
  // 경우가 실제로 있고(APIFRAME), 그때 0 을 넣으면 아무도 재지 않은 0 초가
  // 기관 저장소에 실측처럼 남는다. 컬럼도 null 을 받는다(lib/db.types.ts).
  meta: {
    title: string;
    style: string;
    lengthMs: number | null;
    sessionId: string | null;
    /**
     * 복지사가 고른 앨범 그림(Scene.id). 안 골랐으면 null.
     *
     * 같이 올려야 다른 태블릿의 보관함에도 그 그림이 나온다. 없으면 받는
     * 쪽이 주제에서 그림을 다시 계산하는데, 그건 복지사가 바꾼 적 없는
     * 그림을 보여 주는 것이다 — 기기에 저장할 때 cover 를 함께 넣은 이유와
     * 같다(songStore 의 SongTag.cover).
     */
    cover: string | null;
    /** 이 곡의 가사. 보관함에서 다시 부르려면 곡을 따라다녀야 한다. */
    lyrics?: LyricSection[] | null;
  },
): Promise<boolean> {
  const c = await ctx();
  if (!c) return false;

  const path = `${c.tenantId}/${c.participantId}/${hash}.mp3`;
  const up = await c.sb.storage
    .from('songs')
    .upload(path, blob, { contentType: 'audio/mpeg', upsert: true });
  if (up.error) {
    warn('파일 올리기', up.error.message);
    return false;
  }

  // 파일과 표를 함께 맞춘다. 표에만 있고 파일이 없으면 다음에 내려받다 실패한다.
  const row = {
    tenant_id: c.tenantId,
    participant_id: c.participantId,
    session_id: meta.sessionId,
    title: meta.title,
    style: meta.style,
    status: 'complete' as const,
    audio_path: path,
    art_key: meta.cover,
    lyrics_hash: hash,
    // 가사를 곡에 붙여 둔다. 보관함에서 다시 「함께 부르기」로 열려면
    // 가사가 곡을 따라다녀야 한다(0011_song_lyrics).
    lyrics: meta.lyrics ?? null,
    length_ms: meta.lengthMs,
    // 어느 업체가 만든 곡인지 남긴다. 업체를 갈아 끼우면 옛 곡과 새 곡이
    // 섞이는데, 어디서 온 것인지 모르면 나중에 골라낼 수가 없다.
    provider: process.env.NEXT_PUBLIC_MUSIC_PROVIDER || 'suno',
  };

  const { error } = await c.sb
    .from('songs')
    .upsert(row, { onConflict: 'participant_id,lyrics_hash,style' });
  if (error) {
    warn('표에 적기', error.message);
    return false;
  }
  return true;
}

/**
 * 이번 달 남은 곡 수.
 *
 * 곡을 만들기 **전에** 본다. 만든 뒤에 막으면 크레딧은 이미 나간 뒤다.
 * 서버를 안 쓰면 null — 그때는 한도가 없다(기기에서만 도는 시연 모드).
 */
export async function songQuotaLeft(): Promise<number | null> {
  const c = await ctx();
  if (!c) return null;
  const { data, error } = await c.sb.rpc('song_quota_left');
  if (error || typeof data !== 'number') return null;
  return data;
}

/** 서버에 올려 둔 곡을 지운다 — 삭제 요청에 응할 수 있어야 한다. */
export async function deleteServerSongs(): Promise<void> {
  const c = await ctx();
  if (!c) return;
  const { data } = await c.sb
    .from('songs')
    .select('audio_path')
    .eq('participant_id', c.participantId);
  const paths = (data ?? []).map((r) => r.audio_path).filter((p): p is string => !!p);
  if (paths.length) await c.sb.storage.from('songs').remove(paths);
  await c.sb.from('songs').delete().eq('participant_id', c.participantId);
}
