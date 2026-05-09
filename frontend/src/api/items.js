import client from './client'

export const getItems = () => client.get('/items/').then(r => r.data)
export const getItem = (id) => client.get(`/items/${id}`).then(r => r.data)
export const createItem = (body) => client.post('/items/', body).then(r => r.data)
export const updateItem = (id, body) => client.patch(`/items/${id}`, body).then(r => r.data)
export const deleteItem = (id) => client.delete(`/items/${id}`)
