import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiShare2, 
  FiX, 
  FiMail, 
  FiLock, 
  FiEdit3, 
  FiEye,
  FiUser,
  FiCheck,
  FiLoader,
  FiAlertCircle
} from 'react-icons/fi';
import './ShareModal.css';

function ShareModal({ notebookId, notebookName, token, onClose, darkMode }) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [permission, setPermission] = useState('view');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9, 
      y: 20
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 25
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9, 
      y: 20
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!recipientEmail.trim()) {
      setMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          recipient_email: recipientEmail.trim(), 
          permission 
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
        return;
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || `Share failed: ${response.status}`;
      
      setMessage(errorMessage);

    } catch (error) {
      setMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading && !showSuccess) {
      onClose();
    }
  };

  // Success Animation Component
  const SuccessAnimation = () => (
    <div className="success-content">
      <motion.div 
        className="success-icon"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 15 
        }}
      >
        <FiCheck />
      </motion.div>
      
      <motion.h3 
        className="success-title"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Successfully Shared!
      </motion.h3>
      
      <motion.p 
        className="success-message"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        "{notebookName}" has been shared with {recipientEmail}
      </motion.p>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div 
        className="modal-backdrop"
        onClick={handleBackdropClick}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        data-theme={darkMode ? 'dark' : 'light'}
      >
        <motion.div 
          className="modal-content"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          {showSuccess ? (
            <SuccessAnimation />
          ) : (
            <div className="modal-form-content">
              {/* Header */}
              <div className="modal-header">
                <div className="header-content">
                  <FiShare2 className="header-icon" />
                  <h2>Share "{notebookName}"</h2>
                </div>
                <motion.button 
                  className="close-button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={isLoading}
                >
                  <FiX />
                </motion.button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="share-form">
                {/* Email Input */}
                <div className="input-group">
                  <label htmlFor="recipientEmail">
                    <FiMail className="label-icon" />
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    id="recipientEmail"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Enter email address"
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Permission Select */}
                <div className="input-group">
                  <label htmlFor="permission">
                    <FiLock className="label-icon" />
                    Permission Level
                  </label>
                  <select
                    id="permission"
                    value={permission}
                    onChange={(e) => setPermission(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="view">View Only</option>
                    <option value="edit">Can Edit</option>
                  </select>
                </div>

                {/* Permission Description */}
                <div className="permission-description">
                  <div className={`permission-icon ${permission}`}>
                    {permission === 'view' ? <FiEye /> : <FiEdit3 />}
                  </div>
                  <div className="permission-text">
                    <strong>
                      {permission === 'view' ? 'View Only' : 'Full Edit Access'}
                    </strong>
                    <p>
                      {permission === 'view' 
                        ? 'Can view notes but cannot make changes'
                        : 'Can view, edit, create, and delete notes'
                      }
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button 
                  type="submit" 
                  className="submit-button primary"
                  disabled={isLoading || !recipientEmail.trim()}
                  whileHover={!isLoading ? { scale: 1.02 } : {}}
                  whileTap={!isLoading ? { scale: 0.98 } : {}}
                >
                  {isLoading ? (
                    <>
                      <FiLoader className="loading-spinner" />
                      Sharing...
                    </>
                  ) : (
                    <>
                      <FiUser />
                      Share Notebook
                    </>
                  )}
                </motion.button>
              </form>

              {/* Error/Success Messages */}
              <AnimatePresence>
                {message && (
                  <motion.div 
                    className={`message ${message.includes('Error') || message.includes('failed') ? 'error' : 'success'}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {message.includes('Error') || message.includes('failed') ? (
                      <FiAlertCircle className="message-icon" />
                    ) : (
                      <FiCheck className="message-icon" />
                    )}
                    <span>{message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Close Button */}
              <motion.button 
                onClick={onClose}
                className="close-button secondary"
                disabled={isLoading}
                whileHover={!isLoading ? { scale: 1.02 } : {}}
                whileTap={!isLoading ? { scale: 0.98 } : {}}
              >
                <FiX />
                Cancel
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ShareModal;