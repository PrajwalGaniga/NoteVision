import React, { useState } from 'react';
import './QuizView.css';

// This component receives the quiz data (questions) as a prop
// and a function to call when the quiz is finished.
function QuizView({ quizData, onQuizComplete }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // Store user answers { questionIndex: answer }
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const currentQuestion = quizData.questions[currentQuestionIndex];

  // Handle selecting an answer
  const handleSelectAnswer = (option) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: option,
    });
  };

  // Move to the next question or show results
  const handleNext = () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      calculateScore();
      setShowResults(true);
    }
  };

  // Calculate the final score
  const calculateScore = () => {
    let currentScore = 0;
    quizData.questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.correct_answer) {
        currentScore++;
      }
    });
    setScore(currentScore);
  };

  // Render the results screen
  if (showResults) {
    return (
      <div className="quiz-container quiz-results">
        <h2>Quiz Complete!</h2>
        <p className="score">Your Score: {score} / {quizData.questions.length}</p>
        <h3>Review Your Answers:</h3>
        {quizData.questions.map((q, index) => (
          <div key={index} className="result-item">
            <p><strong>Q{index + 1}:</strong> {q.question}</p>
            <p className={selectedAnswers[index] === q.correct_answer ? 'correct' : 'incorrect'}>
              Your Answer: {selectedAnswers[index] || 'Not Answered'}
            </p>
            {selectedAnswers[index] !== q.correct_answer && (
              <p className="correct-answer">Correct Answer: {q.correct_answer}</p>
            )}
          </div>
        ))}
        <button onClick={() => onQuizComplete()} className="quiz-button">
          Back to Notes
        </button>
      </div>
    );
  }

  // Render the current question
  return (
    <div className="quiz-container">
      <h2>Quiz Time!</h2>
      <p className="question-counter">Question {currentQuestionIndex + 1} of {quizData.questions.length}</p>
      <h3 className="question-text">{currentQuestion.question}</h3>
      <div className="options-container">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelectAnswer(option)}
            className={`option-button ${selectedAnswers[currentQuestionIndex] === option ? 'selected' : ''}`}
          >
            {option}
          </button>
        ))}
      </div>
      <button
        onClick={handleNext}
        disabled={!selectedAnswers[currentQuestionIndex]} // Disable if no answer selected
        className="quiz-button next-button"
      >
        {currentQuestionIndex < quizData.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
      </button>
    </div>
  );
}

export default QuizView;