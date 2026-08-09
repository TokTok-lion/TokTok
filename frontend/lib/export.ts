'use client';

/**
 * 활동일지 내보내기.
 *
 * 기관은 이미 쓰던 서식이 있다. 이 앱이 그 서식을 대체하려 들면 현장에서
 * 두 번 쓰는 일이 된다(원칙 8). 그래서 앱 안에 가두지 않고 밖으로 꺼내는
 * 두 갈래만 만든다 — 인쇄해서 종이로, 표로 옮겨서 기존 문서로.
 *
 * PDF 는 브라우저 인쇄를 쓴다. PDF 라이브러리는 한글 폰트를 따로 실어야
 * 하고 그 과정에서 글자가 깨지는 일이 잦은데, 브라우저 인쇄는 화면에 이미
 * 뜬 폰트를 그대로 쓴다. "PDF로 저장"이 인쇄 대화상자 안에 있다.
 */

export type LogRow = { label: string; value: string };

/** 화면을 인쇄 대화상자로 넘긴다 (거기서 PDF로 저장). */
export function printLog() {
  if (typeof window === 'undefined') return;
  window.print();
}

/**
 * CSV 로 내려받는다. 엑셀·한셀이 바로 연다.
 *
 * 맨 앞의 BOM 이 핵심이다. 없으면 엑셀이 한글을 깨진 글자로 읽는다 —
 * 파일은 멀쩡한데 열어 보면 못 쓰는 상태가 되어 원인을 찾기 어렵다.
 */
export function downloadCsv(filename: string, rows: LogRow[]) {
  if (typeof window === 'undefined') return;

  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const body = [['항목', '내용'], ...rows.map((r) => [r.label, r.value])]
    .map((cols) => cols.map(esc).join(','))
    .join('\r\n');

  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 곧바로 해제하면 사파리에서 저장이 취소되는 일이 있어 한 박자 둔다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 파일 이름에 쓸 오늘 날짜 (YYYY-MM-DD). */
export function todayStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
