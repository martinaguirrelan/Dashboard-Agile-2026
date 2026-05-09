import client from './client'

export async function getSyncStatus() {
  const { data } = await client.get('/api/sync/status')
  return data
}

export async function triggerSync(token) {
  const { data } = await client.post('/api/sync/run', null, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}
