import React, { useState, useEffect } from 'react';
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

  // Handle note click (could navigate to notebook)
  const handleNoteClick = (note) => {
    console.log('Note clicked:', note);
    // TODO: Implement navigation to the specific note or notebook
    // For now, just log the click
  };

  return (
    <div className="calendar-page-container" data-theme={darkMode ? 'dark' : 'light'}>
      <header className="calendar-header">
        <h1>Notes Calendar 🗓️</h1>
        <p>
          {noteDates.size > 0 
            ? `You have notes on ${noteDates.size} days. Click any highlighted day to view your notes.`
            : 'Your notes calendar will show highlighted days when you create notes.'
          }
        </p>
      </header>

      {/* General loading/error message */}
      {message && (
        <p className={`calendar-message ${message.includes('Error') ? 'error' : ''}`}>
          {message}
        </p>
      )}

      <div className="calendar-content-wrapper">
        <div className={`calendar-wrapper ${isLoading ? 'calendar-loading' : ''}`}>
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
        </div>

        {/* Notes Section for Selected Day */}
        <div className="day-notes-section">
          {selectedDate ? (
            <>
              <h3>Notes for {formatSelectedDate(selectedDate)}</h3>
              
              {dayMessage ? (
                <div className="day-notes-message">
                  {dayMessage}
                </div>
              ) : notesForDay.length > 0 ? (
                <ul className="day-notes-list">
                  {notesForDay.map(note => (
                    <li 
                      key={note._id} 
                      className="day-note-item"
                      onClick={() => handleNoteClick(note)}
                      title="Click to view note (coming soon)"
                    >
                      <p className="day-note-preview">
                        {note.content.substring(0, 100)}
                        {note.content.length > 100 ? '...' : ''}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="day-note-time">
                          {new Date(note.created_at).toLocaleTimeString([], { 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                        </span>
                        {note.notebook_name && (
                          <span className="day-note-notebook" title="Notebook">
                            {note.notebook_name}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="day-notes-empty">
                  <p>No notes found for this day</p>
                  <p style={{ fontSize: '0.9rem', marginTop: 'var(--space-sm)', opacity: 0.7 }}>
                    Try clicking a highlighted date
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="day-notes-empty">
              <p>Select a date to view notes</p>
              <p style={{ fontSize: '0.9rem', marginTop: 'var(--space-sm)', opacity: 0.7 }}>
                Days with notes are highlighted in green
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Help text */}
      {!isLoading && noteDates.size === 0 && !message && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: 'var(--space-2xl)', 
          padding: 'var(--space-lg)',
          background: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-lg)',
          border: '2px dashed var(--color-border-light)'
        }}>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            <strong>💡 Tip:</strong> Create notes in your notebooks to see them appear here on your calendar!
          </p>
        </div>
      )}
    </div>
  );
}

export default CalendarPage;