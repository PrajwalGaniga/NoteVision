import React, { useState } from 'react';
import './ShareModal.css';

function ShareModal({ notebookId, notebookName, token, onClose }) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [permission, setPermission] = useState('view'); // Default to view-only
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recipientEmail) {
      setMessage('Please enter the recipient\'s email address.');
      return;
    }
    setIsLoading(true);
    setMessage('Sharing notebook...');
    console.log(`DEBUG: Sharing notebook ${notebookId} with ${recipientEmail}, permission: ${permission}`);

    try {
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipient_email: recipientEmail, permission }),
      });

      // Check for non-JSON success (like 204 No Content)
      if (response.ok && response.status === 204) {
          setMessage(`Notebook successfully shared with ${recipientEmail}!`);
          console.log('DEBUG: Share successful (204)');
          setRecipientEmail(''); // Clear input on success
          // Optionally close modal after a delay
          setTimeout(onClose, 2000); // Close after 2 seconds
          return; // Exit early
      }

      // Handle potential JSON error responses
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      // Handle unexpected successful JSON response (though we expect 204)
      setMessage(`Notebook successfully shared with ${recipientEmail}!`);
      console.log('DEBUG: Share successful (unexpected JSON response):', data);
      setRecipientEmail('');
      setTimeout(onClose, 2000);

    } catch (error) {
      console.error('ERROR sharing notebook:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Modal backdrop (for clicking outside to close)
    <div className="modal-backdrop" onClick={onClose}>
      {/* Modal content area (stop propagation prevents closing when clicking inside) */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Share "{notebookName}"</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="recipientEmail">Recipient Email:</label>
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

          <div className="input-group">
            <label htmlFor="permission">Permission:</label>
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

          <button type="submit" className="share-submit-button" disabled={isLoading}>
            {isLoading ? 'Sharing...' : 'Share Notebook'}
          </button>
        </form>

        {message && <p className={`share-message ${message.startsWith('Error') ? 'error' : 'success'}`}>{message}</p>}

        <button onClick={onClose} className="close-modal-button" disabled={isLoading}>
          Close
        </button>
      </div>
    </div>
  );
}

export default ShareModal;