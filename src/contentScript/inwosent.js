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
    answersContainer.style.backgroundColor = 'transparent';
    answersContainer.style.border = 'none';
    answersContainer.style.padding = '10px';
    answersContainer.style.margin = '10px 0';
    answersContainer.style.fontFamily = 'inherit';
    
    // Add CSS for selection styling
    const style = document.createElement('style');
    style.textContent = `
      .inwosent-answer::selection {
        color: #333;
        background-color: rgba(0, 0, 0, 0.1);
      }
    `;
    document.head.appendChild(style);
    
    // Add each answer
    for (const answerData of answers) {
      const answerContainer = document.createElement('div');
      answerContainer.className = 'inwosent-answer';
      answerContainer.style.marginBottom = '10px';
      answerContainer.style.padding = '5px';
      answerContainer.style.backgroundColor = 'transparent';
      answerContainer.style.color = 'transparent';
      answerContainer.style.userSelect = 'all';
    
      // Get question text and number
      const questionEl = document.getElementById(answerData.questionId);
      const questionTextEl = questionEl ? questionEl.querySelector('.question_text') : null;
      const questionText = questionTextEl ? questionTextEl.textContent.trim() : 'Question';
    
      // Find question number from the DOM
      let questionNumber = '';
      const questionHeaderEl = questionEl ? questionEl.querySelector('.question_header') : null;
      if (questionHeaderEl) {
        const headerText = questionHeaderEl.textContent.trim();
        const match = headerText.match(/Question\s+(\d+)/i);
        if (match && match[1]) {
          questionNumber = match[1];
        }
      }
    
      // If we couldn't find the number in the DOM, try to extract it from the ID
      if (!questionNumber) {
        const idMatch = answerData.questionId.match(/question_(\d+)/);
        if (idMatch && idMatch[1]) {
          questionNumber = idMatch[1];
        }
      }
    
      // Add invisible marker for question with number
      const questionMarker = document.createElement('div');
      questionMarker.textContent = questionNumber ? `Question ${questionNumber}` : '.';
      questionMarker.style.color = 'transparent';
      questionMarker.style.fontSize = '1px';
      questionMarker.style.height = '1px';
      answerContainer.appendChild(questionMarker);
    
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
    
    // Add minimal status indicator
    let statusContent = '';
  
    if (trackingDisabled) {
      statusContent += '<span style="color: transparent; font-size: 1px;">T</span>';
    }
  
    if (injectEnabled && apiKeyExists) {
      statusContent += '<span style="color: transparent; font-size: 1px;">A</span>';
    }
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
