import client from './client'

export async function getEpics({ projectKey, status } = {}) {
  const params = {}
  if (projectKey) params.project_key = projectKey
  if (status) params.status = status
  const { data } = await client.get('/epics/', { params })
  return data
}

export async function getEpicsStats() {
  const { data } = await client.get('/epics/stats')
  return data
}

export async function getProjects() {
  const { data } = await client.get('/epics/projects')
  return data
}

export async function getVps() {
  const { data } = await client.get('/epics/vps')
  return data
}

export async function getSprints() {
  const { data } = await client.get('/epics/sprint-leadtime')
  return data
}
