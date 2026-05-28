import client from './client'

export async function getSquadCapacity(projectKey, sprint) {
  const params = {}
  if (sprint) params.sprint = sprint
  const { data } = await client.get(`/capacity/squad/${projectKey}`, { params })
  return data.data || data
}

export async function getSquadSprints(projectKey) {
  const { data } = await client.get(`/capacity/squad/${projectKey}/sprints`)
  return data
}

export async function getAvailableSquads() {
  const { data } = await client.get(`/capacity/squads`)
  return data
}
