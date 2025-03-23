import React from 'react'
import ReactDOM from 'react-dom/client'

const DevTools = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>DevTools Panel</h1>
      <p>This is your extension's DevTools panel.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <DevTools />
  </React.StrictMode>,
)
