import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { FiCalendar, FiFileText, FiClock, FiBook, FiInfo } from 'react-icons/fi';
import { IoCalendarOutline, IoTodayOutline } from 'react-icons/io5';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './CalendarPage.css';

function CalendarPage({ darkMode }) {
  const [noteDates, setNoteDates] = useState(new Set());
  const [message, setMessage] = useState('Loading your notes calendar...');
  const [selectedDate, setSelectedDate] = useState(null);
  const [notesForDay, setNotesForDay] = useState([]);
  const [dayMessage, setDayMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem('token');

  // Animation springs
  const headerSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(-30px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 300, friction: 20 }
  });

  const contentSpring = useSpring({
    from: { opacity: 0, scale: 0.95 },
    to: { opacity: 1, scale: 1 },
    delay: 300,
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

  const noteVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24
      }
    },
    hover: {
      x: 5,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10
      }
    }
  };

  // Fetch the dates with notes
  useEffect(() => {
    const fetchDates = async () => {
      setIsLoading(true);
      setMessage('Loading your notes calendar...');
      setNoteDates(new Set());
      console.log('DEBUG: Fetching note dates for calendar...');
      
      try {
        if (!token) throw new Error('Not logged in.');

        const response = await fetch('http://127.0.0.1:8000/notes/dates', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 401) throw new Error('Session expired.');
          throw new Error('Could not fetch note dates.');
        }

        const datesArray = await response.json();
        setNoteDates(new Set(datesArray));
        setMessage(datesArray.length > 0 ? '' : 'No notes found in your notebooks.');
        console.log('DEBUG: Received note dates:', datesArray);

      } catch (error) {
        console.error('ERROR fetching note dates:', error);
        setMessage(`❌ Error: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDates();
  }, [token]);

  // Function to add custom styling
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dateString = date.toISOString().split('T')[0];
      const classes = [];
      
      if (noteDates.has(dateString)) {
        classes.push('day-with-notes');
      }
      
      // Highlight today
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        classes.push('react-calendar__tile--now');
      }
      
      return classes.join(' ');
    }
    return null;
  };

  // Function to fetch notes for the clicked day
  const fetchNotesForDate = async (date) => {
    const dateString = date.toISOString().split('T')[0];
    setSelectedDate(date);
    setNotesForDay([]);
    setDayMessage('Loading notes for this day...');
    console.log(`DEBUG: Fetching notes for date: ${dateString}`);

    // Only fetch if the date actually has notes
    if (!noteDates.has(dateString)) {
      setDayMessage('No notes were saved on this day.');
      return;
    }

    try {
      if (!token) throw new Error('Not logged in.');

      const response = await fetch(`http://127.0.0.1:8000/notes/by-date/${dateString}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired.');
        throw new Error('Could not fetch notes for this date.');
      }

      const notesData = await response.json();
      setNotesForDay(notesData);
      setDayMessage(notesData.length > 0 ? '' : 'No detailed notes found for this day.');
      console.log(`DEBUG: Received ${notesData.length} notes for ${dateString}:`, notesData);

    } catch (error) {
      console.error('ERROR fetching notes for day:', error);
      setDayMessage(`❌ Error: ${error.message}`);
    }
  };

  // Handle clicking a day
  const handleDateClick = (value, event) => {
    fetchNotesForDate(value);
  };

  // Format date for display
  const formatSelectedDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Handle note click
  const handleNoteClick = (note) => {
    console.log('Note clicked:', note);
    // TODO: Implement navigation to the specific note or notebook
  };

  return (
    <motion.div 
      className="calendar-page-container" 
      data-theme={darkMode ? 'dark' : 'light'}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <animated.header className="calendar-header" style={headerSpring}>
        <motion.h1
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          Notes Calendar <IoCalendarOutline className="header-icon" />
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {noteDates.size > 0 
            ? `You have notes on ${noteDates.size} days. Click any highlighted day to view your notes.`
            : 'Your notes calendar will show highlighted days when you create notes.'
          }
        </motion.p>
      </animated.header>

      {/* General loading/error message */}
      <AnimatePresence>
        {message && (
          <motion.p 
            className={`calendar-message ${message.includes('Error') ? 'error' : ''}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Calendar Content */}
      <animated.div className="calendar-content-wrapper" style={contentSpring}>
        <motion.div 
          className={`calendar-wrapper ${isLoading ? 'calendar-loading' : ''}`}
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
        >
          <Calendar
            onClickDay={handleDateClick}
            tileClassName={tileClassName}
            className="react-calendar"
            showNeighboringMonth={true}
            minDetail="month"
            maxDetail="month"
            navigationLabel={({ date }) => 
              date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            }
          />
        </motion.div>

        {/* Notes Section for Selected Day */}
        <motion.div 
          className="day-notes-section"
          variants={itemVariants}
          whileHover={{ scale: 1.01 }}
        >
          {selectedDate ? (
            <>
              <motion.h3
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <IoTodayOutline />
                Notes for {formatSelectedDate(selectedDate)}
              </motion.h3>
              
              <AnimatePresence mode="wait">
                {dayMessage ? (
                  <motion.div 
                    className="day-notes-message"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key="message"
                  >
                    {dayMessage}
                  </motion.div>
                ) : notesForDay.length > 0 ? (
                  <motion.ul 
                    className="day-notes-list"
                    initial="hidden"
                    animate="visible"
                    key="notes-list"
                  >
                    {notesForDay.map((note, index) => (
                      <motion.li 
                        key={note._id} 
                        className="day-note-item"
                        variants={noteVariants}
                        whileHover="hover"
                        onClick={() => handleNoteClick(note)}
                        title="Click to view note (coming soon)"
                        transition={{ delay: index * 0.1 }}
                      >
                        <p className="day-note-preview">
                          <FiFileText style={{ marginRight: '8px', opacity: 0.7 }} />
                          {note.content.substring(0, 100)}
                          {note.content.length > 100 ? '...' : ''}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)' }}>
                          <motion.span 
                            className="day-note-time"
                            whileHover={{ scale: 1.05 }}
                          >
                            <FiClock style={{ marginRight: '4px' }} />
                            {new Date(note.created_at).toLocaleTimeString([], { 
                              hour: 'numeric', 
                              minute: '2-digit' 
                            })}
                          </motion.span>
                          {note.notebook_name && (
                            <motion.span 
                              className="day-note-notebook" 
                              title="Notebook"
                              whileHover={{ scale: 1.05 }}
                            >
                              <FiBook style={{ marginRight: '4px' }} />
                              {note.notebook_name}
                            </motion.span>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  <motion.div 
                    className="day-notes-empty"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    key="empty"
                  >
                    <p>No notes found for this day</p>
                    <p style={{ fontSize: '0.9rem', marginTop: 'var(--space-sm)', opacity: 0.7 }}>
                      Try clicking a highlighted date
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <motion.div 
              className="day-notes-empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <p>Select a date to view notes</p>
              <p style={{ fontSize: '0.9rem', marginTop: 'var(--space-sm)', opacity: 0.7 }}>
                Days with notes are highlighted in green
              </p>
            </motion.div>
          )}
        </motion.div>
      </animated.div>

      {/* Help text */}
      <AnimatePresence>
        {!isLoading && noteDates.size === 0 && !message && (
          <motion.div 
            className="help-text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.5 }}
          >
            <p>
              <FiInfo style={{ marginRight: '8px' }} />
              <strong>Tip:</strong> Create notes in your notebooks to see them appear here on your calendar!
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default CalendarPage;