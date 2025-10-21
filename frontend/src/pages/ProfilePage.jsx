// ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUser, FiBook, FiFileText, FiShare2, 
  FiUsers, FiHeart, FiGlobe, FiTrendingUp,
  FiAward, FiBarChart2, FiFolder, FiStar
} from 'react-icons/fi';
import { IoStatsChart, IoPeople, IoEarth } from 'react-icons/io5';
import './ProfilePage.css';

function ProfilePage({ darkMode }) {
  const [profileData, setProfileData] = useState(null);
  const [message, setMessage] = useState('Loading profile details...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('name') || localStorage.getItem('email');

  // Simplified animation variants - removed problematic layout props
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
    hidden: { scale: 0.95, opacity: 0 },
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
    }
  };

  // Enhanced fetch with better error handling and debugging
  useEffect(() => {
    const fetchProfileData = async () => {
      // Clear previous data and state
      setMessage('Loading profile details...');
      setIsLoading(true);
      setError(null);
      setProfileData(null);
      
      console.log("DEBUG: Starting profile data fetch...");
      console.log("DEBUG: Token exists:", !!token);
      console.log("DEBUG: User name/email:", userName);

      if (!token) {
        console.error("DEBUG: No token found, user not authenticated");
        setError("Please log in to view your profile");
        setIsLoading(false);
        return;
      }

      try {
        console.log("DEBUG: Making API request to profile endpoint...");
        const response = await fetch('http://127.0.0.1:8000/users/me/profile-details', {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });

        console.log("DEBUG: Response status:", response.status);
        console.log("DEBUG: Response ok:", response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("DEBUG: Response error details:", errorText);
          
          if (response.status === 401) {
            setError("Session expired. Please log in again.");
            setMessage('');
          } else if (response.status === 404) {
            setError("Profile not found.");
            setMessage('');
          } else {
            setError(`Server error: ${response.status}`);
            setMessage('');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        console.log("DEBUG: Successfully received profile data:", data);
        
        // Validate data structure
        if (data && typeof data === 'object') {
          setProfileData(data);
          setMessage('Profile loaded successfully!');
          // Clear success message after 3 seconds
          setTimeout(() => setMessage(''), 3000);
        } else {
          console.error("DEBUG: Invalid data structure received:", data);
          setError("Received invalid data format");
          setMessage('');
        }

      } catch (err) {
        console.error("ERROR: Network or parsing error:", err);
        setError(`Failed to load profile: ${err.message}`);
        setMessage('');
      } finally {
        setIsLoading(false);
        console.log("DEBUG: Fetch operation completed");
      }
    };

    if (token) {
      fetchProfileData();
    } else {
      setIsLoading(false);
      setError("Please log in to view your profile");
    }
  }, [token]); // Only refetch if token changes

  // Debug logging for state changes
  useEffect(() => {
    console.log("DEBUG: profileData state updated:", profileData);
  }, [profileData]);

  useEffect(() => {
    console.log("DEBUG: isLoading state:", isLoading);
    console.log("DEBUG: error state:", error);
    console.log("DEBUG: message state:", message);
  }, [isLoading, error, message]);

  // Helper functions with better null checking
  const getAchievements = (stats) => {
    if (!stats) return [];
    
    console.log("DEBUG: Calculating achievements with stats:", stats);
    const achievements = [];
    
    if (stats.notebooks_created >= 10) achievements.push({ icon: '🏆', text: 'Notebook Master' });
    else if (stats.notebooks_created >= 5) achievements.push({ icon: '📚', text: 'Notebook Collector' });
    else if (stats.notebooks_created >= 1) achievements.push({ icon: '📓', text: 'Getting Started' });
    
    if (stats.notes_created >= 50) achievements.push({ icon: '✍️', text: 'Prolific Writer' });
    else if (stats.notes_created >= 20) achievements.push({ icon: '📝', text: 'Active Writer' });
    else if (stats.notes_created >= 5) achievements.push({ icon: '🖊️', text: 'Note Taker' });
    
    if (stats.notebooks_shared_by_user >= 5) achievements.push({ icon: '🤝', text: 'Super Collaborator' });
    else if (stats.notebooks_shared_by_user >= 2) achievements.push({ icon: '↗️', text: 'Team Player' });
    else if (stats.notebooks_shared_by_user >= 1) achievements.push({ icon: '👥', text: 'Sharing Starter' });
    
    if (stats.total_likes_received >= 10) achievements.push({ icon: '⭐', text: 'Popular Creator' });
    else if (stats.total_likes_received >= 3) achievements.push({ icon: '❤️', text: 'Liked Creator' });
    
    console.log("DEBUG: Generated achievements:", achievements);
    return achievements;
  };

  const getSafeData = (data, defaultValue = null) => {
    console.log("DEBUG: Accessing data safely:", { data, defaultValue });
    return data || defaultValue;
  };

  const getNotebooksSharedByUser = () => {
    const notebooks = getSafeData(profileData?.notebooks_shared_by_user, []);
    console.log("DEBUG: Notebooks shared by user:", notebooks);
    return Array.isArray(notebooks) ? notebooks : [];
  };

  const getNotebooksSharedWithUser = () => {
    const notebooks = getSafeData(profileData?.notebooks_shared_with_user, []);
    console.log("DEBUG: Notebooks shared with user:", notebooks);
    return Array.isArray(notebooks) ? notebooks : [];
  };

  const getPublicNotebooks = () => {
    const notebooks = getSafeData(profileData?.public_notebooks_likes, []);
    console.log("DEBUG: Public notebooks:", notebooks);
    return Array.isArray(notebooks) ? notebooks : [];
  };

  const getStats = () => {
    const stats = getSafeData(profileData?.stats, {});
    const defaultStats = {
      notebooks_created: 0,
      notes_created: 0,
      notebooks_shared_by_user: 0,
      notebooks_shared_with_user: 0,
      total_likes_received: 0
    };
    const safeStats = { ...defaultStats, ...stats };
    console.log("DEBUG: Safe stats object:", safeStats);
    return safeStats;
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="profile-page-container" data-theme={darkMode ? 'dark' : 'light'}>
        <div className="loading-state">
          <motion.div
            className="spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {message || 'Loading your profile...'}
          </motion.p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !profileData) {
    return (
      <div className="profile-page-container" data-theme={darkMode ? 'dark' : 'light'}>
        <motion.div 
          className="profile-message error-message"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            borderColor: '#ef4444',
            color: '#ef4444'
          }}
        >
          <FiAlertCircle style={{ marginRight: '8px' }} />
          {error}
          <br />
          <small>Please refresh the page or log in again.</small>
        </motion.div>
      </div>
    );
  }

  // Main profile content
  return (
    <motion.div 
      className="profile-page-container"
      data-theme={darkMode ? 'dark' : 'light'}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <motion.header className="profile-header" variants={itemVariants}>
        <motion.h1
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <FiUser className="header-icon" />
          Your Profile & Stats
        </motion.h1>
        <motion.h2 
          className="profile-subtitle"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Welcome back, {profileData?.name || userName}! 👋
        </motion.h2>
      </motion.header>

      {/* Status Message */}
      <AnimatePresence>
        {message && (
          <motion.div 
            className="profile-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievements Section */}
      <motion.section className="profile-section" variants={itemVariants}>
        <div className="section-header">
          <h3>
            <FiAward className="section-icon" />
            Your Achievements
          </h3>
        </div>
        <div className="achievements-grid">
          {getAchievements(getStats()).length > 0 ? (
            getAchievements(getStats()).map((achievement, index) => (
              <motion.div
                key={`${achievement.text}-${index}`}
                className="achievement-badge"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                transition={{ delay: index * 0.1 }}
              >
                <span className="achievement-icon">{achievement.icon}</span>
                <p className="achievement-text">{achievement.text}</p>
              </motion.div>
            ))
          ) : (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FiAward className="empty-icon" />
              <h3>No achievements yet</h3>
              <p>Keep using the platform to earn achievements and badges!</p>
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* Stats Grid */}
      <motion.section className="profile-section" variants={itemVariants}>
        <div className="section-header">
          <h3>
            <IoStatsChart className="section-icon" />
            Activity Summary
          </h3>
        </div>
        <div className="stats-grid">
          {[
            { 
              icon: <FiBook />, 
              label: "Notebooks Created", 
              value: getStats().notebooks_created,
              color: "var(--color-primary)"
            },
            { 
              icon: <FiFileText />, 
              label: "Notes Added", 
              value: getStats().notes_created,
              color: "var(--color-accent)"
            },
            { 
              icon: <FiShare2 />, 
              label: "Shared By You", 
              value: getStats().notebooks_shared_by_user,
              color: "var(--color-warning)"
            },
            { 
              icon: <FiUsers />, 
              label: "Shared With You", 
              value: getStats().notebooks_shared_with_user,
              color: "var(--color-info)"
            },
            { 
              icon: <FiHeart />, 
              label: "Total Likes", 
              value: getStats().total_likes_received,
              color: "var(--color-error)"
            },
            { 
              icon: <FiTrendingUp />, 
              label: "Engagement", 
              value: Math.round((getStats().notes_created + getStats().total_likes_received) / 2),
              color: "var(--color-success)"
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              className="stat-card"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              style={{ '--stat-color': stat.color }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="stat-icon">{stat.icon}</div>
              <h4>{stat.label}</h4>
              <p className="stat-value">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Notebooks Shared BY You */}
      <motion.section className="profile-section" variants={itemVariants}>
        <div className="section-header">
          <h3>
            <FiShare2 className="section-icon" />
            Notebooks You've Shared ({getNotebooksSharedByUser().length})
          </h3>
        </div>
        <AnimatePresence mode="wait">
          {getNotebooksSharedByUser().length > 0 ? (
            <motion.div 
              className="notebooks-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
            >
              {getNotebooksSharedByUser().map((nb, index) => (
                <motion.div
                  key={nb._id || `shared-by-${index}`}
                  className="profile-notebook-card shared-by"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="notebook-header">
                    <Link to={`/notebook/${nb._id}`} className="notebook-link">
                      <FiFolder className="notebook-icon" />
                      {nb.name || 'Unnamed Notebook'}
                    </Link>
                  </div>
                  <div className="notebook-details">
                    <div className="shared-with-details">
                      <span className="detail-label">Shared with:</span>
                      {nb.shared_with && Array.isArray(nb.shared_with) && nb.shared_with.length > 0 ? (
                        nb.shared_with.map((s, idx) => (
                          <div key={s.user_email || `shared-${idx}`} className="shared-user">
                            <span className="owner-email">
                              {s.user_email || 'Unknown User'}
                            </span>
                            <span className={`permission-badge ${s.permission || 'view'}`}>
                              {s.permission === 'edit' ? 'Edit' : 'View'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="no-sharing">No one currently</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <FiShare2 className="empty-icon" />
              <h3>No shared notebooks yet</h3>
              <p>Share notebooks from your dashboard to collaborate with others.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Notebooks Shared WITH You */}
      <motion.section className="profile-section" variants={itemVariants}>
        <div className="section-header">
          <h3>
            <IoPeople className="section-icon" />
            Notebooks Shared With You ({getNotebooksSharedWithUser().length})
          </h3>
        </div>
        <AnimatePresence mode="wait">
          {getNotebooksSharedWithUser().length > 0 ? (
            <motion.div 
              className="notebooks-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
            >
              {getNotebooksSharedWithUser().map((nb, index) => (
                <motion.div
                  key={nb._id || `shared-with-${index}`}
                  className="profile-notebook-card shared-with"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="notebook-header">
                    <Link to={`/notebook/${nb._id}`} className="notebook-link">
                      <FiFolder className="notebook-icon" />
                      {nb.name || 'Unnamed Notebook'}
                    </Link>
                  </div>
                  <div className="notebook-details">
                    <div className="shared-by-details">
                      <span className="detail-label">From:</span>
                      <span className="owner-email">{nb.owner_email || 'Unknown Owner'}</span>
                      <span className={`permission-badge ${nb.permission || 'view'}`}>
                        {nb.permission === 'edit' ? '✏️ Can Edit' : '👁️ View Only'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <FiUsers className="empty-icon" />
              <h3>No shared notebooks</h3>
              <p>Ask your colleagues to share their notebooks with you!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Public Notebooks & Likes */}
      <motion.section className="profile-section" variants={itemVariants}>
        <div className="section-header">
          <h3>
            <IoEarth className="section-icon" />
            Your Public Notebooks ({getPublicNotebooks().length})
          </h3>
        </div>
        <AnimatePresence mode="wait">
          {getPublicNotebooks().length > 0 ? (
            <motion.div 
              className="notebooks-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
            >
              {getPublicNotebooks().map((nb, index) => (
                <motion.div
                  key={nb._id || `public-${index}`}
                  className="profile-notebook-card public"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="notebook-header">
                    <Link to={`/notebook/${nb._id}`} className="notebook-link">
                      <FiFolder className="notebook-icon" />
                      {nb.name || 'Unnamed Notebook'}
                    </Link>
                    <div className="like-count">
                      <FiHeart className="heart" />
                      <span className="count">{nb.like_count || 0}</span>
                    </div>
                  </div>
                  <div className="notebook-details">
                    <div className="public-badge">
                      <FiGlobe className="badge-icon" />
                      Public Notebook
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <FiGlobe className="empty-icon" />
              <h3>No public notebooks</h3>
              <p>Make notebooks public from your dashboard to get likes!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Fallback if no data but no error */}
      {!profileData && !isLoading && !error && (
        <motion.div 
          className="empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FiUser className="empty-icon" />
          <h3>Profile not available</h3>
          <p>It looks like your profile data couldn't be loaded. Please try refreshing the page.</p>
        </motion.div>
      )}
    </motion.div>
  );
}

export default ProfilePage;
