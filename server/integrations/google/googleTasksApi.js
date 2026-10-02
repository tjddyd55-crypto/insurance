import { normalizeGoogleTask, normalizeGoogleTaskList } from '../../schedule/scheduleTasks.js'
import { googleGetJson } from './googleApiHttp.js'
import { googleCacheKey, readGoogleCache, writeGoogleCache } from './googleUserCache.js'

const API_BASE = 'https://tasks.googleapis.com/tasks/v1'
const MAX_LIST_PAGES = 10
const MAX_TASK_PAGES = 20
const PAGE_SIZE = 100

/**
 * 사용자의 모든 할 일 목록. 기본 목록(@default)을 가정하지 않고 nextPageToken 을 따라간다.
 * @param {{ userId: string, accessToken: string, fetchImpl?: typeof fetch }} input
 */
export async function listGoogleTaskLists(input) {
  const key = googleCacheKey('google-tasklists', input.userId)
  const cached = readGoogleCache(key)
  if (cached) return cached
  const fetchImpl = input.fetchImpl ?? fetch
  const lists = []
  let pageToken = ''
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const url = new URL(`${API_BASE}/users/@me/lists`)
    url.searchParams.set('maxResults', String(PAGE_SIZE))
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const body = await googleGetJson(fetchImpl, url, input.accessToken)
    for (const item of Array.isArray(body.items) ? body.items : []) {
      const list = normalizeGoogleTaskList(item)
      if (list) lists.push(list)
    }
    pageToken = String(body.nextPageToken ?? '')
    if (!pageToken) break
  }
  writeGoogleCache(key, lists)
  return lists
}

/**
 * 한 목록의 할 일 전부(완료·숨김 포함). 예정일 없는 할 일도 있어야 하므로 dueMin/dueMax 로 자르지 않고,
 * 기간 선택은 호출자가 한다. 캐시 키: 사용자 + 목록 + 기간(전체) + 상태(완료·숨김 포함).
 * @param {{ userId: string, accessToken: string, taskList: { id: string, name: string }, fetchImpl?: typeof fetch }} input
 */
export async function listGoogleTasks(input) {
  const key = googleCacheKey('google-tasks', input.userId, [input.taskList.id, 'due-any', 'status-all'])
  const cached = readGoogleCache(key)
  if (cached) return cached
  const fetchImpl = input.fetchImpl ?? fetch
  const tasks = []
  let pageToken = ''
  for (let page = 0; page < MAX_TASK_PAGES; page += 1) {
    const url = new URL(`${API_BASE}/lists/${encodeURIComponent(input.taskList.id)}/tasks`)
    url.searchParams.set('showCompleted', 'true')
    url.searchParams.set('showHidden', 'true')
    url.searchParams.set('maxResults', String(PAGE_SIZE))
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const body = await googleGetJson(fetchImpl, url, input.accessToken)
    for (const item of Array.isArray(body.items) ? body.items : []) {
      const task = normalizeGoogleTask(item, input.taskList)
      if (task) tasks.push(task)
    }
    pageToken = String(body.nextPageToken ?? '')
    if (!pageToken) break
  }
  writeGoogleCache(key, tasks)
  return tasks
}
