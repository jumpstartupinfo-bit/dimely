/**
 * Pushes changed files to GitHub via the REST API.
 * Run with: bun run scripts/github-push.ts
 */
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const OWNER = 'jumpstartupinfo-bit'
const REPO = 'dimely'
const BRANCH = 'main'

const TOKEN = process.env.GITHUB_TOKEN ?? ''
if (!TOKEN || TOKEN.length < 10) { console.error('GITHUB_TOKEN env var is empty or missing'); process.exit(1) }

const FILES_TO_PUSH = [
  'server/routes/profiles.ts',
  'server/routes/availability.ts',
  'server/seed-profiles.ts',
  'server/routes/auth.ts',
  'server/config.ts',
  'src/pages/DiscoverPage.tsx',
  'src/pages/ProfilePage.tsx',
  'src/pages/CalendarPage.tsx',
  'src/pages/Nav.tsx',
  'src/lib/api.ts',
]

async function getFileSha(filePath: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`
  const res = await fetch(url, { headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' } })
  if (!res.ok) return null
  const data = await res.json() as { sha: string }
  return data.sha
}

async function pushFile(filePath: string): Promise<void> {
  const absPath = `/home/user/app/${filePath}`
  if (!existsSync(absPath)) { console.log(`SKIP (not found): ${filePath}`); return }
  const content = readFileSync(absPath, 'utf-8')
  const encoded = Buffer.from(content).toString('base64')
  const sha = await getFileSha(filePath)
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`
  const body = {
    message: `Fix: ${path.basename(filePath)}`,
    content: encoded,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.ok) {
    console.log(`PUSHED: ${filePath}`)
  } else {
    const err = await res.text()
    console.error(`FAILED: ${filePath} — ${res.status} ${err.slice(0, 200)}`)
  }
}

console.log('Pushing files to GitHub...')
for (const f of FILES_TO_PUSH) {
  await pushFile(f)
}
console.log('Done.')
