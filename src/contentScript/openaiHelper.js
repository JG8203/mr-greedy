// OpenAI API helper for Inwosent
class OpenAIHelper {
  constructor(apiKey) {
    this.apiKey = apiKey;
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
      
      // Send all questions in a single request
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
      
      // Extract answer options
      const options = [];
      const answerLabels = questionEl.querySelectorAll('.answer_label');
      answerLabels.forEach(label => {
        options.push(label.textContent.trim());
      });
      
      questions.push({
        id,
        text,
        options
      });
    });
    
    return questions;
  }

  async getAllAnswersInOneRequest(questions) {
    try {
      const prompt = this.buildBatchPrompt(questions);
      const response = await this.callOpenAI(prompt);
      
      // Parse the response to extract individual answers
      return this.parseAnswers(response, questions.length);
    } catch (error) {
      console.error(`Error getting answers for questions:`, error);
      return questions.map(() => `Error: Could not get answer. ${error.message}`);
    }
  }

  buildBatchPrompt(questions) {
    const questionsText = questions.map((q, index) => {
      const optionsText = q.options.map(option => `   - ${option}`).join('\n');
      return `Question ${index + 1}: ${q.text}\nOptions:\n${optionsText}`;
    }).join('\n\n');
    
    return `Answer all of the following multiple choice questions:

${questionsText}

For each question, provide the correct answer with a brief explanation. Use simple plaintext formatting.
Start each answer with "### Answer to Question X:" where X is the question number.`;
  }
  
  parseAnswers(response, questionCount) {
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
    
    return answers.map(answer => answer.trim());
  }

  async callOpenAI(prompt) {
    // Create a container for streaming output
    const streamContainer = document.createElement('div');
    streamContainer.id = 'inwosent-stream-container';
    streamContainer.style.backgroundColor = '#fff8fa';
    streamContainer.style.border = '2px solid #ff85a2';
    streamContainer.style.borderRadius = '8px';
    streamContainer.style.padding = '20px';
    streamContainer.style.margin = '20px 0';
    streamContainer.style.fontFamily = 'Quicksand, sans-serif';
    
    // Add header
    const header = document.createElement('h2');
    header.textContent = '✨ Inwosent AI Processing... ✨';
    header.style.color = '#ff85a2';
    header.style.marginTop = '0';
    streamContainer.appendChild(header);
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.textContent = 'Generating answers...';
    loadingIndicator.style.marginBottom = '10px';
    streamContainer.appendChild(loadingIndicator);
    
    // Add stream output area
    const streamOutput = document.createElement('div');
    streamOutput.id = 'inwosent-stream-output';
    streamOutput.style.whiteSpace = 'pre-wrap';
    streamOutput.style.fontFamily = 'monospace';
    streamOutput.style.fontSize = '14px';
    streamOutput.style.lineHeight = '1.5';
    streamOutput.style.padding = '10px';
    streamOutput.style.backgroundColor = '#f8f8f8';
    streamOutput.style.borderRadius = '4px';
    streamOutput.style.height = '100px';
    streamOutput.style.overflow = 'auto';
    streamContainer.appendChild(streamOutput);
    
    // Add to page
    const questionsContainer = document.getElementById('questions');
    if (questionsContainer) {
      // Remove existing stream container if it exists
      const existingContainer = document.getElementById('inwosent-stream-container');
      if (existingContainer) {
        existingContainer.remove();
      }
      
      questionsContainer.parentNode.insertBefore(streamContainer, questionsContainer.nextSibling);
    }
    
    let fullResponse = '';
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Inwosent Quiz Helper'
        },
        body: JSON.stringify({
          model: 'google/gemini-flash-1.5',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that provides accurate answers to multiple choice questions. Be concise but thorough in your explanations. Use simple plaintext formatting rather than complex markdown.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
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
      
      // Update the header to show completion
      header.textContent = '✨ Inwosent AI Completed ✨';
      loadingIndicator.textContent = 'Answers generated successfully!';
      loadingIndicator.style.color = '#4CAF50';
      
      return fullResponse;
    } catch (error) {
      console.error('Error in streaming API call:', error);
      
      // Update the header to show error
      if (document.getElementById('inwosent-stream-container')) {
        header.textContent = '❌ Inwosent AI Error ❌';
        loadingIndicator.textContent = `Error: ${error.message}`;
        loadingIndicator.style.color = '#F44336';
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
