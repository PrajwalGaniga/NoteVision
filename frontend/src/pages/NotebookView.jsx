// NotebookView.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { 
  FiArrowLeft, FiDownload, FiSearch, FiEdit3, 
  FiTrash2, FiSave, FiX, FiFileText, 
  FiEye, FiUpload, FiBook, FiCalendar,
  FiCheck, FiLoader
} from 'react-icons/fi';
import { IoDocumentTextOutline, IoSparklesOutline } from 'react-icons/io5';
import Uploader from '../Uploader';
import QuizView from './QuizView';
import './NotebookView.css';

function NotebookView({ darkMode }) {
  const { notebookId } = useParams();
  const token = localStorage.getItem('token');
  const currentUserEmail = localStorage.getItem('email');

  // --- State for Notebook Data ---
  const [notebookName, setNotebookName] = useState('Loading...');
  const [notes, setNotes] = useState([]);
  const [message, setMessage] = useState('');
  const [userPermission, setUserPermission] = useState('view');

  // --- State for UI ---
  const [isDownloading, setIsDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- State for Quiz ---
  const [quizData, setQuizData] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizMessage, setQuizMessage] = useState('');

  // --- State for Editing Notes ---
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Animation springs
  const headerSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(-20px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 300, friction: 20 }
  });

  const contentSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
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

  const noteCardVariants = {
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
      y: -4,
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

  // --- Fetch Notebook Details ---
  const fetchNotebookData = async () => {
    setMessage('Loading notebook...');
    console.log(`DEBUG: Fetching data for notebook: ${notebookId}`);
    setNotes([]);
    setUserPermission('view');
    
    try {
      if (!token || !notebookId) {
        throw new Error('Missing token or notebook ID.');
      }
      
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired. Please log in again.');
        if (response.status === 403) throw new Error('Access denied to this notebook.');
        if (response.status === 404) throw new Error('Notebook not found.');
        throw new Error('Could not fetch notebook data.');
      }

      const data = await response.json();
      setNotebookName(data.name);
      setNotes(data.notes || []);
      setMessage(data.notes && data.notes.length > 0 ? '' : 'No notes saved yet in this notebook.');

      // Determine User Permission
      if (data.owner_email === currentUserEmail) {
        setUserPermission('edit');
        console.log("DEBUG: User is owner (edit permission).");
      } else {
        const myAccess = data.access_list?.find(entry => entry.user_email === currentUserEmail);
        if (myAccess?.permission === 'edit') {
          setUserPermission('edit');
          console.log("DEBUG: User has shared edit permission.");
        } else {
          setUserPermission('view');
          console.log("DEBUG: User has view permission.");
        }
      }
      
      console.log('DEBUG: Received notebook data:', data);

    } catch (error) {
      console.error('ERROR fetching notebook data:', error);
      setMessage(`❌ Error: ${error.message}`);
      setNotebookName('Error loading notebook');
    }
  };

  // --- Handle PDF Download ---
  const handleDownloadPdf = async () => {
    setMessage('Generating PDF...');
    setIsDownloading(true);
    console.log(`DEBUG: Requesting PDF for notebook: ${notebookId}`);
    
    try {
      if (!token || !notebookId) { 
        throw new Error('Missing token or notebook ID.'); 
      }
      
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/pdf`, {
        method: 'GET', 
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired.');
        let errorDetail = response.statusText;
        try { 
          const errorData = await response.json(); 
          errorDetail = errorData.detail || errorDetail; 
        } catch (e) { /* Ignore */ }
        throw new Error(`PDF Generation Failed: ${errorDetail}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url;
      let filename = `${notebookName}_Notes.pdf`;
      const disposition = response.headers.get('content-disposition');
      
      if (disposition && disposition.includes('attachment')) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches?.[1]) { 
          filename = matches[1].replace(/['"]/g, ''); 
        }
      }
      
      a.download = filename;
      document.body.appendChild(a); 
      a.click(); 
      a.remove();
      window.URL.revokeObjectURL(url);
      setMessage('✅ PDF downloaded successfully!');
      console.log('DEBUG: PDF download triggered.');
      
    } catch (error) {
      console.error('ERROR downloading PDF:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Callback when Uploader saves a note ---
  const handleNoteSaved = (newNote) => {
    setNotes(prevNotes => [newNote, ...prevNotes]);
    setMessage('✅ Note added successfully!');
    setSearchTerm('');
  };

  // --- Quiz Generation and Completion Handlers ---
  const handleGenerateQuiz = async () => {
    setQuizMessage('Generating quiz...');
    setShowQuiz(false);
    setQuizData(null);
    console.log(`DEBUG: Requesting quiz for notebook: ${notebookId}`);
    
    try {
      if (!token || !notebookId) throw new Error('Missing token or notebook ID.');
      
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/quiz`, {
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        let errorDetail = response.statusText;
        try { 
          const errorData = await response.json(); 
          errorDetail = errorData.detail || errorDetail; 
        } catch (e) { /* Ignore */ }
        if (response.status === 401) errorDetail = 'Session expired.';
        if (response.status === 400 && errorDetail.includes('No notes')) errorDetail = 'Add some notes first!';
        throw new Error(`Quiz Generation Failed: ${errorDetail}`);
      }
      
      const data = await response.json();
      if (!data.questions || data.questions.length === 0) {
        throw new Error('AI returned an empty quiz. Try adding more notes.');
      }
      
      setQuizData(data);
      setShowQuiz(true);
      setQuizMessage('');
      console.log('DEBUG: Quiz data received:', data);
      
    } catch (error) {
      console.error('ERROR generating quiz:', error);
      setQuizMessage(`❌ Error: ${error.message}`);
      setShowQuiz(false); 
      setQuizData(null);
    }
  };

  const handleQuizComplete = () => {
    setShowQuiz(false);
    setQuizData(null);
    setQuizMessage('');
    setMessage('');
  };

  // --- Edit/Delete Note Handlers ---
  const handleEditClick = (note) => {
    setEditingNoteId(note._id);
    setEditingContent(note.content);
    setMessage(''); 
    setQuizMessage('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (noteId) => {
    if (!editingContent.trim()) {
      setMessage('Note content cannot be empty.'); 
      return;
    }
    
    setIsSaving(true);
    setMessage('Saving changes...');
    console.log(`DEBUG: Saving edit for note ${noteId}`);
    
    try {
      if (!token) throw new Error('Not logged in.');
      
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json', 
        },
        body: JSON.stringify({ content: editingContent.trim() }),
      });
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired.');
        if (response.status === 403) throw new Error('Permission denied to edit.');
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save edit.');
      }
      
      const updatedNote = await response.json();
      setNotes(prevNotes => prevNotes.map(n => (n._id === noteId ? updatedNote : n)));
      setMessage('✅ Note updated successfully!');
      setEditingNoteId(null); 
      setEditingContent('');
      console.log('DEBUG: Note updated:', updatedNote);
      
    } catch (error) {
      console.error("ERROR saving edit:", error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Are you sure you want to delete this note permanently?")) return;
    
    setMessage('Deleting note...');
    console.log(`DEBUG: Deleting note ${noteId}`);
    
    try {
      if (!token) throw new Error('Not logged in.');
      
      const response = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/notes/${noteId}`, {
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired.');
        if (response.status === 403) throw new Error('Permission denied to delete.');
        let errorDetail = `Failed to delete (Status: ${response.status})`;
        
        if (response.status !== 204) {
          try { 
            const errorData = await response.json(); 
            errorDetail = errorData.detail || errorDetail; 
          } catch(e) { /* Ignore if body isn't JSON */ }
        }
        throw new Error(errorDetail);
      }
      
      setNotes(prevNotes => prevNotes.filter(n => n._id !== noteId));
      setMessage('✅ Note deleted successfully!');
      console.log(`DEBUG: Note ${noteId} deleted.`);
      
      if (editingNoteId === noteId) handleCancelEdit();
      
    } catch (error) {
      console.error("ERROR deleting note:", error);
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  // --- Fetch Data on Initial Load ---
  useEffect(() => {
    fetchNotebookData();
  }, [notebookId]);

  // --- Calculate Filtered Notes ---
  const filteredNotes = notes.filter(note =>
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Component Render ---
  return (
    <motion.div 
      className="notebook-view-container"
      data-theme={darkMode ? 'dark' : 'light'}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Navigation Bar */}
      <animated.nav className="notebook-nav" style={headerSpring}>
        <motion.div
          whileHover={{ x: -5 }}
          whileTap={{ scale: 0.95 }}
        >
          <Link to="/" className="nav-back-link">
            <FiArrowLeft className="nav-icon" />
            Back to All Notebooks
          </Link>
        </motion.div>
        
        <motion.button
          onClick={handleDownloadPdf}
          disabled={isDownloading || notes.length === 0 || showQuiz}
          className="pdf-button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          {isDownloading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <FiLoader />
            </motion.div>
          ) : (
            <>
              <FiDownload className="button-icon" />
              Download PDF
            </>
          )}
        </motion.button>
      </animated.nav>

      {/* --- Conditional Rendering: Quiz or Uploader/Notes --- */}
      <AnimatePresence mode="wait">
        {showQuiz && quizData ? (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <QuizView quizData={quizData} onQuizComplete={handleQuizComplete} darkMode={darkMode} />
          </motion.div>
        ) : (
          <animated.div key="notes" style={contentSpring}>
            {/* Show Uploader only if user has edit permission */}
            {userPermission === 'edit' && (
              <Uploader 
                key={notebookId} 
                notebookId={notebookId} 
                onNoteSaved={handleNoteSaved} 
                darkMode={darkMode}
              />
            )}
            
            {/* Show message if user cannot upload */}
            {userPermission === 'view' && !showQuiz && (
              <motion.div 
                className="view-only-message"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <FiEye className="message-icon" />
                You have view-only access. You cannot add, edit, or delete notes.
              </motion.div>
            )}

            {/* Saved Notes Section */}
            <motion.div 
              className="notes-list-section"
              variants={itemVariants}
            >
              <div className="notes-header">
                <motion.h2 
                  className="notebook-title"
                  whileHover={{ scale: 1.02 }}
                >
                  <FiBook className="title-icon" />
                  Notes in "{notebookName}"
                  {notes.length > 0 && (
                    <motion.span 
                      className="notes-count"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      {filteredNotes.length}/{notes.length}
                    </motion.span>
                  )}
                </motion.h2>
                
                {/* Show Quiz button only if user has view/edit permission and notes exist */}
                {userPermission !== 'none' && notes.length > 0 && (
                  <motion.button
                    onClick={handleGenerateQuiz}
                    disabled={showQuiz || quizMessage.includes('Generating')}
                    className="quiz-generate-button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    {quizMessage.includes('Generating') ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <FiLoader />
                      </motion.div>
                    ) : (
                      <>
                        <IoSparklesOutline className="button-icon" />
                        Generate Quiz
                      </>
                    )}
                  </motion.button>
                )}
              </div>

              {/* Search Bar - only show if there are notes */}
              {notes.length > 0 && (
                <motion.div 
                  className="search-notes-bar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="search-container">
                    <FiSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search through your notes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <motion.button
                        onClick={() => setSearchTerm('')}
                        className="clear-search"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <FiX />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Status Messages */}
              <AnimatePresence>
                {(quizMessage || message) && (
                  <motion.div 
                    className={`notes-message ${
                      (quizMessage && quizMessage.startsWith('❌')) || 
                      (message && message.startsWith('❌')) ? 'error' : 
                      message.startsWith('✅') ? 'success' : ''
                    }`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {quizMessage || message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notes Grid Display */}
              {notes.length > 0 ? (
                filteredNotes.length > 0 ? (
                  <motion.div 
                    className="notes-grid"
                    layout
                  >
                    {filteredNotes.map((note, index) => (
                      <motion.div
                        key={note._id}
                        className={`note-card ${editingNoteId === note._id ? 'editing' : ''}`}
                        variants={noteCardVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover="hover"
                        whileTap="tap"
                        layout
                        transition={{ delay: index * 0.1 }}
                      >
                        {/* --- Conditional Editing UI --- */}
                        {editingNoteId === note._id ? (
                          // --- Edit Mode ---
                          <motion.div 
                            className="note-edit-form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              rows="8"
                              placeholder="Edit your note content..."
                              className="edit-textarea"
                            />
                            <div className="edit-actions">
                              <motion.button 
                                onClick={() => handleSaveEdit(note._id)} 
                                className="save-button"
                                disabled={isSaving}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {isSaving ? (
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  >
                                    <FiLoader />
                                  </motion.div>
                                ) : (
                                  <>
                                    <FiSave className="button-icon" />
                                    Save
                                  </>
                                )}
                              </motion.button>
                              <motion.button 
                                onClick={handleCancelEdit} 
                                className="cancel-button"
                                disabled={isSaving}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <FiX className="button-icon" />
                                Cancel
                              </motion.button>
                            </div>
                          </motion.div>
                        ) : (
                          // --- View Mode ---
                          <>
                            <pre className="note-content">{note.content}</pre>
                            <div className="note-footer">
                              <motion.p 
                                className="note-date"
                                whileHover={{ scale: 1.05 }}
                              >
                                <FiCalendar className="date-icon" />
                                {new Date(note.created_at).toLocaleString()}
                              </motion.p>
                              {/* Show Edit/Delete only if user has edit permission */}
                              {userPermission === 'edit' && (
                                <motion.div 
                                  className="note-actions"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.2 }}
                                >
                                  <motion.button 
                                    onClick={() => handleEditClick(note)} 
                                    className="edit-button" 
                                    title="Edit Note"
                                    whileHover={{ scale: 1.2, rotate: 15 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <FiEdit3 />
                                  </motion.button>
                                  <motion.button 
                                    onClick={() => handleDeleteNote(note._id)} 
                                    className="delete-button" 
                                    title="Delete Note"
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <FiTrash2 />
                                  </motion.button>
                                </motion.div>
                              )}
                            </div>
                          </>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  // Show message if search found nothing, but notes exist
                  <motion.div 
                    className="search-empty-state"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <FiSearch className="empty-icon" />
                    <h3>No matching notes</h3>
                    <p>No notes found for "{searchTerm}"</p>
                    <motion.button
                      onClick={() => setSearchTerm('')}
                      className="clear-search-button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Clear Search
                    </motion.button>
                  </motion.div>
                )
              ) : (
                // Show message if there are no notes at all and not currently loading
                !message.includes('Loading') && (
                  <motion.div 
                    className="empty-state"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <IoDocumentTextOutline className="empty-icon" />
                    <h3>No notes yet</h3>
                    <p>
                      {userPermission === 'edit' 
                        ? 'Start by uploading a file or creating your first note!' 
                        : 'This notebook is empty. Check back later for updates.'
                      }
                    </p>
                    {userPermission === 'edit' && (
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ marginTop: 'var(--space-md)' }}
                      >
                        <FiUpload className="upload-hint" />
                      </motion.div>
                    )}
                  </motion.div>
                )
              )}
            </motion.div>
          </animated.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default NotebookView;