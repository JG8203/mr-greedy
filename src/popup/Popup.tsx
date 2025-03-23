import { useState, useEffect } from 'react'
import './Popup.css'

// Define types for our storage data
interface StorageData {
  trackingPreventionEnabled?: boolean;
  apiInjectionEnabled?: boolean;
  apiInjectionKey?: string;
  canvasUrl?: string;
  selectedModel?: string;
}

// Define available models
const AVAILABLE_MODELS = [
  { id: 'openai/o1-preview', name: 'OpenAI o1-preview' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
  { id: 'openai/o3-mini-high', name: 'OpenAI o3-mini-high' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
  { id: 'qwen/qwen-32b', name: 'Qwen 32B' },
  { id: 'qwen/qwen-max', name: 'Qwen Max' },
  { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash' },
  { id: 'anthropic/claude-3.7-sonnet', name: 'Anthropic Claude 3.7 Sonnet' },
  { id: 'anthropic/claude-3.7-sonnet:thinking', name: 'Anthropic Claude 3.7 Sonnet (Thinking)' }
];

// Define types for content script responses
interface ContentScriptResponse {
  success?: boolean;
  error?: string;
}

export const Popup = () => {
  const [trackingDisabled, setTrackingDisabled] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [canvasUrl, setCanvasUrl] = useState('')
  const [injectEnabled, setInjectEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.0-flash-001')

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true)
        console.log('Loading settings from storage...')
        
        // Get settings from local storage
        const localSettings = await new Promise<StorageData>(resolve => {
          chrome.storage.local.get(
            ['trackingPreventionEnabled', 'apiInjectionEnabled', 'apiInjectionKey', 'canvasUrl', 'selectedModel'], 
            (result) => resolve(result as StorageData)
          )
        })
        
        console.log('Loaded settings:', localSettings)
        
        // Update state with loaded settings
        setTrackingDisabled(localSettings.trackingPreventionEnabled || false)
        setInjectEnabled(localSettings.apiInjectionEnabled || false)
        setApiKey(localSettings.apiInjectionKey || '')
        setCanvasUrl(localSettings.canvasUrl || '')
        setSelectedModel(localSettings.selectedModel || 'google/gemini-2.0-flash-001')
        
        setIsLoading(false)
      } catch (error) {
        console.error('Error loading settings:', error)
        setStatusMessage('Error loading settings')
        setIsLoading(false)
      }
    }
    
    loadSettings()
  }, [])

  // Save settings to storage
  const saveSettings = async () => {
    try {
      setStatusMessage('Saving settings...')
      
      // Save settings to local storage
      await new Promise<void>(resolve => {
        chrome.storage.local.set({
          trackingPreventionEnabled: trackingDisabled,
          apiInjectionEnabled: injectEnabled,
          apiInjectionKey: apiKey,
          canvasUrl: canvasUrl,
          selectedModel: selectedModel
        }, () => resolve())
      })
      
      console.log('Settings saved to storage')
      
      // Apply settings to current tab
      await applySettingsToCurrentTab()
      
      // Show success message
      setStatusMessage('Settings saved successfully! ✅')
      setTimeout(() => {
        setStatusMessage('')
      }, 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setStatusMessage('Error saving settings: ' + error.message)
    }
  }

  // Apply settings to current tab
  const applySettingsToCurrentTab = async () => {
    try {
      const tabs = await new Promise<chrome.tabs.Tab[]>(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs))
      })
      
      if (!tabs || !tabs[0] || !tabs[0].id) {
        console.log('No active tab found')
        return
      }
      
      const tab = tabs[0]
      console.log('Applying settings to tab:', tab.url)
      
      // Send message to content script
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.tabs.sendMessage(
            tab.id!, 
            { 
              action: 'applyTrackingPrevention',
              trackingDisabled: trackingDisabled,
              injectEnabled: injectEnabled,
              apiKeyExists: !!apiKey,
              canvasUrl: canvasUrl,
              selectedModel: selectedModel
            },
            response => {
              if (chrome.runtime.lastError) {
                console.log('Content script not ready:', chrome.runtime.lastError)
                // This is not a fatal error, just means content script isn't loaded yet
                resolve()
              } else {
                console.log('Response from content script:', response)
                resolve()
              }
            }
          )
        })
      } catch (error) {
        console.log('Error sending message to content script:', error)
        // Not a fatal error
      }
    } catch (error) {
      console.error('Error applying settings to current tab:', error)
      throw error
    }
  }

  // Handle toggle tracking
  const handleToggleTracking = () => {
    setTrackingDisabled(!trackingDisabled)
  }

  // Handle API key change
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
  }
  
  // Handle model selection change
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value)
  }
  
  // Handle Canvas URL change
  const handleCanvasUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCanvasUrl(e.target.value)
  }
  
  // Handle toggle injection
  const handleToggleInjection = () => {
    setInjectEnabled(!injectEnabled)
  }
  
  // Handle get answers button click
  const handleGetAnswers = async () => {
    try {
      setStatusMessage('Requesting answers...')
      
      // Save current API key first
      await new Promise<void>(resolve => {
        chrome.storage.local.set({
          apiInjectionEnabled: true,
          apiInjectionKey: apiKey
        }, () => resolve())
      })
      
      // Get current tab
      const tabs = await new Promise<chrome.tabs.Tab[]>(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs))
      })
      
      if (!tabs || !tabs[0] || !tabs[0].id) {
        setStatusMessage('No active tab found')
        return
      }
      
      // Send message to content script
      const response = await new Promise<ContentScriptResponse>((resolve, reject) => {
        chrome.tabs.sendMessage(
          tabs[0].id!, 
          { 
            action: 'getOpenAIAnswers',
            selectedModel: selectedModel
          },
          response => {
            if (chrome.runtime.lastError) {
              reject(new Error('Content script not ready. Please refresh the page and try again.'))
            } else {
              resolve(response as ContentScriptResponse)
            }
          }
        )
      })
      
      if (response && response.success) {
        setStatusMessage('Answers generated successfully! ✅')
        setTimeout(() => {
          setStatusMessage('')
        }, 2000)
      } else {
        setStatusMessage('Error: ' + (response?.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error getting answers:', error)
      setStatusMessage('Error: ' + error.message)
    }
  }

  if (isLoading) {
    return (
      <main className="kawaii-container">
        <div className="sparkles">✨✨✨</div>
        <h1 className="kawaii-title">
          <span className="emoji">🌸</span> I am inwosent <span className="emoji">🌸</span>
        </h1>
        <div className="loading-spinner">Loading settings...</div>
      </main>
    )
  }

  return (
    <main className="kawaii-container">
      <div className="sparkles">✨✨✨</div>
      <h1 className="kawaii-title">
        <span className="emoji">🌸</span> I am inwosent <span className="emoji">🌸</span>
      </h1>
      
      <div className="kawaii-form">
        <div className="form-group">
          <label htmlFor="canvasUrl">Canvas URL</label>
          <input
            type="text"
            id="canvasUrl"
            value={canvasUrl}
            onChange={handleCanvasUrlChange}
            placeholder="e.g., canvas.example.edu"
            className="kawaii-input"
          />
        </div>
        
        <div className="form-group">
          <label className="toggle-label">
            <span>Disable Tracking</span>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={trackingDisabled}
                onChange={handleToggleTracking}
              />
              <span className="toggle-slider"></span>
            </div>
          </label>
        </div>
        
        <div className="form-group">
          <label htmlFor="apiKey">OpenRouter API Key</label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="sk-or-..."
            className="kawaii-input"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="modelSelect">AI Model</label>
          <select
            id="modelSelect"
            value={selectedModel}
            onChange={handleModelChange}
            className="kawaii-select"
            disabled={!apiKey}
          >
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label className="toggle-label">
            <span>Inject API Response</span>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                checked={injectEnabled}
                onChange={handleToggleInjection}
              />
              <span className="toggle-slider"></span>
            </div>
          </label>
        </div>
        
        <button 
          className="kawaii-button"
          onClick={saveSettings}
        >
          Save Preferences <span className="emoji">💾</span>
        </button>
        
        <button 
          className="kawaii-button kawaii-button-secondary"
          onClick={handleGetAnswers}
          disabled={!apiKey}
        >
          Get AI Answers <span className="emoji">🤖</span>
        </button>
        
        {statusMessage && (
          <div className="save-confirmation" style={{ opacity: 1 }}>
            {statusMessage}
          </div>
        )}
      </div>
      
      <div className="kawaii-footer">
        <span className="emoji">🌈</span>
        <span className="emoji">🦄</span>
        <span className="emoji">🍡</span>
      </div>
    </main>
  )
}

export default Popup
