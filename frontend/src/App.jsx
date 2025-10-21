// App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { FiSun, FiMoon, FiHome, FiCalendar, FiCompass, FiUser, FiLogOut } from 'react-icons/fi';
import AuthPage from './pages/AuthPage';
import NotebooksDashboard from './pages/NotebooksDashboard';
import NotebookView from './pages/NotebookView';
import CalendarPage from './pages/CalendarPage';
import DiscoveryPage from './pages/DiscoveryPage';
import ProfilePage from './pages/ProfilePage';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

// --- Layout Component with Enhanced Animations ---
function Layout({ userName, userEmail, onLogout, darkMode, onToggleDarkMode }) {
  const [isHovered, setIsHovered] = useState(null);
  
  const themeAnimation = useSpring({
    transform: darkMode ? 'rotate(180deg)' : 'rotate(0deg)',
    config: { tension: 300, friction: 20 }
  });

  const navItemVariants = {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    hover: { 
      scale: 1.05,
      transition: { type: "spring", stiffness: 400, damping: 10 }
    },
    tap: { scale: 0.95 }
  };

  return (
    <motion.nav 
      className="main-nav"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="nav-links-container">
        {[
          { to: "/", icon: FiHome, label: "Dashboard" },
          { to: "/calendar", icon: FiCalendar, label: "Calendar" },
          { to: "/discover", icon: FiCompass, label: "Discover" },
          { to: "/profile", icon: FiUser, label: "Profile" }
        ].map((item, index) => (
          <motion.div
            key={item.to}
            variants={navItemVariants}
            initial="initial"
            animate="animate"
            whileHover="hover"
            whileTap="tap"
            custom={index}
          >
            <Link 
              to={item.to} 
              className="nav-link"
              onMouseEnter={() => setIsHovered(item.to)}
              onMouseLeave={() => setIsHovered(null)}
            >
              <item.icon className="nav-icon" />
              <span>{item.label}</span>
              {isHovered === item.to && (
                <motion.div 
                  className="nav-hover-effect"
                  layoutId="navHover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="nav-controls">
        {/* Enhanced Theme Toggle */}
        <animated.button 
          onClick={onToggleDarkMode}
          className="theme-toggle"
          style={themeAnimation}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <FiSun /> : <FiMoon />}
        </animated.button>

        {/* User Display with Animation */}
        <motion.span 
          className="user-display"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 0],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              repeatDelay: 5 
            }}
            style={{ display: 'inline-block', marginRight: '8px' }}
          >
            👋
          </motion.div>
          Welcome, {userName || userEmail}!
        </motion.span>

        {/* Enhanced Logout Button */}
        <motion.button 
          onClick={onLogout} 
          className="logout-button"
          whileHover={{ 
            scale: 1.05,
            boxShadow: "0 10px 25px -5px rgba(239, 68, 68, 0.4)"
          }}
          whileTap={{ scale: 0.95 }}
        >
          <FiLogOut className="button-icon" />
          Logout
        </motion.button>
      </div>
    </motion.nav>
  );
}

// --- Main App Component with Enhanced Animations ---
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [email, setEmail] = useState(localStorage.getItem('email'));
  const [name, setName] = useState(localStorage.getItem('name'));
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Enhanced page transition variants
  const pageVariants = {
    initial: { 
      opacity: 0, 
      y: 20,
      scale: 0.98
    },
    in: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        duration: 0.6
      }
    },
    out: { 
      opacity: 0, 
      y: -20,
      scale: 1.02,
      transition: {
        duration: 0.3
      }
    }
  };

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

  // Handle successful login with enhanced animation
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

  // Handle logout with animation
  const handleLogout = () => {
    // Add logout animation
    setIsLoading(true);
    setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('email');
      localStorage.removeItem('name');
      setToken(null);
      setEmail(null);
      setName(null);
      setIsLoading(false);
      navigate('/login');
      console.log("DEBUG: User logged out.");
    }, 800);
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

  // Enhanced Loading Spinner
  if (isLoading) {
    return <LoadingSpinner message="Loading your space..." darkMode={darkMode} />;
  }

  return (
    <div className={`app-container ${darkMode ? 'dark-theme' : 'light-theme'}`}>
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

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {!token ? (
            // --- Logged Out Routes ---
            <>
              <Route 
                path="/login" 
                element={
                  <motion.div
                    variants={pageVariants}
                    initial="initial"
                    animate="in"
                    exit="out"
                  >
                    <AuthPage onLogin={handleLogin} darkMode={darkMode} />
                  </motion.div>
                } 
              />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            // --- Logged In Routes ---
            <>
              <Route 
                path="/" 
                element={
                  <motion.div
                    variants={pageVariants}
                    initial="initial"
                    animate="in"
                    exit="out"
                  >
                    <NotebooksDashboard darkMode={darkMode} />
                  </motion.div>
                } 
              />
              <Route 
                path="/notebook/:notebookId" 
                element={
                  <motion.div
                    variants={pageVariants}
                    initial="initial"
                    animate="in"
                    exit="out"
                  >
                    <NotebookView darkMode={darkMode} />
                  </motion.div>
                } 
              />
              <Route 
                path="/calendar" 
                element={
                  <motion.div
                    variants={pageVariants}
                    initial="initial"
                    animate="in"
                    exit="out"
                  >
                    <CalendarPage darkMode={darkMode} />
                  </motion.div>
                } 
              />
              <Route 
                path="/discover" 
                element={
                  <motion.div
                    variants={pageVariants}
                    initial="initial"
                    animate="in"
                    exit="out"
                  >
                    <DiscoveryPage darkMode={darkMode} />
                  </motion.div>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <motion.div
                    variants={pageVariants}
                    initial="initial"
                    animate="in"
                    exit="out"
                  >
                    <ProfilePage darkMode={darkMode} />
                  </motion.div>
                } 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </AnimatePresence>
    </div>
  );
}

export default App;