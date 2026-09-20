export type SqlSegmentKind = 'code' | 'string' | 'identifier' | 'dollar' | 'comment';

export interface SqlSegment {
  kind: SqlSegmentKind;
  text: string;
}

const DOLLAR_TAG = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/;

export function scanSql(sql: string): SqlSegment[] {
  const segments: SqlSegment[] = [];
  let code = '';
  let i = 0;

  const flushCode = () => {
    if (code) {
      segments.push({ kind: 'code', text: code });
      code = '';
    }
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      flushCode();
      let end = sql.indexOf('\n', i);
      if (end === -1) end = sql.length;
      segments.push({ kind: 'comment', text: sql.slice(i, end) });
      i = end;
      continue;
    }

    if (ch === '/' && next === '*') {
      flushCode();
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') {
          depth++;
          j += 2;
        } else if (sql[j] === '*' && sql[j + 1] === '/') {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      segments.push({ kind: 'comment', text: sql.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === "'" || ch === '"') {
      flushCode();
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      j = Math.min(j + 1, sql.length);
      segments.push({ kind: ch === "'" ? 'string' : 'identifier', text: sql.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '$') {
      const tagMatch = DOLLAR_TAG.exec(sql.slice(i));
      const prev = i > 0 ? sql[i - 1] : '';
      if (tagMatch && !/[A-Za-z0-9_]/.test(prev)) {
        flushCode();
        const tag = tagMatch[0];
        const close = sql.indexOf(tag, i + tag.length);
        const end = close === -1 ? sql.length : close + tag.length;
        segments.push({ kind: 'dollar', text: sql.slice(i, end) });
        i = end;
        continue;
      }
    }

    code += ch;
    i++;
  }
  flushCode();
  return segments;
}

export function dollarBody(segmentText: string): string {
  const tag = DOLLAR_TAG.exec(segmentText)?.[0];
  if (!tag) return segmentText;
  const inner = segmentText.slice(tag.length);
  return inner.endsWith(tag) ? inner.slice(0, inner.length - tag.length) : inner;
}

export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let hasContent = false;

  const push = () => {
    if (hasContent) statements.push(current.trim());
    current = '';
    hasContent = false;
  };

  for (const segment of scanSql(sql)) {
    if (segment.kind === 'comment') {
      current += ' ';
      continue;
    }
    if (segment.kind !== 'code') {
      current += segment.text;
      hasContent = true;
      continue;
    }
    let rest = segment.text;
    for (let semi = rest.indexOf(';'); semi !== -1; semi = rest.indexOf(';')) {
      const head = rest.slice(0, semi);
      current += head;
      if (head.trim()) hasContent = true;
      push();
      rest = rest.slice(semi + 1);
    }
    current += rest;
    if (rest.trim()) hasContent = true;
  }
  push();
  return statements;
}

export function codeOnly(sql: string): string {
  let out = '';
  for (const segment of scanSql(sql)) {
    if (segment.kind === 'code') out += segment.text;
    else if (segment.kind === 'dollar') out += ` ${codeOnly(dollarBody(segment.text))} `;
    else out += ' ';
  }
  return out;
}
