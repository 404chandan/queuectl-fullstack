import React, { useEffect, useMemo, useState } from 'react';
import { api, sse } from './api';

function Pill({state}){
  const colors = {
    pending: '#1d4ed8', processing: '#a855f7', completed:'#16a34a', failed:'#ea580c', dead:'#ef4444'
  }
  return <span className="pill" style={{borderColor:'#1f2a44', background:'#0b1220', color: colors[state]}}>{state}</span>
}

function useStatus(){
  const [status, setStatus] = useState({ counts:{} })
  const refresh = async ()=>{
    const s = await api('/status')
    setStatus(s)
  }
  useEffect(()=>{ refresh() },[])
  return { status, refresh, setStatus }
}

function DashboardCard({title, value}){
  return <div className="card"><div className="muted">{title}</div><div className="title">{value}</div></div>
}

function JobsTable(){
  const [state, setState] = useState('')
  const [rows, setRows] = useState([])
  const load = async ()=>{
    const q = state ? `?state=${encodeURIComponent(state)}` : ''
    const data = await api(`/list${q}`)
    setRows(data)
  }
  useEffect(()=>{ load() },[state])
  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="row">
          <h3>Jobs</h3>
          <select value={state} onChange={e=>setState(e.target.value)}>
            <option value="">all</option>
            <option>pending</option><option>processing</option>
            <option>completed</option><option>failed</option><option>dead</option>
          </select>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>
      <table>
        <thead><tr><th>ID</th><th>State</th><th>Attempts</th><th>Command</th><th>Updated</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id}>
              <td>{r.id}</td>
              <td><Pill state={r.state}/></td>
              <td>{r.attempts}</td>
              <td><code>{r.command}</code></td>
              <td>{new Date(r.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EnqueueForm({onEnqueued}){
  const [id, setId] = useState('job-'+Math.random().toString(36).slice(2,8))
  const [command, setCommand] = useState("echo 'Hello World'")
  const [maxRetries, setMaxRetries] = useState(3)
  const [priority, setPriority] = useState(0)

  const submit = async ()=>{
    await api('/enqueue', { method:'POST', body: JSON.stringify({ id, command, max_retries: Number(maxRetries), priority: Number(priority) }) })
    onEnqueued?.()
    setId('job-'+Math.random().toString(36).slice(2,8))
  }
  return (
    <div className="card">
      <h3>Enqueue Job</h3>
      <div className="row">
        <input placeholder="id" value={id} onChange={e=>setId(e.target.value)} />
        <input placeholder="command" value={command} onChange={e=>setCommand(e.target.value)} style={{flex:1, minWidth:300}} />
        <input type="number" placeholder="max_retries" value={maxRetries} onChange={e=>setMaxRetries(e.target.value)} style={{width:120}} />
        <input type="number" placeholder="priority" value={priority} onChange={e=>setPriority(e.target.value)} style={{width:120}} />
        <button className="btn" onClick={submit}>Enqueue</button>
      </div>
    </div>
  )
}

function DLQ(){
  const [rows, setRows] = useState([])
  const load = async ()=> setRows(await api('/dlq/list'))
  useEffect(()=>{ load() },[])
  const retry = async (id)=>{
    await api('/dlq/retry/'+id, { method:'POST' })
    await load()
  }
  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h3>Dead Letter Queue</h3>
        <button className="btn" onClick={load}>Refresh</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Attempts</th><th>Last Error</th><th></th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.attempts}</td>
              <td style={{maxWidth:400, whiteSpace:'pre-wrap'}}>{r.last_error}</td>
              <td><button className="btn" onClick={()=>retry(r.id)}>Retry</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WorkersPanel(){
  const [workers, setWorkers] = useState([])
  const [count, setCount] = useState(1)
  const load = async ()=> setWorkers(await api('/workers/list'))
  useEffect(()=>{ load() },[])
  const start = async ()=>{ await api('/workers/start', { method:'POST', body: JSON.stringify({ count: Number(count) }) }); await load() }
  const stop = async ()=>{ await api('/workers/stop', { method:'POST' }); await load() }
  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h3>Workers</h3>
        <div className="row">
          <input type="number" value={count} onChange={e=>setCount(e.target.value)} style={{width:80}} />
          <button className="btn" onClick={start}>Start</button>
          <button className="btn" onClick={stop}>Stop</button>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>
      <table>
        <thead><tr><th>Worker ID</th><th>Active</th><th>Started</th><th>Heartbeat</th></tr></thead>
        <tbody>
          {workers.map(w=>(
            <tr key={w.worker_id}>
              <td>{w.worker_id}</td>
              <td>{String(w.active)}</td>
              <td>{new Date(w.started_at).toLocaleString()}</td>
              <td>{new Date(w.last_heartbeat).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function App(){
  const { status, refresh, setStatus } = useStatus();

  useEffect(()=>{
    const es = sse((event, data)=>{
      if(['job-picked','job-completed','job-retry','job-dead'].includes(event)){
        refresh();
      }
    });
    return ()=>es.close();
  },[]);

  const total = useMemo(()=>Object.values(status.counts||{}).reduce((a,b)=>a+b,0),[status]);

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
        <div className="title">queuectl Dashboard</div>
        <div className="row muted">Live status via SSE</div>
      </div>

      <div className="grid" style={{marginBottom:16}}>
        <div className="card" style={{gridColumn:'span 3'}}><div className="muted">Total</div><div className="title">{total}</div></div>
        <div className="card" style={{gridColumn:'span 3'}}><div className="muted">Pending</div><div className="title">{status.counts?.pending||0}</div></div>
        <div className="card" style={{gridColumn:'span 3'}}><div className="muted">Processing</div><div className="title">{status.counts?.processing||0}</div></div>
        <div className="card" style={{gridColumn:'span 3'}}><div className="muted">Dead</div><div className="title">{status.counts?.dead||0}</div></div>
      </div>

      <EnqueueForm onEnqueued={refresh} />
      <WorkersPanel />
      <JobsTable />
      <DLQ />
    </div>
  )
}