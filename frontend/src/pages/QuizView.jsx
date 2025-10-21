// QuizView.jsx - Professional quiz component
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiAward, 
  FiCheck, 
  FiX, 
  FiArrowRight, 
  FiBook,
  FiBarChart2,
  FiClock,
  FiHome,
  FiAlertCircle
} from 'react-icons/fi';
import { IoSparkles } from 'react-icons/io5';
import './QuizView.css';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
};

const optionVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
      delay: 0.1
    }
  },
  hover: {
    scale: 1.02,
    y: -2,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10
    }
  },
  tap: {
    scale: 0.98
  }
};

const resultsVariants = {
  hidden: { scale: 0.8, opacity: 0, rotateX: -10 },
  visible: {
    scale: 1,
    opacity: 1,
    rotateX: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  }
};

function QuizView({ quizData, onQuizComplete }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate quizData on mount
  useEffect(() => {
    if (!quizData) {
      setError("No quiz data available");
      setIsLoading(false);
      return;
    }

    if (!quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      setError("No questions available in this quiz");
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  }, [quizData]);

  // Safe access to current question
  const getCurrentQuestion = () => {
    if (!quizData?.questions || currentQuestionIndex >= quizData.questions.length) {
      return null;
    }
    
    const question = quizData.questions[currentQuestionIndex];
    
    if (!question?.question || !question?.options || !Array.isArray(question.options) || !question.correct_answer) {
      return null;
    }
    
    return question;
  };

  const currentQuestion = getCurrentQuestion();

  // Handle selecting an answer
  const handleSelectAnswer = (option) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: option,
    }));
  };

  // Move to the next question or show results
  const handleNext = () => {
    if (currentQuestionIndex < (quizData?.questions?.length - 1 || 0)) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      calculateScore();
      setShowResults(true);
    }
  };

  // Calculate the final score
  const calculateScore = () => {
    if (!quizData?.questions) {
      setScore(0);
      return;
    }

    let currentScore = 0;
    quizData.questions.forEach((q, index) => {
      const userAnswer = selectedAnswers[index];
      const isCorrect = userAnswer === q.correct_answer;
      
      if (isCorrect) {
        currentScore++;
      }
    });

    setScore(currentScore);
    
    // Trigger celebration for good scores
    if (currentScore >= quizData.questions.length * 0.8) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2000);
    }
  };

  // Calculate progress percentage
  const getProgress = () => {
    if (!quizData?.questions?.length) return 0;
    return ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
  };

  const progress = getProgress();

  // Show loading state
  if (isLoading) {
    return (
      <motion.div 
        className="quiz-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="loading-state">
          <motion.div
            className="spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Loading quiz...
          </motion.p>
        </div>
      </motion.div>
    );
  }

  // Show error state
  if (error) {
    return (
      <motion.div 
        className="quiz-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="error-state">
          <FiAlertCircle className="error-icon" />
          <h3>Quiz Error</h3>
          <p>{error}</p>
          <motion.button 
            onClick={() => onQuizComplete?.()} 
            className="quiz-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiHome />
            Back to Notes
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Show no questions state
  if (!currentQuestion) {
    return (
      <motion.div 
        className="quiz-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="empty-state">
          <FiBook className="empty-icon" />
          <h3>No Questions Available</h3>
          <p>This quiz doesn't have any questions yet.</p>
          <motion.button 
            onClick={() => onQuizComplete?.()} 
            className="quiz-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiHome />
            Back to Notes
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Render the results screen
  if (showResults) {
    const percentage = Math.round((score / quizData.questions.length) * 100);
    const isExcellent = percentage >= 80;
    
    return (
      <motion.div 
        className="quiz-container quiz-results"
        variants={resultsVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 25, 
            delay: 0.1 
          }}
        >
          <motion.h2 
            className={`results-header ${celebrate ? 'celebrate' : ''}`}
            initial={{ scale: 0.5, y: -20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          >
            <FiAward className="header-icon" />
            Quiz Complete!
            {isExcellent && <IoSparkles className="sparkle-icon" />}
          </motion.h2>
          
          <motion.div 
            className="score-display"
            initial={{ scale: 0, rotateY: -180 }}
            animate={{ scale: 1, rotateY: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 250, 
              damping: 20, 
              delay: 0.3 
            }}
          >
            <div className="score-number">{score}</div>
            <div className="score-total">/ {quizData.questions.length}</div>
          </motion.div>

          <motion.div 
            className="score-breakdown"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div className="score-item" variants={itemVariants}>
              <div className="score-value">{percentage}%</div>
              <div className="score-label">Overall Score</div>
            </motion.div>
            <motion.div className="score-item" variants={itemVariants}>
              <div className="score-value">{score}</div>
              <div className="score-label">Correct Answers</div>
            </motion.div>
            <motion.div className="score-item" variants={itemVariants}>
              <div className="score-value">{quizData.questions.length - score}</div>
              <div className="score-label">Incorrect Answers</div>
            </motion.div>
          </motion.div>

          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="review-header"
          >
            <FiBarChart2 className="header-icon" />
            Review Your Answers
          </motion.h3>

          <AnimatePresence>
            {quizData.questions.map((q, index) => {
              const userAnswer = selectedAnswers[index];
              const isCorrect = userAnswer === q.correct_answer;
              
              return (
                <motion.div 
                  key={`result-${index}`}
                  className={`result-item ${isCorrect ? 'correct' : 'incorrect'}`}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                >
                  <div className="question-number">Q{index + 1}</div>
                  <p className="question-text">{q.question}</p>
                  
                  <div className={`answer-display ${isCorrect ? 'correct' : 'incorrect'}`}>
                    {isCorrect ? <FiCheck className="answer-icon" /> : <FiX className="answer-icon" />}
                    <span className="answer-label">
                      Your Answer: {userAnswer || 'Not Answered'}
                    </span>
                  </div>
                  
                  {userAnswer !== q.correct_answer && (
                    <div className="correct-answer">
                      <FiCheck className="answer-icon" />
                      <span>Correct Answer: {q.correct_answer}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          <motion.button 
            onClick={() => onQuizComplete?.()} 
            className="quiz-button primary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <FiHome className="button-icon" />
            Back to Notes
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  // Render the current question
  return (
    <motion.div 
      className="quiz-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.h2
        className="quiz-title"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 15, 
          delay: 0.1 
        }}
      >
        <FiBook className="header-icon" />
        Quiz Time!
      </motion.h2>

      {/* Progress Bar */}
      <motion.div 
        className="quiz-progress"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <div 
          className="progress-fill"
          style={{ 
            width: `${progress}%`,
            transition: 'width 0.3s ease'
          }}
        />
        <div className="progress-text">
          {Math.round(progress)}% Complete
        </div>
      </motion.div>

      <motion.p 
        className="question-counter"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.3 }}
      >
        <FiClock className="counter-icon" />
        Question {currentQuestionIndex + 1} of {quizData.questions.length}
      </motion.p>

      <motion.div 
        className="question-wrapper"
        variants={itemVariants}
        key={`question-${currentQuestionIndex}`}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ delay: 0.2 }}
      >
        <h3 className="question-text">{currentQuestion.question}</h3>
      </motion.div>

      <motion.div 
        className="options-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.3 }}
      >
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedAnswers[currentQuestionIndex] === option;
          
          return (
            <motion.button
              key={`${currentQuestionIndex}-option-${index}`}
              onClick={() => handleSelectAnswer(option)}
              className={`option-button ${isSelected ? 'selected' : ''}`}
              variants={optionVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              whileTap="tap"
              transition={{ delay: index * 0.05 }}
              disabled={isSelected}
            >
              <span className="option-number">{String.fromCharCode(65 + index)}.</span>
              <span className="option-text">{option}</span>
              {isSelected && <FiCheck className="option-check" />}
            </motion.button>
          );
        })}
      </motion.div>

      <motion.div 
        className="quiz-controls"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.4 }}
      >
        <motion.button
          onClick={handleNext}
          disabled={!selectedAnswers[currentQuestionIndex]}
          className={`quiz-button next-button ${!selectedAnswers[currentQuestionIndex] ? 'disabled' : ''}`}
          variants={itemVariants}
          whileHover={{ scale: selectedAnswers[currentQuestionIndex] ? 1.05 : 1 }}
          whileTap={{ scale: selectedAnswers[currentQuestionIndex] ? 0.95 : 1 }}
        >
          {currentQuestionIndex < (quizData.questions.length - 1) ? (
            <>
              Next Question <FiArrowRight className="button-icon" />
            </>
          ) : (
            <>
              Finish Quiz <FiAward className="button-icon" />
            </>
          )}
        </motion.button>
        
        {selectedAnswers[currentQuestionIndex] && (
          <motion.p 
            className="selection-indicator"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            ✓ Answer selected! Click next to continue.
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}

export default QuizView;