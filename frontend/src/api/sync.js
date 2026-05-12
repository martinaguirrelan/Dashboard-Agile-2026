import client from './client'

export async function getSyncStatus() {
  const { data } = await client.get('/sync/status')
  return data
}

export async function triggerSync(token) {
  const { data } = await client.post('/sync/run', null, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}
