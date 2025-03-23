console.log('Inwosent content script loaded');

// Function to apply tracking prevention
async function applyTrackingPrevention(trackingDisabled, injectEnabled, apiKeyExists, selectedModel) {
  console.log('Applying tracking prevention with params:', { 
    trackingDisabled, 
    injectEnabled, 
    apiKeyExists,
    selectedModel
  });

  if (trackingDisabled) {
    // Prevent window events tracking
    window.addEventListener('mouseleave', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('beforeunload', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('focus', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
    
    // Prevent page visibility API tracking
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }
  
  updateStatusDisplay(trackingDisabled, injectEnabled, apiKeyExists, selectedModel);
  
  // If API injection is enabled and we have an API key, get answers
  if (injectEnabled && apiKeyExists) {
    await injectOpenAIAnswers(selectedModel);
  }
}

// Function to inject OpenAI answers
async function injectOpenAIAnswers(modelOverride) {
  console.log('Injecting OpenAI answers...');
  
  try {
    // Get API key and model from storage
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['apiInjectionKey', 'selectedModel'], resolve);
    });
    
    const apiKey = result.apiInjectionKey;
    const selectedModel = modelOverride || result.selectedModel;
    if (!apiKey) {
      console.error('No API key found for OpenAI');
      return;
    }
    
    // Create OpenAI helper
    const openaiHelper = new window.OpenAIHelper(apiKey, selectedModel);
    
    // Get answers for all questions
    const answers = await openaiHelper.getAnswersForQuestions();
    if (!answers || answers.length === 0) {
      console.log('No answers received from OpenAI');
      return;
    }
    
    console.log('Received answers from OpenAI:', answers);
    
    // Create answers container
    const questionsContainer = document.getElementById('questions');
    if (!questionsContainer) {
      console.error('Questions container not found');
      return;
    }
    
    // Remove existing answers container if it exists
    const existingAnswers = document.getElementById('inwosent-answers');
    if (existingAnswers) {
      existingAnswers.remove();
    }
    
    // Create a container for the answers
    const answersContainer = document.createElement('div');
    answersContainer.id = 'inwosent-answers';
    answersContainer.style.backgroundColor = '#fff8fa';
    answersContainer.style.border = '2px solid #ff85a2';
    answersContainer.style.borderRadius = '8px';
    answersContainer.style.padding = '20px';
    answersContainer.style.margin = '20px 0';
    answersContainer.style.fontFamily = 'Quicksand, sans-serif';
    
    // Add header
    const header = document.createElement('h2');
    header.textContent = '✨ Inwosent AI Answers ✨ (Select text to reveal)';
    header.style.color = '#ff85a2';
    header.style.marginTop = '0';
    answersContainer.appendChild(header);
    
    // Add CSS for selection styling
    const style = document.createElement('style');
    style.textContent = `
      .inwosent-answer::selection {
        color: #333;
        background-color: #ffc2d1;
      }
    `;
    document.head.appendChild(style);
    
    // Add each answer
    for (const answerData of answers) {
      const answerContainer = document.createElement('div');
      answerContainer.className = 'inwosent-answer';
      answerContainer.style.marginBottom = '20px';
      answerContainer.style.padding = '15px';
      answerContainer.style.backgroundColor = 'white';
      answerContainer.style.borderRadius = '8px';
      answerContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      answerContainer.style.color = 'transparent';
      answerContainer.style.userSelect = 'all';
      
      // Get question text
      const questionEl = document.getElementById(answerData.questionId);
      const questionTextEl = questionEl ? questionEl.querySelector('.question_text') : null;
      const questionText = questionTextEl ? questionTextEl.textContent.trim() : 'Question';
      
      // Add question text
      const questionHeader = document.createElement('h3');
      questionHeader.textContent = questionText;
      questionHeader.style.color = '#333';
      questionHeader.style.marginTop = '0';
      answerContainer.appendChild(questionHeader);
      
      // Add answer content
      const answerContent = document.createElement('div');
      answerContent.innerHTML = openaiHelper.markdownToHtml(answerData.answer);
      answerContent.style.lineHeight = '1.5';
      answerContainer.appendChild(answerContent);
      
      answersContainer.appendChild(answerContainer);
    }
    
    // Append answers container after questions
    questionsContainer.parentNode.insertBefore(answersContainer, questionsContainer.nextSibling);
    
    console.log('OpenAI answers injected successfully');
  } catch (error) {
    console.error('Error injecting OpenAI answers:', error);
  }
}

// Function to update the status display in the quiz header
function updateStatusDisplay(trackingDisabled, injectEnabled, apiKeyExists, selectedModel) {
  // Add feedback to quiz header
  const quizHeader = document.querySelector('header.quiz-header');
  if (quizHeader) {
    // Remove existing status if present
    const existingStatus = document.getElementById('inwosent-status');
    if (existingStatus) {
      existingStatus.remove();
    }
    
    // Create status element
    const statusDiv = document.createElement('div');
    statusDiv.id = 'inwosent-status';
    statusDiv.style.backgroundColor = '#fff8fa';
    statusDiv.style.border = '2px solid #ff85a2';
    statusDiv.style.borderRadius = '8px';
    statusDiv.style.padding = '10px';
    statusDiv.style.margin = '10px 0';
    statusDiv.style.fontFamily = 'Quicksand, sans-serif';
    
    // Add status content
    let statusContent = '<h3 style="color: #ff85a2; margin: 0 0 8px 0;">✨ Inwosent Status ✨</h3>';
    statusContent += '<ul style="margin: 0; padding-left: 20px;">';
    
    if (trackingDisabled) {
      statusContent += '<li style="margin-bottom: 5px;"><b>Tracking Prevention:</b> <span style="color: #4CAF50;">Enabled</span> 🛡️</li>';
    } else {
      statusContent += '<li style="margin-bottom: 5px;"><b>Tracking Prevention:</b> <span style="color: #F44336;">Disabled</span></li>';
    }
    
    if (injectEnabled) {
      if (apiKeyExists) {
        statusContent += '<li style="margin-bottom: 5px;"><b>OpenRouter AI:</b> <span style="color: #4CAF50;">Enabled</span> 🤖</li>';
        if (selectedModel) {
          statusContent += `<li style="margin-bottom: 5px;"><b>Model:</b> <span style="color: #4CAF50;">${selectedModel}</span></li>`;
        }
      } else {
        statusContent += '<li style="margin-bottom: 5px;"><b>OpenRouter AI:</b> <span style="color: #FF9800;">Enabled but missing API key</span></li>';
      }
    } else {
      statusContent += '<li style="margin-bottom: 5px;"><b>OpenRouter AI:</b> <span style="color: #F44336;">Disabled</span></li>';
    }
    
    statusContent += '</ul>';
    statusDiv.innerHTML = statusContent;
    
    // Insert at the beginning of quiz header
    quizHeader.insertBefore(statusDiv, quizHeader.firstChild);
    console.log('Status display updated');
  } else {
    console.log('Quiz header not found, status display not updated');
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in content script:', message);
  
  if (message.action === 'applyTrackingPrevention') {
    applyTrackingPrevention(
      message.trackingDisabled, 
      message.injectEnabled, 
      message.apiKeyExists,
      message.selectedModel
    );
    sendResponse({ success: true });
  } else if (message.action === 'toggleApiInjection') {
    // Store API injection settings
    window.inwosent = window.inwosent || {};
    window.inwosent.apiInjectionEnabled = message.enabled;
    window.inwosent.apiKey = message.apiKey;
    
    // Update status display
    chrome.storage.local.get(['trackingPreventionEnabled'], (result) => {
      updateStatusDisplay(
        result.trackingPreventionEnabled || false,
        message.enabled,
        !!message.apiKey,
        message.selectedModel
      );
      
      // If API injection is enabled and we have an API key, get answers
      if (message.enabled && message.apiKey) {
        injectOpenAIAnswers(message.selectedModel);
      }
    });
    
    sendResponse({ success: true });
  } else if (message.action === 'getOpenAIAnswers') {
    injectOpenAIAnswers(message.selectedModel)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Return true to indicate we'll respond asynchronously
  return true;
});

// Check storage for settings on page load
chrome.storage.local.get(
  ['trackingPreventionEnabled', 'canvasUrl', 'apiInjectionEnabled', 'apiInjectionKey', 'selectedModel'], 
  (result) => {
    console.log('Retrieved settings from storage:', result);
    
    // Check if we're on the Canvas URL
    if (result.canvasUrl && window.location.href.includes(result.canvasUrl)) {
      console.log('On Canvas URL, applying settings');
      
      // Apply tracking prevention if enabled
      if (result.trackingPreventionEnabled) {
        applyTrackingPrevention(
          result.trackingPreventionEnabled,
          result.apiInjectionEnabled || false,
          !!(result.apiInjectionKey),
          result.selectedModel
        );
      } else if (result.apiInjectionEnabled && result.apiInjectionKey) {
        // If only API injection is enabled, just inject answers
        injectOpenAIAnswers(result.selectedModel);
      }
      
      // Store API injection settings
      if (result.apiInjectionEnabled) {
        window.inwosent = window.inwosent || {};
        window.inwosent.apiInjectionEnabled = result.apiInjectionEnabled;
        window.inwosent.apiKey = result.apiInjectionKey;
      }
    } else {
      console.log('Not on Canvas URL, skipping');
    }
  }
);
