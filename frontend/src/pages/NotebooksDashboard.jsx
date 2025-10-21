// NotebooksDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { 
  FiPlus, FiBook, FiUsers, FiLock, FiUnlock, 
  FiTrash2, FiShare2, FiTag, FiEdit3, 
  FiFolder, FiFolderPlus, FiUser 
} from 'react-icons/fi';
import { IoBookOutline, IoPeopleOutline } from 'react-icons/io5';
import './NotebooksDashboard.css';
import ShareModal from './ShareModal';

function NotebooksDashboard({ darkMode }) {
  const [myNotebooks, setMyNotebooks] = useState([]);
  const [sharedNotebooks, setSharedNotebooks] = useState([]);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [message, setMessage] = useState('Loading your notebooks...');
  const [isCreating, setIsCreating] = useState(false);
  const token = localStorage.getItem('token');

  // State for Share Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState({ id: null, name: '' });

  // State for Tag Editing
  const [editingTagsId, setEditingTagsId] = useState(null);
  const [currentTags, setCurrentTags] = useState('');

  // Animation springs
  const headerSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(-30px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 300, friction: 20 }
  });

  const formSpring = useSpring({
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

  // Fetch both owned and shared notebooks
  const fetchData = async () => {
    console.log('DEBUG: Fetching owned and shared notebooks...');
    setMessage('Loading notebooks...');
    setMyNotebooks([]);
    setSharedNotebooks([]);

    try {
      const [ownedResponse, sharedResponse] = await Promise.all([
        fetch('http://127.0.0.1:8000/notebooks', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        }),
        fetch('http://127.0.0.1:8000/notebooks/shared', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        })
      ]);

      if (ownedResponse.ok) {
        const ownedData = await ownedResponse.json();
        setMyNotebooks(ownedData);
        console.log('DEBUG: Found owned notebooks:', ownedData);
      } else {
        console.error("Error fetching owned notebooks:", ownedResponse.statusText);
      }

      if (sharedResponse.ok) {
        const sharedData = await sharedResponse.json();
        setSharedNotebooks(sharedData);
        console.log('DEBUG: Found shared notebooks:', sharedData);
      } else {
        console.error("Error fetching shared notebooks:", sharedResponse.statusText);
      }
      setMessage('');

    } catch (error) {
      console.error('ERROR fetching dashboard data:', error);
      setMessage(`Error loading data: ${error.message}. Please try logging in again.`);
    }
  };

  // Create a new notebook
  const handleCreateNotebook = async (e) => {
    e.preventDefault();
    if (!newNotebookName.trim()) { 
      setMessage('Please enter a notebook name.'); 
      return; 
    }
    
    setIsCreating(true);
    setMessage('Creating notebook...');
    try {
      const response = await fetch('http://127.0.0.1:8000/notebooks', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ name: newNotebookName.trim() }),
      });
      
      if (!response.ok) {
        const errorData = await response.json(); 
        throw new Error(errorData.detail || 'Could not create notebook.');
      }
      
      const newNotebook = await response.json();
      const notebookWithDefaults = { 
        ...newNotebook, 
        is_public: newNotebook.is_public ?? false, 
        tags: newNotebook.tags ?? [], 
        likes: newNotebook.likes ?? [] 
      };
      
      setMyNotebooks([notebookWithDefaults, ...myNotebooks]);
      setNewNotebookName('');
      setMessage('🎉 Notebook created successfully!');
      setIsCreating(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
      
    } catch (error) { 
      setMessage(`❌ Error: ${error.message}`);
      setIsCreating(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => { 
    fetchData(); 
  }, [token]);

  // Share Modal Handlers
  const openShareModal = (notebookId, notebookName) => { 
    setSelectedNotebook({ id: notebookId, name: notebookName }); 
    setIsShareModalOpen(true); 
  };
  
  const closeShareModal = () => { 
    setIsShareModalOpen(false); 
    setSelectedNotebook({ id: null, name: '' }); 
  };

  // Visibility Toggle Handler
  const handleVisibilityToggle = async (notebookId, currentStatus) => {
    const newStatus = !currentStatus;
    const notebookName = myNotebooks.find(nb => nb._id === notebookId)?.name || 'Notebook';
    console.log(`DEBUG: Toggling visibility for ${notebookId} to ${newStatus}`);
    setMessage(`Updating visibility for "${notebookName}"...`);
    
    // Optimistic Update
    setMyNotebooks(prev => prev.map(nb => 
      nb._id === notebookId ? { ...nb, is_public: newStatus } : nb
    ));
    
    try {
      if (!token) throw new Error('Not logged in.');
      
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/visibility`, {
        method: 'PATCH', 
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json', 
        },
        body: JSON.stringify({ is_public: newStatus }),
      });
      
      if (!response.ok) {
        // Revert on Error
        setMyNotebooks(prev => prev.map(nb => 
          nb._id === notebookId ? { ...nb, is_public: currentStatus } : nb
        ));
        if (response.status === 401) throw new Error('Session expired.');
        const errorData = await response.json(); 
        throw new Error(errorData.detail || 'Failed to update visibility.');
      }
      
      const updatedNotebookData = await response.json();
      setMyNotebooks(prev => prev.map(nb => 
        nb._id === notebookId ? updatedNotebookData : nb
      ));
      setMessage(`✅ Visibility for "${notebookName}" updated to ${newStatus ? 'Public' : 'Private'}.`);
      
    } catch (error) {
      console.error('ERROR updating visibility:', error);
      setMessage(`❌ Error: ${error.message}`);
      // Ensure revert on fetch failure
      setMyNotebooks(prev => prev.map(nb => 
        nb._id === notebookId ? { ...nb, is_public: currentStatus } : nb
      ));
    }
  };

  // Delete Notebook Handler
  const handleDeleteNotebook = async (notebookId, notebookName) => {
    if (!window.confirm(`Are you sure you want to permanently delete the notebook "${notebookName}" and all its notes? This action cannot be undone.`)) return;
    
    setMessage(`Deleting notebook "${notebookName}"...`);
    console.log(`DEBUG: Deleting notebook ${notebookId}`);
    
    try {
      if (!token) throw new Error('Not logged in.');
      
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}`, {
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok && response.status !== 204) {
        if (response.status === 401) throw new Error('Session expired.');
        if (response.status === 403) throw new Error('Permission denied to delete this notebook.');
        let errorDetail = `Failed to delete (Status: ${response.status})`;
        try { 
          const errorData = await response.json(); 
          errorDetail = errorData.detail || errorDetail; 
        } catch (e) { /* Ignore */ }
        throw new Error(errorDetail);
      }
      
      // Success
      setMyNotebooks(prevNotebooks => prevNotebooks.filter(nb => nb._id !== notebookId));
      setMessage(`✅ Notebook "${notebookName}" deleted successfully!`);
      console.log(`DEBUG: Notebook ${notebookId} deleted.`);
      
    } catch (error) {
      console.error("ERROR deleting notebook:", error);
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  // Tag Editing Handlers
  const handleEditTagsClick = (notebook) => { 
    setEditingTagsId(notebook._id); 
    setCurrentTags((notebook.tags || []).join(', ')); 
  };
  
  const handleTagsInputChange = (e) => { 
    setCurrentTags(e.target.value); 
  };
  
  const handleCancelEditTags = () => { 
    setEditingTagsId(null); 
    setCurrentTags(''); 
  };
  
  const handleSaveTags = async (notebookId) => {
    const tagsArray = [...new Set(currentTags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''))].sort();
    const notebookName = myNotebooks.find(nb => nb._id === notebookId)?.name || 'Notebook';
    console.log(`DEBUG: Saving tags for ${notebookId}:`, tagsArray);
    setMessage(`Saving tags for "${notebookName}"...`);
    
    // Optimistic Update
    const originalTags = myNotebooks.find(nb => nb._id === notebookId)?.tags || [];
    setMyNotebooks(prev => prev.map(nb => 
      nb._id === notebookId ? { ...nb, tags: tagsArray } : nb
    ));
    setEditingTagsId(null);
    
    try {
      if (!token) throw new Error('Not logged in.');
      
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/tags`, {
        method: 'PATCH', 
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json', 
        },
        body: JSON.stringify({ tags: tagsArray }),
      });
      
      if (!response.ok) {
        // Revert Optimistic Update
        setMyNotebooks(prev => prev.map(nb => 
          nb._id === notebookId ? { ...nb, tags: originalTags } : nb
        ));
        setEditingTagsId(notebookId);
        if (response.status === 401) throw new Error('Session expired.');
        const errorData = await response.json(); 
        throw new Error(errorData.detail || 'Failed to save tags.');
      }
      
      const updatedNotebookData = await response.json();
      setMyNotebooks(prev => prev.map(nb => 
        nb._id === notebookId ? updatedNotebookData : nb
      ));
      setMessage('✅ Tags updated successfully!');
      console.log(`DEBUG: Tags saved successfully for ${notebookId}`);
      
    } catch (error) {
      console.error('ERROR saving tags:', error);
      setMessage(`❌ Error: ${error.message}`);
      // Ensure revert on fetch failure
      setMyNotebooks(prev => prev.map(nb => 
        nb._id === notebookId ? { ...nb, tags: originalTags } : nb
      ));
      setEditingTagsId(notebookId);
    }
  };

  return (
    <motion.div 
      className="dashboard-container"
      data-theme={darkMode ? 'dark' : 'light'}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <animated.header className="dashboard-header" style={headerSpring}>
        <motion.h1
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          My Notebooks <IoBookOutline className="header-icon" />
        </motion.h1>
        <motion.p 
          className="dashboard-subtitle"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Organize your thoughts and collaborate with others
        </motion.p>
      </animated.header>

      {/* Create Notebook Form */}
      <animated.div className="create-notebook-form" style={formSpring}>
        <motion.form 
          onSubmit={handleCreateNotebook}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <div className="input-container">
            <FiFolderPlus className="input-icon" />
            <input 
              type="text" 
              value={newNotebookName} 
              onChange={(e) => setNewNotebookName(e.target.value)} 
              placeholder="Enter a name for your new notebook..." 
              required 
            />
          </div>
          <motion.button 
            type="submit" 
            className="create-button"
            disabled={isCreating}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            {isCreating ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <FiPlus />
              </motion.div>
            ) : (
              <>
                <FiPlus className="button-icon" />
                Create Notebook
              </>
            )}
          </motion.button>
        </motion.form>
      </animated.div>

      {/* Message Display */}
      <AnimatePresence>
        {message && (
          <motion.p 
            className="message-text"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Owned Notebooks Section */}
      <motion.section className="notebook-section" variants={itemVariants}>
        <motion.h2 
          className="section-title"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <FiFolder className="section-icon" />
          Your Notebooks ({myNotebooks.length})
        </motion.h2>
        
        <AnimatePresence mode="wait">
          {myNotebooks.length > 0 ? (
            <motion.div 
              className="notebook-list"
              layout
            >
              {myNotebooks.map((notebook, index) => (
                <motion.div
                  key={notebook._id}
                  className="notebook-card owned"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  whileTap="tap"
                  layout
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Notebook Header */}
                  <div className="notebook-header">
                    <h3>
                      <FiBook className="notebook-icon" />
                      {notebook.name}
                    </h3>
                    <motion.span 
                      className="date-badge"
                      whileHover={{ scale: 1.1 }}
                    >
                      {new Date(notebook.created_at).toLocaleDateString()}
                    </motion.span>
                  </div>

                  {/* Tags Display/Edit UI */}
                  <div className="tags-section">
                    {editingTagsId === notebook._id ? (
                      <motion.div 
                        className="tags-edit-form"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="input-container">
                          <FiTag className="input-icon" />
                          <input 
                            type="text" 
                            value={currentTags} 
                            onChange={handleTagsInputChange} 
                            placeholder="Comma-separated tags (e.g., work, ideas, personal)" 
                            autoFocus
                          />
                        </div>
                        <div className="tags-edit-actions">
                          <motion.button 
                            onClick={() => handleSaveTags(notebook._id)} 
                            className="save-tags-button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Save
                          </motion.button>
                          <motion.button 
                            onClick={handleCancelEditTags} 
                            className="cancel-tags-button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Cancel
                          </motion.button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="tags-view">
                        <div className="tags-container">
                          {(notebook.tags && notebook.tags.length > 0) ? (
                            notebook.tags.map((tag, index) => (
                              <motion.span 
                                key={index} 
                                className="tag"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ scale: 1.1 }}
                              >
                                {tag}
                              </motion.span>
                            ))
                          ) : (
                            <span className="no-tags">No tags added</span>
                          )}
                        </div>
                        <motion.button 
                          onClick={() => handleEditTagsClick(notebook)} 
                          className="edit-tags-button" 
                          title="Edit Tags"
                          whileHover={{ scale: 1.1, rotate: 15 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FiEdit3 />
                        </motion.button>
                      </div>
                    )}
                  </div>

                  {/* Visibility Toggle UI */}
                  <motion.div 
                    className="visibility-control"
                    whileHover={{ scale: 1.02 }}
                  >
                    <span className={`status-indicator ${notebook.is_public ? 'public' : 'private'}`}>
                      {notebook.is_public ? <FiUnlock /> : <FiLock />}
                      {notebook.is_public ? 'Public' : 'Private'}
                    </span>
                    <motion.button 
                      onClick={() => handleVisibilityToggle(notebook._id, notebook.is_public)} 
                      className="toggle-visibility-button" 
                      title={notebook.is_public ? 'Make Private' : 'Make Public'}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {notebook.is_public ? 'Make Private' : 'Make Public'}
                    </motion.button>
                  </motion.div>

                  {/* Card Actions */}
                  <div className="card-actions">
                    <motion.button 
                      onClick={() => handleDeleteNotebook(notebook._id, notebook.name)} 
                      className="delete-notebook-button" 
                      title="Delete this notebook"
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FiTrash2 />
                      Delete
                    </motion.button>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Link to={`/notebook/${notebook._id}`} className="open-button">
                        <FiBook />
                        Open
                      </Link>
                    </motion.div>
                    <motion.button 
                      onClick={() => openShareModal(notebook._id, notebook.name)} 
                      className="share-button" 
                      title="Share this notebook"
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FiShare2 />
                      Share
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            !message.includes('Loading') && 
            !message.startsWith('Error') && 
            !message.includes('Creating') && (
              <motion.div 
                className="empty-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <FiFolder className="empty-icon" />
                <h3>No notebooks yet</h3>
                <p>Start by creating your first notebook above! 🚀</p>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </motion.section>

      {/* Shared Notebooks Section */}
      <motion.section className="notebook-section" variants={itemVariants}>
        <motion.h2 
          className="section-title"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <IoPeopleOutline className="section-icon" />
          Shared With Me ({sharedNotebooks.length})
        </motion.h2>
        
        <AnimatePresence mode="wait">
          {sharedNotebooks.length > 0 ? (
            <motion.div 
              className="notebook-list"
              layout
            >
              {sharedNotebooks.map((notebook, index) => (
                <motion.div
                  key={notebook._id}
                  className="notebook-card shared"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  whileTap="tap"
                  layout
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="notebook-header">
                    <h3>
                      <FiBook className="notebook-icon" />
                      {notebook.name}
                    </h3>
                    <motion.span 
                      className="date-badge"
                      whileHover={{ scale: 1.1 }}
                    >
                      {new Date(notebook.created_at).toLocaleDateString()}
                    </motion.span>
                  </div>

                  <div className="notebook-meta">
                    <p>
                      <FiUser className="meta-icon" />
                      Owner: {notebook.owner_email}
                    </p>
                    {(() => {
                      const currentUserEmail = localStorage.getItem('email');
                      const myPermissionEntry = notebook.access_list?.find(entry => entry.user_email === currentUserEmail);
                      const permissionText = myPermissionEntry?.permission === 'edit' ? '✏️ Can Edit' : '👁️ View Only';
                      return (
                        <motion.p 
                          className="permission-tag"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          whileHover={{ scale: 1.05 }}
                        >
                          {permissionText}
                        </motion.p>
                      );
                    })()}
                  </div>

                  <div className="card-actions">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Link to={`/notebook/${notebook._id}`} className="open-button">
                        <FiBook />
                        Open
                      </Link>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            !message.includes('Loading') && 
            !message.startsWith('Error') && (
              <motion.div 
                className="empty-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <FiUsers className="empty-icon" />
                <h3>No shared notebooks</h3>
                <p>Ask your colleagues to share their notebooks with you! 🤝</p>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </motion.section>

      {/* Render Share Modal conditionally */}
      <AnimatePresence>
        {isShareModalOpen && (
          <ShareModal
            notebookId={selectedNotebook.id}
            notebookName={selectedNotebook.name}
            token={token}
            onClose={closeShareModal}
            darkMode={darkMode}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default NotebooksDashboard;