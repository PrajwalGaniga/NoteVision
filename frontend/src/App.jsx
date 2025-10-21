// App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import NotebooksDashboard from './pages/NotebooksDashboard';
import NotebookView from './pages/NotebookView';
import CalendarPage from './pages/CalendarPage';
import DiscoveryPage from './pages/DiscoveryPage';
import ProfilePage from './pages/ProfilePage';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

// --- Layout Component with Dark Mode Toggle ---
function Layout({ userName, userEmail, onLogout, darkMode, onToggleDarkMode }) {
  return (
    <div>
      <nav className="main-nav">
        <Link to="/" className="nav-link">Dashboard</Link>
        <Link to="/calendar" className="nav-link">Calendar</Link>
        <Link to="/discover" className="nav-link">Discover</Link>
        <Link to="/profile" className="nav-link">Profile</Link>
        
        {/* Dark Mode Toggle */}
        <button 
          onClick={onToggleDarkMode}
          className="theme-toggle"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        
        <span className="user-display">
          Welcome, {userName || userEmail}!
        </span>
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </nav>
    </div>
  );
}

// --- Main App Component ---
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [email, setEmail] = useState(localStorage.getItem('email'));
  const [name, setName] = useState(localStorage.getItem('name'));
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check if user has a theme preference in localStorage
    const savedTheme = localStorage.getItem('theme');
    // Also check system preference as fallback
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const navigate = useNavigate();

  // Effect to apply dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleToggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Function to fetch user details
  const fetchUserDetails = async (userToken, userEmail) => {
    console.log("DEBUG: Fetching user details...");
    try {
      const response = await fetch('http://127.0.0.1:8000/users/me', {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });
      if (!response.ok) {
        console.error("WARN: Could not fetch user details after login.");
        const fallbackName = userEmail || 'User';
        localStorage.setItem('name', fallbackName);
        setName(fallbackName);
        return;
      }
      const userData = await response.json();
      const fetchedName = userData.name || userEmail || 'User';
      localStorage.setItem('name', fetchedName);
      setName(fetchedName);
      console.log("DEBUG: User details fetched, name:", fetchedName);
    } catch (error) {
      console.error("ERROR fetching user details:", error);
      const fallbackName = userEmail || 'User';
      localStorage.setItem('name', fallbackName);
      setName(fallbackName);
    }
  };

  // Handle successful login
  const handleLogin = async (receivedToken) => {
    setIsLoading(true);
    console.log("DEBUG: Login successful via AuthPage, processing token...");
    try {
      const decodedToken = JSON.parse(atob(receivedToken.split('.')[1]));
      const userEmail = decodedToken.sub;
      if (!userEmail) {
         throw new Error("Token is missing user email ('sub').");
      }

      localStorage.setItem('token', receivedToken);
      localStorage.setItem('email', userEmail);
      setToken(receivedToken);
      setEmail(userEmail);
      setName('');

      await fetchUserDetails(receivedToken, userEmail);

      setTimeout(() => {
        console.log("DEBUG: Loader finished, navigating to dashboard.");
        setIsLoading(false);
        navigate('/');
      }, 1500);

    } catch (error) {
      console.error("ERROR during login process:", error);
      localStorage.removeItem('token'); 
      localStorage.removeItem('email'); 
      localStorage.removeItem('name');
      setToken(null); 
      setEmail(null); 
      setName(null);
      setIsLoading(false);
      alert(`Login failed: ${error.message}`);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('name');
    setToken(null);
    setEmail(null);
    setName(null);
    navigate('/login');
    console.log("DEBUG: User logged out.");
  };

  // Effect to fetch user details on initial load
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedEmail = localStorage.getItem('email');
    const storedName = localStorage.getItem('name');

    if (storedToken && storedEmail && !storedName) {
      console.log("DEBUG: Initial load, token found but name missing, fetching details...");
      fetchUserDetails(storedToken, storedEmail);
    } else if (storedName) {
         setName(storedName);
    }
  }, []);

  // --- Render Loading Spinner ---
  if (isLoading) {
    return <LoadingSpinner message="Loading your space..." />;
  }

  // --- Render Main App Structure ---
  return (
    <div className={darkMode ? 'dark-theme' : 'light-theme'}>
      {/* Render Layout (Navbar) only if logged in */}
      {token && (
        <Layout 
          userName={name} 
          userEmail={email} 
          onLogout={handleLogout}
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />
      )}

      <Routes>
        {!token ? (
          // --- Logged Out Routes ---
          <>
            <Route path="/login" element={<AuthPage onLogin={handleLogin} darkMode={darkMode} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          // --- Logged In Routes ---
          <>
            <Route path="/" element={<NotebooksDashboard darkMode={darkMode} />} />
            <Route path="/notebook/:notebookId" element={<NotebookView darkMode={darkMode} />} />
            <Route path="/calendar" element={<CalendarPage darkMode={darkMode} />} />
            <Route path="/discover" element={<DiscoveryPage darkMode={darkMode} />} />
            <Route path="/profile" element={<ProfilePage darkMode={darkMode} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
}

export default App;