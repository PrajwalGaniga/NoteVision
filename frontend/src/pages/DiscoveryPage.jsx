import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DiscoveryPage.css';

function DiscoveryPage({ darkMode }) {
  const [publicNotebooks, setPublicNotebooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Discover amazing public notebooks...');
  const [isLiking, setIsLiking] = useState({});
  const token = localStorage.getItem('token');
  const currentUserEmail = localStorage.getItem('email');

  // Function to Fetch/Search Public Notebooks
  const searchNotebooks = async (query = '') => {
    setIsLoading(true);
    setMessage(query ? `Searching for "${query}"...` : 'Loading public notebooks...');
    setPublicNotebooks([]);
    console.log(`DEBUG: Searching public notebooks with query: "${query}"`);

    try {
      if (!token) throw new Error('Not logged in.');

      const url = `http://127.0.0.1:8000/notebooks/public/search${query ? `?query=${encodeURIComponent(query)}` : ''}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired.');
        throw new Error('Failed to fetch public notebooks.');
      }

      const data = await response.json();
      setPublicNotebooks(data);
      
      if (data.length === 0) {
        setMessage(query 
          ? `No public notebooks found matching "${query}". Try different keywords!`
          : 'No public notebooks available yet. Be the first to share your notes!'
        );
      } else {
        setMessage('');
      }
      
      console.log('DEBUG: Received public notebooks:', data);

    } catch (error) {
      console.error('ERROR searching notebooks:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to Handle Liking/Unliking
  const handleLikeToggle = async (notebookId) => {
    if (isLiking[notebookId]) return; // Prevent multiple clicks
    
    setIsLiking(prev => ({ ...prev, [notebookId]: true }));
    
    // Find the notebook in the current state to update UI instantly (optimistic update)
    const notebookIndex = publicNotebooks.findIndex(nb => nb._id === notebookId);
    if (notebookIndex === -1) return;

    const notebookToUpdate = publicNotebooks[notebookIndex];
    const alreadyLiked = notebookToUpdate.likes.includes(currentUserEmail);

    // Optimistic UI update
    const updatedNotebook = {
      ...notebookToUpdate,
      likes: alreadyLiked
        ? notebookToUpdate.likes.filter(email => email !== currentUserEmail)
        : [...notebookToUpdate.likes, currentUserEmail]
    };
    
    const updatedList = [...publicNotebooks];
    updatedList[notebookIndex] = updatedNotebook;
    setPublicNotebooks(updatedList);

    console.log(`DEBUG: Toggling like for notebook ${notebookId}`);
    
    try {
      if (!token) throw new Error('Not logged in.');

      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        // Revert optimistic update on error
        const originalList = [...publicNotebooks];
        originalList[notebookIndex] = notebookToUpdate;
        setPublicNotebooks(originalList);
        
        if (response.status === 401) throw new Error('Session expired.');
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update like status.');
      }

      console.log(`DEBUG: Like toggle successful for ${notebookId}`);

    } catch (error) {
      console.error('ERROR toggling like:', error);
      setMessage(`❌ Error: ${error.message}`);
      // Revert optimistic update on error
      const originalList = [...publicNotebooks];
      originalList[notebookIndex] = notebookToUpdate;
      setPublicNotebooks(originalList);
    } finally {
      setIsLiking(prev => ({ ...prev, [notebookId]: false }));
    }
  };

  // Get popularity indicator based on like count
  const getPopularityIndicator = (likeCount) => {
    if (likeCount >= 10) return 'high';
    if (likeCount >= 5) return 'medium';
    return 'low';
  };

  // Fetch initial list on component mount
  useEffect(() => {
    searchNotebooks();
  }, []);

  // Handle search input changes
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    searchNotebooks(value);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    searchNotebooks('');
  };

  return (
    <div className="discovery-page-container" data-theme={darkMode ? 'dark' : 'light'}>
      <header className="discovery-header">
        <h1>Discover Public Notes 🌍</h1>
        <p>
          Explore and learn from notebooks shared by the community. 
          {publicNotebooks.length > 0 && ` Found ${publicNotebooks.length} notebook${publicNotebooks.length !== 1 ? 's' : ''}`}
        </p>
      </header>

      {/* Search Bar */}
      <div className="discovery-search-bar">
        <input
          type="text"
          placeholder="Search by notebook name, tags, or topics..."
          value={searchTerm}
          onChange={handleSearchChange}
          disabled={isLoading}
        />
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            style={{
              position: 'absolute',
              right: 'var(--space-md)',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              fontSize: '1.2rem'
            }}
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className={`discovery-message ${isLoading ? 'loading' : message.includes('Error') ? 'error' : ''}`}>
          {message}
        </div>
      )}

      {/* Public Notebooks Grid */}
      <div className="public-notebook-list">
        {publicNotebooks.map((notebook) => {
          const isLiked = notebook.likes.includes(currentUserEmail);
          const likeCount = notebook.likes.length;
          const popularity = getPopularityIndicator(likeCount);
          
          return (
            <div key={notebook._id} className="public-notebook-card">
              {/* Featured Badge for highly liked notebooks */}
              {likeCount >= 10 && (
                <div className="featured-badge">
                  Featured 🔥
                </div>
              )}
              
              <h3>{notebook.name}</h3>
              
              <p className="owner-info">
                Shared by: {notebook.owner_email}
              </p>

              {/* Popularity Indicator */}
              <div className="popularity-indicator ${popularity}">
                {likeCount} like{likeCount !== 1 ? 's' : ''}
              </div>

              {/* Tags */}
              {notebook.tags && notebook.tags.length > 0 && (
                <div className="tags-container">
                  {notebook.tags.map((tag, index) => (
                    <span key={index} className="tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Card Footer */}
              <div className="card-footer">
                <Link 
                  to={`/notebook/${notebook._id}`} 
                  className="open-public-button"
                  title={`View ${notebook.name}`}
                >
                  👁️ View Notes
                </Link>
                
                <button
                  onClick={() => handleLikeToggle(notebook._id)}
                  className={`like-button ${isLiked ? 'liked' : ''}`}
                  title={isLiked ? 'Unlike this notebook' : 'Like this notebook'}
                  disabled={isLiking[notebook._id]}
                >
                  {isLiked ? '❤️' : '🤍'} 
                  <span>{likeCount}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State when no results */}
      {!isLoading && publicNotebooks.length === 0 && searchTerm && (
        <div className="empty-state">
          <h3>No matches found</h3>
          <p>Try searching with different keywords or browse all public notebooks.</p>
          <button
            onClick={handleClearSearch}
            style={{
              marginTop: 'var(--space-md)',
              padding: 'var(--space-sm) var(--space-lg)',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Show All Notebooks
          </button>
        </div>
      )}

      {/* Help Text */}
      {!isLoading && publicNotebooks.length > 0 && (
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-2xl)',
          padding: 'var(--space-lg)',
          background: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-light)',
          color: 'var(--color-text-secondary)',
          fontSize: '0.9rem'
        }}>
          <p style={{ margin: 0 }}>
            <strong>💡 Tip:</strong> Like notebooks you find helpful! This helps others discover great content.
          </p>
        </div>
      )}
    </div>
  );
}

export default DiscoveryPage;