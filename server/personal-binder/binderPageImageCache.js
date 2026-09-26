import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const SWEEP_INTERVAL_MS = 60 * 60 * 1000

function cachePaths(root, key) {
  const dir = path.resolve(root, key)
  const rootResolved = path.resolve(root)
  if (dir !== rootResolved && !dir.startsWith(`${rootResolved}${path.sep}`)) {
    throw Object.assign(new Error('페이지 이미지 캐시 경로가 올바르지 않습니다.'), { httpStatus: 500 })
  }
  return {
    dir,
    image: path.join(dir, 'image.jpg'),
    meta: path.join(dir, 'meta.json'),
  }
}

export function binderPageImageCacheKey({ fileId, fingerprint, page, width }) {
  const file = Number(fileId)
  const pageNo = Number(page)
  const targetWidth = Number(width)
  const stamp = String(fingerprint ?? '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 16)
  if (!Number.isInteger(file) || file < 1 || !Number.isInteger(pageNo) || pageNo < 1) {
    throw new Error('invalid binder page cache key')
  }
  if (!Number.isInteger(targetWidth) || targetWidth < 1 || stamp.length < 8) {
    throw new Error('invalid binder page cache key')
  }
  return path.join(String(file), stamp, String(pageNo), String(targetWidth))
}

async function readEntry(paths) {
  try {
    const [buffer, metaRaw] = await Promise.all([
      readFile(paths.image),
      readFile(paths.meta, 'utf8'),
    ])
    const meta = JSON.parse(metaRaw)
    return {
      buffer,
      contentType: 'image/jpeg',
      pixelWidth: Number(meta.pixelWidth),
      pixelHeight: Number(meta.pixelHeight),
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function writeEntry(paths, image) {
  await mkdir(paths.dir, { recursive: true })
  const tempImage = path.join(paths.dir, `.image-${process.pid}-${Date.now()}.jpg`)
  await writeFile(tempImage, image.buffer)
  await rename(tempImage, paths.image)
  await writeFile(paths.meta, JSON.stringify({
    pixelWidth: image.pixelWidth,
    pixelHeight: image.pixelHeight,
  }))
}

async function sweepExpired(root, now) {
  let entries
  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const fullPath = path.join(entry.parentPath ?? entry.path, entry.name)
    const info = await stat(fullPath)
    if (now - info.mtimeMs > CACHE_TTL_MS) await rm(fullPath, { force: true })
  }
}

async function loadOrProduce(paths, produce) {
  const cached = await readEntry(paths)
  if (cached) return { ...cached, cache: 'hit' }
  const image = await produce()
  await writeEntry(paths, image)
  return { ...image, cache: 'miss' }
}

export function createBinderPageImageCache(rootDir) {
  const root = rootDir || process.env.PERSONAL_BINDER_PAGE_CACHE_DIR || path.join(os.tmpdir(), 'personal-binder-page-cache')
  const inflight = new Map()
  let lastSweep = 0

  async function maybeSweep() {
    const now = Date.now()
    if (now - lastSweep < SWEEP_INTERVAL_MS) return
    lastSweep = now
    await sweepExpired(root, now).catch((error) => {
      console.warn('[binder-page-image] cache sweep failed', error?.message)
    })
  }

  async function getOrCreate(key, produce) {
    const paths = cachePaths(root, key)
    const pending = inflight.get(key)
    if (pending) return pending
    const task = loadOrProduce(paths, produce).finally(() => inflight.delete(key))
    inflight.set(key, task)
    void maybeSweep()
    return task
  }

  return { getOrCreate, root }
}
