#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const strip = require('strip-comments');

const filePath = process.argv[2] || '';
const ext = path.extname(filePath);
const base = path.basename(filePath);
const input = fs.readFileSync(0, 'utf8');

function stripHashComments(text) {
  return text
    .split('\n')
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (!inDouble && ch === "'") inSingle = !inSingle;
        else if (!inSingle && ch === '"') inDouble = !inDouble;
        else if (!inSingle && !inDouble && ch === '#') {
          return line.slice(0, i).replace(/\s+$/, '');
        }
      }
      return line;
    })
    .join('\n');
}

function stripSqlComments(text) {
  return text
    .split('\n')
    .map((line) => {
      let inSingle = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'") {
          if (inSingle && line[i + 1] === "'") {
            i++;
            continue;
          }
          inSingle = !inSingle;
        } else if (!inSingle && ch === '-' && line[i + 1] === '-') {
          return line.slice(0, i).replace(/\s+$/, '');
        }
      }
      return line;
    })
    .join('\n');
}

const jsLikeExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const hashCommentFiles = new Set(['Dockerfile', '.dockerignore', '.gitignore', '.gitattributes']);
const hashCommentExts = new Set(['.yml', '.yaml']);

let output;
if (jsLikeExts.has(ext)) {
  output = strip(input);
} else if (ext === '.sql') {
  output = stripSqlComments(input);
} else if (hashCommentExts.has(ext) || hashCommentFiles.has(base)) {
  output = stripHashComments(input);
} else {
  output = input;
}

process.stdout.write(output);
