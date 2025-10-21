import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { FiSearch, FiX, FiEye, FiHeart, FiGlobe, FiTrendingUp } from 'react-icons/fi';
import { IoEarthOutline, IoFlameOutline } from 'react-icons/io5';
import './DiscoveryPage.css';

function DiscoveryPage({ darkMode }) {
  const [publicNotebooks, setPublicNotebooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Discover amazing public notebooks...');
  const [isLiking, setIsLiking] = useState({});
  const token = localStorage.getItem('token');
  const currentUserEmail = localStorage.getItem('email');

  // Animation springs
  const headerSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(-30px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 300, friction: 20 }
  });

  const searchSpring = useSpring({
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1 },
    delay: 200,
    config: { tension: 280, friction: 20 }
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
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

  const cardVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24
      }
    },
    hover: {
      scale: 1.02,
      y: -8,
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
    <motion.div 
      className="discovery-page-container" 
      data-theme={darkMode ? 'dark' : 'light'}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <animated.header className="discovery-header" style={headerSpring}>
        <motion.h1
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          Discover Public Notes <IoEarthOutline className="header-icon" />
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Explore and learn from notebooks shared by the community. 
          {publicNotebooks.length > 0 && ` Found ${publicNotebooks.length} notebook${publicNotebooks.length !== 1 ? 's' : ''}`}
        </motion.p>
      </animated.header>

      {/* Search Bar */}
      <animated.div className="discovery-search-bar" style={searchSpring}>
        <motion.div 
          className="input-container"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <FiSearch className="input-icon" />
          <input
            type="text"
            placeholder="Search by notebook name, tags, or topics..."
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={isLoading}
          />
          {searchTerm && (
            <motion.button
              onClick={handleClearSearch}
              className="clear-search-button"
              title="Clear search"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiX />
            </motion.button>
          )}
        </motion.div>
      </animated.div>

      {/* Messages */}
      <AnimatePresence>
        {message && (
          <motion.div 
            className={`discovery-message ${isLoading ? 'loading' : message.includes('Error') ? 'error' : ''}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Public Notebooks Grid */}
      <motion.div className="public-notebook-list" layout>
        <AnimatePresence mode="wait">
          {publicNotebooks.map((notebook, index) => {
            const isLiked = notebook.likes.includes(currentUserEmail);
            const likeCount = notebook.likes.length;
            const popularity = getPopularityIndicator(likeCount);
            
            return (
              <motion.div
                key={notebook._id}
                className="public-notebook-card"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                whileTap="tap"
                layout
                transition={{ delay: index * 0.1 }}
              >
                {/* Featured Badge for highly liked notebooks */}
                {likeCount >= 10 && (
                  <motion.div 
                    className="featured-badge"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <IoFlameOutline style={{ marginRight: '4px' }} />
                    Featured
                  </motion.div>
                )}
                
                <h3>
                  <FiGlobe style={{ color: 'var(--color-primary)' }} />
                  {notebook.name}
                </h3>
                
                <p className="owner-info">
                  <FiTrendingUp />
                  Shared by: {notebook.owner_email}
                </p>

                {/* Popularity Indicator */}
                <motion.div 
                  className={`popularity-indicator ${popularity}`}
                  whileHover={{ scale: 1.05 }}
                >
                  {likeCount} like{likeCount !== 1 ? 's' : ''}
                </motion.div>

                {/* Tags */}
                {notebook.tags && notebook.tags.length > 0 && (
                  <div className="tags-container">
                    {notebook.tags.map((tag, index) => (
                      <motion.span 
                        key={index} 
                        className="tag"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.1 }}
                      >
                        #{tag}
                      </motion.span>
                    ))}
                  </div>
                )}

                {/* Card Footer */}
                <div className="card-footer">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Link 
                      to={`/notebook/${notebook._id}`} 
                      className="open-public-button"
                      title={`View ${notebook.name}`}
                    >
                      <FiEye />
                      View Notes
                    </Link>
                  </motion.div>
                  
                  <motion.button
                    onClick={() => handleLikeToggle(notebook._id)}
                    className={`like-button ${isLiked ? 'liked' : ''}`}
                    title={isLiked ? 'Unlike this notebook' : 'Like this notebook'}
                    disabled={isLiking[notebook._id]}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FiHeart />
                    <span>{likeCount}</span>
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Empty State when no results */}
      <AnimatePresence>
        {!isLoading && publicNotebooks.length === 0 && searchTerm && (
          <motion.div 
            className="empty-state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <h3>No matches found</h3>
            <p>Try searching with different keywords or browse all public notebooks.</p>
            <motion.button
              onClick={handleClearSearch}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Show All Notebooks
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Text */}
      {!isLoading && publicNotebooks.length > 0 && (
        <motion.div 
          className="help-text"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p>
            <strong>💡 Tip:</strong> Like notebooks you find helpful! This helps others discover great content.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

export default DiscoveryPage;