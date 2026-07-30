#!/usr/bin/env node
const fs = require('fs');
const strip = require('strip-comments');

const input = fs.readFileSync(0, 'utf8');
process.stdout.write(strip(input));
