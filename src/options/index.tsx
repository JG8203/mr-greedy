import React from 'react'
import ReactDOM from 'react-dom/client'

const Options = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Options Page</h1>
      <p>Configure extension options here.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
)
