// OpenAI API helper for Inwosent
class OpenAIHelper {
  constructor(apiKey, modelId) {
    this.apiKey = apiKey;
    this.modelId = modelId || 'google/gemini-2.0-flash-001';  // Default model if none specified
    console.log(`OpenAIHelper initialized with model: ${this.modelId}`);
    this.loadMarked();
  }
  
  // Load marked.js library dynamically
  loadMarked() {
    if (typeof marked === 'undefined') {
      console.log('Loading marked.js library...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js';
      script.onload = () => {
        console.log('marked.js library loaded successfully');
        // Configure marked options
        if (typeof marked !== 'undefined') {
          marked.setOptions({
            gfm: true,
            breaks: true,
            sanitize: false,
            smartLists: true,
            smartypants: true,
            xhtml: false
          });
        }
      };
      script.onerror = () => console.error('Failed to load marked.js library');
      document.head.appendChild(script);
    } else {
      console.log('marked.js library already loaded');
    }
  }

  async getAnswersForQuestions() {
    if (!this.apiKey) {
      console.error('No API key provided for OpenAI');
      return null;
    }

    try {
      // Get all questions from the page
      const questions = this.extractQuestions();
      if (!questions || questions.length === 0) {
        console.log('No questions found on the page');
        return null;
      }

      console.log(`Found ${questions.length} questions to process`);
      
      // Send all questions in a single batch request
      const allAnswers = await this.getAllAnswersInOneRequest(questions);
      
      // Map answers back to their questions
      const answers = questions.map((question, index) => ({
        questionId: question.id,
        answer: allAnswers[index]
      }));
      
      return answers;
    } catch (error) {
      console.error('Error getting answers from OpenAI:', error);
      return null;
    }
  }

  extractQuestions() {
    const questions = [];
    const questionElements = document.querySelectorAll('.display_question');
    
    questionElements.forEach(questionEl => {
      const id = questionEl.id;
      const textEl = questionEl.querySelector('.question_text');
      const text = textEl ? textEl.textContent.trim() : '';
      
      // Try to extract question number from header or ID
      let questionNumber = '';
      const questionHeaderEl = questionEl.querySelector('.question_header');
      if (questionHeaderEl) {
        const headerText = questionHeaderEl.textContent.trim();
        const match = headerText.match(/Question\s+(\d+)/i);
        if (match && match[1]) {
          questionNumber = match[1];
        }
      }
      
      // If we couldn't find the number in the header, try to extract it from the ID
      if (!questionNumber) {
        const idMatch = id.match(/question_(\d+)/);
        if (idMatch && idMatch[1]) {
          questionNumber = idMatch[1];
        }
      }
      
      // Extract answer options
      const options = [];
      const answerLabels = questionEl.querySelectorAll('.answer_label');
      answerLabels.forEach(label => {
        options.push(label.textContent.trim());
      });
      
      questions.push({
        id,
        text,
        options,
        number: questionNumber || (questions.length + 1).toString()
      });
    });
    
    return questions;
  }

  async getAllAnswersInOneRequest(questions) {
    try {
      // Build a single prompt with all questions
      const prompt = this.buildBatchPrompt(questions);
      console.log('Sending batch request with all questions');
      
      // Call OpenAI with the batch prompt
      const response = await this.callOpenAI(prompt);
      
      // Parse the response to extract individual answers
      return this.parseAnswers(response, questions.length);
    } catch (error) {
      console.error(`Error getting answers for questions:`, error);
      return questions.map(() => `Error: Could not get answer. ${error.message}`);
    }
  }

  buildBatchPrompt(questions) {
    // Format all questions into a single text block
    const questionsText = questions.map((q, index) => {
      const optionsText = q.options.map(option => `   - ${option}`).join('\n');
      const questionNumber = q.number || (index + 1).toString();
      return `Question ${questionNumber}: ${q.text}\nOptions:\n${optionsText}`;
    }).join('\n\n');
    
    // Create a comprehensive prompt for all questions
    return `Answer all of the following multiple choice questions:

${questionsText}

For each question, provide the correct answer with a brief explanation. Use simple plaintext formatting.
Start each answer with "### Answer to Question X:" where X is the question number.
Include the question number in your explanation as well (e.g., "For question 3, the correct answer is...").
Make sure to answer all questions in order.`;
  }
  
  parseAnswers(response, questionCount) {
    console.log('Parsing batch response for', questionCount, 'questions');
    
    // Split the response by answer headers
    const answerPattern = /### Answer to Question \d+:/g;
    const parts = response.split(answerPattern);
    
    // First part is usually empty or contains intro text
    parts.shift();
    
    // If we don't have enough answers, pad with error messages
    const answers = parts.slice(0, questionCount);
    while (answers.length < questionCount) {
      answers.push("Could not parse an answer for this question.");
    }
    
    // Add the header back to each answer for better context
    const headers = response.match(answerPattern) || [];
    return answers.map((answer, index) => {
      const header = headers[index] || `### Answer to Question ${index + 1}:`;
      return `${header}\n${answer.trim()}`;
    });
  }

  async callOpenAI(prompt) {
    // Create a small indicator for processing
    const processingIndicator = document.createElement('div');
    processingIndicator.id = 'inwosent-processing-indicator';
    processingIndicator.style.position = 'fixed';
    processingIndicator.style.bottom = '10px';
    processingIndicator.style.right = '10px';
    processingIndicator.style.width = '10px';
    processingIndicator.style.height = '10px';
    processingIndicator.style.borderRadius = '50%';
    processingIndicator.style.backgroundColor = '#ff85a2';
    processingIndicator.style.opacity = '0.5';
    processingIndicator.style.zIndex = '9999';
    document.body.appendChild(processingIndicator);
    
    let fullResponse = '';
    
    try {
      const modelToUse = this.modelId || 'google/gemini-2.0-flash-001';
      console.log(`Using model: ${modelToUse} for batch request`);
      
      // Increase max_tokens for batch requests to ensure all questions get answered
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Inwosent Quiz Helper'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that provides accurate answers to multiple choice questions. Be concise but thorough in your explanations. Use simple plaintext formatting rather than complex markdown. Make sure to answer all questions in the batch.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 4000, // Increased for batch processing
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new chunk to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from buffer
          while (true) {
            const lineEnd = buffer.indexOf('\n');
            if (lineEnd === -1) break;

            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);

            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0].delta.content;
                if (content) {
                  fullResponse += content;
                  
                  // Update the stream output
                  const streamOutputEl = document.getElementById('inwosent-stream-output');
                  if (streamOutputEl) {
                    streamOutputEl.textContent = fullResponse;
                    streamOutputEl.scrollTop = streamOutputEl.scrollHeight;
                  }
                }
              } catch (e) {
                // Ignore invalid JSON
              }
            }
          }
        }
      } finally {
        reader.cancel();
      }
      
      // Remove the processing indicator
      const processingIndicator = document.getElementById('inwosent-processing-indicator');
      if (processingIndicator) {
        processingIndicator.remove();
      }
      
      return fullResponse;
    } catch (error) {
      console.error('Error in streaming API call:', error);
      
      // Show a small error indicator
      const processingIndicator = document.getElementById('inwosent-processing-indicator');
      if (processingIndicator) {
        processingIndicator.style.backgroundColor = '#F44336';
        setTimeout(() => {
          processingIndicator.remove();
        }, 3000);
      }
      
      throw error;
    }
  }

  // Convert markdown to HTML using marked.js
  markdownToHtml(markdown) {
    if (!markdown) return '';
    
    // Check if marked is available
    if (typeof marked === 'undefined') {
      // Fallback to basic formatting if marked isn't loaded
      console.warn('marked.js not available, using basic formatting');
      return `<p>${markdown.replace(/\n/g, '<br>')}</p>`;
    }
    
    // Convert markdown to HTML using marked
    try {
      return marked.parse(markdown);
    } catch (error) {
      console.error('Error parsing markdown with marked:', error);
      return `<p>${markdown.replace(/\n/g, '<br>')}</p>`;
    }
  }
}

// Make it available globally
window.OpenAIHelper = OpenAIHelper;
