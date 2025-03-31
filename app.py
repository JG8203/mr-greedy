from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
import os

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'test-secret-key'

# Simple in-memory user storage
users = {
    'test': 'password'
}

# Quiz data structure
quizzes = [
    {
        'id': 0,
        'title': 'Exercise 3 – Problem Solving',
        'description': 'Share capital transactions and journal entries',
        'questions': [
            {
                'id': 'question_1',
                'type': 'text',
                'text': '''
                <p>Zenith Corp. was organized on January 1, 20x1 with an authorized share capital of 50,000 ordinary shares at $20 par. During its first year, Zenith Corp. had the following share transactions:</p>
                <ul>
                    <li>Jan 2 – Issued 5,000 ordinary shares for $25 each (all for cash).</li>
                    <li>Feb 14 – Subscribed 2,000 ordinary shares for $30 each, with 50% paid upon subscription; the remainder is payable in 90 days.</li>
                    <li>Mar 31 – Issued 1,000 ordinary shares for accounting services valued at $28,000.</li>
                    <li>Apr 1 – Collected the balance on the subscription receivable from Feb 14.</li>
                </ul>
                <p><strong>Required:</strong></p>
                <p>Prepare the journal entries for each date using the journal entry method (i.e., record Subscribed Share Capital and Subscriptions Receivable when applicable).</p>
                ''',
                'points': 10,
                'answer': 'Jan 2: Cash 125,000, Ordinary Share Capital 100,000, Share Premium 25,000'
            },
            {
                'id': 'question_2',
                'type': 'numerical',
                'text': '''
                <p>Using the information from the previous question about Zenith Corp:</p>
                <p><strong>Required:</strong></p>
                <p>Compute the total contributed capital as of April 1, 20x1.</p>
                ''',
                'points': 5,
                'answer': 213000,
                'answer_format': 'currency'
            }
        ]
    }
]

# Simple in-memory storage for quiz submissions
submissions = {}

@app.route('/')
def index():
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('quiz_list.html', quizzes=quizzes)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username in users and users[username] == password:
            session['username'] = username
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route('/quiz/<int:quiz_id>')
def show_quiz(quiz_id):
    if 'username' not in session:
        return redirect(url_for('login'))
    
    if quiz_id < len(quizzes):
        return render_template('quiz.html', quiz=quizzes[quiz_id])
    return "Quiz not found", 404

@app.route('/api/submit_quiz', methods=['POST'])
def submit_quiz():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    data = request.json
    quiz_id = data.get('quiz_id')
    answers = data.get('answers', {})
    
    if quiz_id >= len(quizzes):
        return jsonify({'success': False, 'message': 'Quiz not found'})
    
    quiz = quizzes[quiz_id]
    score = 0
    total = len(quiz['questions'])
    results = []
    
    for question in quiz['questions']:
        q_id = question['id']
        user_answer = answers.get(q_id, '')
        correct_answer = str(question['answer'])
        
        # Simple validation
        is_correct = False
        if question['type'] == 'numerical':
            try:
                # Remove any commas and dollar signs
                user_answer = user_answer.replace(',', '').replace('$', '')
                is_correct = abs(float(user_answer) - float(correct_answer)) < 0.01
            except:
                is_correct = False
        else:
            # For text questions, check if key terms are present
            is_correct = correct_answer.lower() in user_answer.lower()
        
        if is_correct:
            score += question['points']
        
        results.append({
            'question_id': q_id,
            'is_correct': is_correct,
            'user_answer': user_answer,
            'correct_answer': correct_answer,
            'points': question['points'] if is_correct else 0
        })
    
    # Store submission
    submission_id = len(submissions)
    submissions[submission_id] = {
        'quiz_id': quiz_id,
        'username': session['username'],
        'score': score,
        'total_points': sum(q['points'] for q in quiz['questions']),
        'results': results,
        'timestamp': os.path.getmtime(__file__)  # Simple timestamp
    }
    
    return jsonify({
        'success': True,
        'message': 'Quiz submitted successfully',
        'score': score,
        'total': total,
        'submission_id': submission_id
    })

@app.route('/results/<int:submission_id>')
def show_results(submission_id):
    if 'username' not in session:
        return redirect(url_for('login'))
    
    if submission_id not in submissions:
        return "Submission not found", 404
    
    submission = submissions[submission_id]
    quiz = quizzes[submission['quiz_id']]
    
    return render_template('results.html', 
                          submission=submission, 
                          quiz=quiz)

if __name__ == '__main__':
    app.run(debug=True)
