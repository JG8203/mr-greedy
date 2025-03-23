import React from 'react'
import ReactDOM from 'react-dom/client'

const SidePanel = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Side Panel</h1>
      <p>This is your extension's side panel.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
)
