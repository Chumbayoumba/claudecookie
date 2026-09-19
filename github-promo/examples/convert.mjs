#!/usr/bin/env node
// Convert a cookie paste. Reads stdin or COOKIE. Default target: netscape.

const BASE = (process.env.BASE || 'https://claudecookie.com').replace(/\/$/, '')
const target = process.argv[2] || 'netscape'

async function readPaste() {
  if (process.env.COOKIE) return process.env.COOKIE
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const input = (await readPaste()).trim()
if (!input) {
  console.error('pipe a cookie paste in, or set COOKIE')
  process.exit(2)
}

const res = await fetch(`${BASE}/api/v1/convert`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ input, target }),
})

const data = await res.json()
if (!res.ok) {
  console.error(JSON.stringify(data, null, 2))
  process.exit(1)
}

process.stdout.write(data.output ?? JSON.stringify(data, null, 2))
if (data.output && !String(data.output).endsWith('\n')) process.stdout.write('\n')
