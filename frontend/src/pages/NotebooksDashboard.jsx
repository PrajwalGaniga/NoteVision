import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './NotebooksDashboard.css';
import ShareModal from './ShareModal';

function NotebooksDashboard({ darkMode }) {
  const [myNotebooks, setMyNotebooks] = useState([]);
  const [sharedNotebooks, setSharedNotebooks] = useState([]);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [message, setMessage] = useState('Loading your notebooks...');
  const token = localStorage.getItem('token');

  // State for Share Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState({ id: null, name: '' });

  // State for Tag Editing
  const [editingTagsId, setEditingTagsId] = useState(null);
  const [currentTags, setCurrentTags] = useState('');

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
      
      setMyNotebooks([...myNotebooks, notebookWithDefaults]);
      setNewNotebookName('');
      setMessage('🎉 Notebook created successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
      
    } catch (error) { 
      setMessage(`❌ Error: ${error.message}`); 
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
    <div className="dashboard-container" data-theme={darkMode ? 'dark' : 'light'}>
      <header className="dashboard-header">
        <h1>My Notebooks 📚</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>
          Organize your thoughts and collaborate with others
        </p>
      </header>

      {/* Create Notebook Form */}
      <div className="create-notebook-form">
        <form onSubmit={handleCreateNotebook}>
          <input 
            type="text" 
            value={newNotebookName} 
            onChange={(e) => setNewNotebookName(e.target.value)} 
            placeholder="Enter a name for your new notebook..." 
            required 
          />
          <button type="submit">Create Notebook</button>
        </form>
      </div>

      {message && <p className="message-text">{message}</p>}

      {/* Owned Notebooks Section */}
      <div className="notebook-section">
        <h2>📁 Your Notebooks ({myNotebooks.length})</h2>
        {myNotebooks.length > 0 ? (
          <div className="notebook-list">
            {myNotebooks.map((notebook) => (
              <div key={notebook._id} className="notebook-card owned">
                <h3>{notebook.name}</h3>
                <p>Created: {new Date(notebook.created_at).toLocaleDateString()}</p>

                {/* Tags Display/Edit UI */}
                <div className="tags-section">
                  {editingTagsId === notebook._id ? (
                    <div className="tags-edit-form">
                      <input 
                        type="text" 
                        value={currentTags} 
                        onChange={handleTagsInputChange} 
                        placeholder="Comma-separated tags (e.g., work, ideas, personal)" 
                        autoFocus
                      />
                      <div className="tags-edit-actions">
                        <button onClick={() => handleSaveTags(notebook._id)} className="save-tags-button">
                          Save
                        </button>
                        <button onClick={handleCancelEditTags} className="cancel-tags-button">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="tags-view">
                      <div className="tags-container">
                        {(notebook.tags && notebook.tags.length > 0) ? (
                          notebook.tags.map((tag, index) => (
                            <span key={index} className="tag">{tag}</span>
                          ))
                        ) : (
                          <span className="no-tags">No tags added</span>
                        )}
                      </div>
                      <button 
                        onClick={() => handleEditTagsClick(notebook)} 
                        className="edit-tags-button" 
                        title="Edit Tags"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </div>

                {/* Visibility Toggle UI */}
                <div className="visibility-control">
                  <span className={`status-indicator ${notebook.is_public ? 'public' : 'private'}`}>
                    {notebook.is_public ? '🌐 Public' : '🔒 Private'}
                  </span>
                  <button 
                    onClick={() => handleVisibilityToggle(notebook._id, notebook.is_public)} 
                    className="toggle-visibility-button" 
                    title={notebook.is_public ? 'Make Private' : 'Make Public'}
                  >
                    {notebook.is_public ? 'Make Private' : 'Make Public'}
                  </button>
                </div>

                {/* Card Actions */}
                <div className="card-actions">
                  <button 
                    onClick={() => handleDeleteNotebook(notebook._id, notebook.name)} 
                    className="delete-notebook-button" 
                    title="Delete this notebook"
                  >
                    🗑️ Delete
                  </button>
                  <Link to={`/notebook/${notebook._id}`} className="open-button">
                    📖 Open
                  </Link>
                  <button 
                    onClick={() => openShareModal(notebook._id, notebook.name)} 
                    className="share-button" 
                    title="Share this notebook"
                  >
                    🔗 Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !message.includes('Loading') && 
          !message.startsWith('Error') && 
          !message.includes('Creating') && 
          <p>You haven't created any notebooks yet. Start by creating one above! 🚀</p>
        )}
      </div>

      {/* Shared Notebooks Section */}
      <div className="notebook-section">
        <h2>👥 Shared With Me ({sharedNotebooks.length})</h2>
        {sharedNotebooks.length > 0 ? (
          <div className="notebook-list">
            {sharedNotebooks.map((notebook) => (
              <div key={notebook._id} className="notebook-card shared">
                <h3>{notebook.name}</h3>
                <p>Owner: {notebook.owner_email}</p>
                <p>Created: {new Date(notebook.created_at).toLocaleDateString()}</p>
                {(() => {
                  const currentUserEmail = localStorage.getItem('email');
                  const myPermissionEntry = notebook.access_list?.find(entry => entry.user_email === currentUserEmail);
                  const permissionText = myPermissionEntry?.permission === 'edit' ? '✏️ Can Edit' : '👁️ View Only';
                  return <p className="permission-tag">{permissionText}</p>;
                })()}
                <div className="card-actions">
                  <Link to={`/notebook/${notebook._id}`} className="open-button">
                    📖 Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !message.includes('Loading') && 
          !message.startsWith('Error') && 
          <p>No notebooks have been shared with you yet. Ask your colleagues to share their notebooks with you! 🤝</p>
        )}
      </div>

      {/* Render Share Modal conditionally */}
      {isShareModalOpen && (
        <ShareModal
          notebookId={selectedNotebook.id}
          notebookName={selectedNotebook.name}
          token={token}
          onClose={closeShareModal}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

export default NotebooksDashboard;