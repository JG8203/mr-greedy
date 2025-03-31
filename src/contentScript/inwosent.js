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

// Global variables
let answersVisible = false;
let lastAnswersData = null;

// Function to toggle answer visibility
function toggleAnswersVisibility() {
  const answersContainer = document.getElementById('inwosent-answers');
  if (!answersContainer) return;
  
  answersVisible = !answersVisible;
  
  // Toggle visibility of all answer elements
  const answers = answersContainer.querySelectorAll('.inwosent-answer');
  answers.forEach(answer => {
    const answerContent = answer.querySelector('div:not([style*="font-size: 1px"])');
    if (answerContent) {
      answerContent.hidden = !answersVisible;
    }
  });
}

// Function to auto-answer quiz questions
function autoAnswerQuiz() {
  if (!lastAnswersData || !Array.isArray(lastAnswersData)) {
    console.error('No answer data available for auto-answering');
    return;
  }
  
  console.log('Auto-answering quiz with data:', lastAnswersData);
  
  let answeredCount = 0;
  
  lastAnswersData.forEach(answerData => {
    try {
      const questionId = answerData.questionId;
      const questionEl = document.getElementById(questionId);
      if (!questionEl) return;
      
      // Parse the JSON content from the answer
      let parsedAnswer;
      try {
        // Extract JSON from the answer text if it exists
        const jsonMatch = answerData.answer.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          parsedAnswer = JSON.parse(jsonMatch[1]);
        } else {
          // Try to parse the entire answer as JSON
          parsedAnswer = JSON.parse(answerData.answer);
        }
      } catch (e) {
        // If JSON parsing fails, use the raw answer
        parsedAnswer = null;
      }
      
      // Get the answer from either parsed JSON or raw text
      const answer = parsedAnswer ? parsedAnswer.answer : answerData.answer;
      
      // Determine question type
      if (questionEl.classList.contains('multiple_choice_question')) {
        // Handle multiple choice questions
        handleMultipleChoiceQuestion(questionEl, answer);
        answeredCount++;
      } else if (questionEl.classList.contains('numerical_question') || 
                questionEl.querySelector('input[type="text"]')) {
        // Handle numerical or text input questions
        handleTextInputQuestion(questionEl, answer);
        answeredCount++;
      }
    } catch (error) {
      console.error(`Error auto-answering question:`, error);
    }
  });
  
  console.log(`Auto-answered ${answeredCount} questions`);
}

// Function to handle multiple choice questions
function handleMultipleChoiceQuestion(questionEl, answer) {
  // If answer is a letter (A, B, C, etc.), convert to index
  let optionIndex = -1;
  if (typeof answer === 'string' && answer.length === 1) {
    const letterCode = answer.toUpperCase().charCodeAt(0);
    if (letterCode >= 65 && letterCode <= 90) { // A-Z
      optionIndex = letterCode - 65;
    }
  }
  
  // Get all radio inputs in the question
  const radioInputs = questionEl.querySelectorAll('input[type="radio"]');
  
  if (optionIndex >= 0 && optionIndex < radioInputs.length) {
    // Select by index if we have a valid letter
    radioInputs[optionIndex].checked = true;
    radioInputs[optionIndex].dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // Try to match by content
    const options = questionEl.querySelectorAll('.answer_html, .answer_text');
    options.forEach((option, index) => {
      if (index < radioInputs.length && option.textContent.includes(answer)) {
        radioInputs[index].checked = true;
        radioInputs[index].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
}

// Function to handle text input questions
function handleTextInputQuestion(questionEl, answer) {
  // Find the input field
  const inputField = questionEl.querySelector('input[type="text"], .numerical_question_input');
  
  if (inputField) {
    // Set the value
    inputField.value = answer;
    
    // Dispatch events to trigger any listeners
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    inputField.dispatchEvent(new Event('change', { bubbles: true }));
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
    
    // Store answers for auto-answering
    lastAnswersData = answers;
    
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
    
    // Reset visibility state when injecting new answers
    answersVisible = false;
    
    // Add CSS for styling
    const style = document.createElement('style');
    style.textContent = `
      .inwosent-answer::selection {
        color: #333;
        background-color: rgba(0, 0, 0, 0.1);
      }
      
      .inwosent-auto-answer-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #ff85a2;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 15px;
        font-family: 'Quicksand', sans-serif;
        font-weight: bold;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
      }
      
      .inwosent-auto-answer-btn:hover {
        background-color: #ff6b8e;
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(style);
    
    // Add auto-answer button
    const existingBtn = document.getElementById('inwosent-auto-answer-btn');
    if (existingBtn) {
      existingBtn.remove();
    }
    
    const autoAnswerBtn = document.createElement('button');
    autoAnswerBtn.id = 'inwosent-auto-answer-btn';
    autoAnswerBtn.className = 'inwosent-auto-answer-btn';
    autoAnswerBtn.textContent = 'Auto-Answer Quiz';
    autoAnswerBtn.addEventListener('click', autoAnswerQuiz);
    document.body.appendChild(autoAnswerBtn);
    
    // Add each answer
    for (const answerData of answers) {
      const answerContainer = document.createElement('div');
      answerContainer.className = 'inwosent-answer';
      answerContainer.style.marginBottom = '10px';
      answerContainer.style.padding = '5px';
      answerContainer.style.backgroundColor = 'transparent';
      answerContainer.style.color = 'inherit';
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
      // Start hidden by default
      answerContent.hidden = true;
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

// Add keyboard event listener for toggling answer visibility
document.addEventListener('keydown', (event) => {
  // Check if the key pressed is 'c' or 'C'
  if (event.key.toLowerCase() === 'c') {
    // Only toggle if we're not in an input field
    const activeElement = document.activeElement;
    const isInputField = activeElement.tagName === 'INPUT' || 
                         activeElement.tagName === 'TEXTAREA' || 
                         activeElement.isContentEditable;
    
    if (!isInputField) {
      toggleAnswersVisibility();
    }
  }
});

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
  } else if (message.action === 'toggleAnswersVisibility') {
    toggleAnswersVisibility();
    sendResponse({ success: true, visible: answersVisible });
    return true;
  } else if (message.action === 'autoAnswerQuiz') {
    autoAnswerQuiz();
    sendResponse({ success: true });
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
