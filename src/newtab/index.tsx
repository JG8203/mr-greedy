import React from 'react'
import ReactDOM from 'react-dom/client'

const NewTab = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>New Tab Page</h1>
      <p>This is your custom new tab page.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <NewTab />
  </React.StrictMode>,
)
