import React from 'react'

export function useStopwatch() {
  const [running, setRunning] = React.useState(false)
  const [startAt, setStartAt] = React.useState<number | null>(null)
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    let id: number | null = null
    if (running && startAt != null) {
      id = window.setInterval(() => {
        setElapsed(Date.now() - startAt)
      }, 1000)
    }
    return () => { if (id) window.clearInterval(id) }
  }, [running, startAt])

  const start = () => { setStartAt(Date.now()); setRunning(true) }
  const stop = () => { setRunning(false); if (startAt != null) setElapsed(Date.now() - startAt) }
  const reset = () => { setRunning(false); setStartAt(null); setElapsed(0) }

  return { running, elapsed, start, stop, reset }
}
