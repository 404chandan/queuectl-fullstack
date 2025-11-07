export async function api(path, opts={}){
  const res = await fetch(`/api${path}`, { headers:{'Content-Type':'application/json'}, ...opts })
  if(!res.ok) throw new Error(await res.text())
  return res.json()
}

export function sse(onEvent){
  const es = new EventSource('/events')
  es.onmessage = (e)=>onEvent('message', JSON.parse(e.data))
  es.addEventListener('job-picked', (e)=>onEvent('job-picked', JSON.parse(e.data)))
  es.addEventListener('job-completed', (e)=>onEvent('job-completed', JSON.parse(e.data)))
  es.addEventListener('job-retry', (e)=>onEvent('job-retry', JSON.parse(e.data)))
  es.addEventListener('job-dead', (e)=>onEvent('job-dead', JSON.parse(e.data)))
  return es
}