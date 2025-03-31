// OpenAI API helper for Inwosent
class OpenAIHelper {
  constructor(apiKey, modelId) {
    this.apiKey = apiKey;
    this.modelId = modelId || 'google/gemini-2.0-flash-001';  // Default model if none specified
    console.log(`OpenAIHelper initialized with model: ${this.modelId}`);
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
      const headerEl = questionEl.querySelector('.header');
      if (headerEl) {
        const nameEl = headerEl.querySelector('.question_name');
        if (nameEl) {
          const headerText = nameEl.textContent.trim();
          const match = headerText.match(/Question\s+(\d+)/i);
          if (match && match[1]) {
            questionNumber = match[1];
          }
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
      
      // Look for answer options in different possible structures
      // 1. Try answer_html elements
      const answerHtmlElements = questionEl.querySelectorAll('.answer_html');
      if (answerHtmlElements && answerHtmlElements.length > 0) {
        answerHtmlElements.forEach(element => {
          const optionText = element.textContent.trim();
          if (optionText) {
            options.push(optionText);
          }
        });
      }
      
      // 2. If no options found, try answer_label elements
      if (options.length === 0) {
        const answerLabels = questionEl.querySelectorAll('.answer_label');
        answerLabels.forEach(label => {
          options.push(label.textContent.trim());
        });
      }
      
      // 3. If still no options, try select_answer labels
      if (options.length === 0) {
        const selectAnswerLabels = questionEl.querySelectorAll('.select_answer label');
        selectAnswerLabels.forEach(label => {
          const optionText = label.textContent.trim();
          if (optionText) {
            options.push(optionText);
          }
        });
      }
      
      // Determine question type
      let questionType = 'unsupported';
      if (questionEl.classList.contains('multiple_choice_question') || options.length > 0) {
        questionType = 'multiple_choice';
      } else if (questionEl.classList.contains('numerical_question')) {
        questionType = 'numerical';
      } else if (questionEl.classList.contains('short_answer_question') || 
                questionEl.classList.contains('essay_question') ||
                questionEl.querySelector('input[type="text"]')) {
        questionType = 'text';
      }
      
      questions.push({
        id,
        text,
        options,
        isMultipleChoice: questionType === 'multiple_choice',
        questionType,
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
      const questionNumber = q.number || (index + 1).toString();
      let questionText = `Question ${questionNumber}: ${q.text}`;
      
      // Include options for multiple choice questions
      if (q.questionType === 'multiple_choice' && q.options && q.options.length > 0) {
        const optionsText = q.options.map((option, i) => `   - Option ${String.fromCharCode(65 + i)}: ${option}`).join('\n');
        questionText += `\nOptions:\n${optionsText}`;
      }
      
      // Add question type information
      questionText += `\nQuestion Type: ${q.questionType}`;
      questionText += `\nQuestion ID: ${q.id}`;
      
      return questionText;
    }).join('\n\n');
    
    // Create a comprehensive prompt for all questions
    return `Answer all of the following questions:

${questionsText}

For each question:
1. For multiple choice questions, identify the letter of the correct option (A, B, C, etc.)
2. For numerical questions, provide the numerical answer
3. For text/fill-in-the-blank questions, provide the text answer
4. For unsupported question types, provide only an explanation

Your response must be a valid JSON object with an "answers" array containing objects for each question.
Each answer object must include:
- questionNumber: the question number
- questionId: the question ID from the HTML
- answer: the answer (letter for multiple choice, value for numerical/text, empty for unsupported types)
- explanation: detailed explanation of the answer
- questionType: the type of question ("multiple_choice", "numerical", "text", or "unsupported")

Make sure to answer all questions in order.`;
  }
  
  parseAnswers(response, questionCount) {
    console.log('Parsing batch response for', questionCount, 'questions');
    
    try {
      // Parse the JSON response
      const jsonResponse = JSON.parse(response);
      
      if (!jsonResponse || !jsonResponse.answers || !Array.isArray(jsonResponse.answers)) {
        throw new Error('Invalid JSON response format');
      }
      
      // Extract answers from the structured response
      const structuredAnswers = jsonResponse.answers;
      
      // Store raw JSON for auto-answering
      window.lastStructuredAnswers = structuredAnswers;
      
      // Map to the format expected by the UI
      return structuredAnswers.map(answer => {
        const header = `### Answer to Question ${answer.questionNumber}:`;
        let content = answer.explanation;
        
        // Add answer information based on question type
        if (answer.questionType === 'multiple_choice' && answer.answer) {
          content = `The correct answer is ${answer.answer}.\n\n${content}`;
        } else if ((answer.questionType === 'numerical' || answer.questionType === 'text') && answer.answer) {
          content = `Answer: ${answer.answer}\n\n${content}`;
        }
        
        // Add structured data as JSON for auto-answering
        content += `\n\n\`\`\`json
{
  "questionId": "${answer.questionId}",
  "questionType": "${answer.questionType}",
  "answer": "${answer.answer}"
}
\`\`\``;
        
        return `${header}\n${content.trim()}`;
      });
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      console.log('Raw response:', response);
      
      // Fallback to the old parsing method if JSON parsing fails
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
      
      // Extract question types for the schema
      const questions = this.extractQuestions();
      const questionTypes = {};
      questions.forEach(q => {
        const questionId = q.id.replace('question_', '');
        // Determine question type based on class or options
        if (q.isMultipleChoice) {
          questionTypes[questionId] = 'multiple_choice';
        } else {
          // Check for numerical or fill-in-the-blank
          const questionEl = document.getElementById(q.id);
          if (questionEl && questionEl.classList.contains('numerical_question')) {
            questionTypes[questionId] = 'numerical';
          } else {
            questionTypes[questionId] = 'text';
          }
        }
      });
      
      // Create JSON schema for structured output
      const jsonSchema = {
        type: "object",
        properties: {
          answers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                questionNumber: {
                  type: "string",
                  description: "The question number"
                },
                questionId: {
                  type: "string",
                  description: "The question ID from the HTML"
                },
                answer: {
                  type: "string",
                  description: "The answer to the question (letter for multiple choice, value for numerical/text)"
                },
                explanation: {
                  type: "string",
                  description: "Detailed explanation of the answer"
                },
                questionType: {
                  type: "string",
                  enum: ["multiple_choice", "numerical", "text", "unsupported"],
                  description: "The type of question"
                }
              },
              required: ["questionNumber", "questionId", "explanation", "questionType"]
            }
          }
        },
        required: ["answers"]
      };
      
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
              content: `You are a helpful assistant that provides accurate answers to quiz questions. 
              For multiple choice questions, identify the correct option letter (A, B, C, D, etc.).
              For numerical questions, provide the numerical answer.
              For text/fill-in-the-blank questions, provide the text answer.
              For unsupported question types, leave the answer field empty but still provide an explanation.
              Be thorough in your explanations. Make sure to answer all questions in the batch.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 4000, // Increased for batch processing
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "quiz_answers",
              strict: true,
              schema: jsonSchema
            }
          },
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

  // Convert markdown to HTML using basic formatting
  markdownToHtml(markdown) {
    if (!markdown) return '';
    
    try {
      // Process headers
      let html = markdown
        // Headers (h1, h2, h3)
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        
        // Lists
        .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
        .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>')
        
        // Paragraphs and line breaks
        .replace(/\n\s*\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
      
      // Wrap in paragraph tags if not already
      if (!html.startsWith('<h') && !html.startsWith('<p>')) {
        html = '<p>' + html + '</p>';
      }
      
      return html;
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return `<p>${markdown.replace(/\n/g, '<br>')}</p>`;
    }
  }
}

// Make it available globally
window.OpenAIHelper = OpenAIHelper;
