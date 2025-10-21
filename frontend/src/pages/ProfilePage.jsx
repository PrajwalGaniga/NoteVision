
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ProfilePage.css';

function ProfilePage({ darkMode }) {
  const [profileData, setProfileData] = useState(null);
  const [message, setMessage] = useState('Loading profile details...');
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('name') || localStorage.getItem('email');

  useEffect(() => {
    const fetchProfileData = async () => {
      setMessage('Loading profile details...');
      setProfileData(null);
      console.log("DEBUG: Fetching full profile details...");
      try {
        if (!token) throw new Error("Not logged in.");

        const response = await fetch('http://127.0.0.1:8000/users/me/profile-details', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 401) throw new Error("Session expired.");
          throw new Error("Could not fetch profile details.");
        }

        const data = await response.json();
        setProfileData(data);
        setMessage('');
        console.log("DEBUG: Received profile data:", data);

      } catch (error) {
        console.error("ERROR fetching profile data:", error);
        setMessage(`Error: ${error.message}`);
        setProfileData(null);
      }
    };

    fetchProfileData();
  }, [token]);

  return (
    <div className="profile-page-container" data-theme={darkMode ? 'dark' : 'light'}>
      <header className="profile-header">
        <h1>Your Profile & Stats ✨</h1>
        <h2>Welcome, {profileData?.name || userName}!</h2>
      </header>

      {message && <p className="profile-message">{message}</p>}

      {profileData ? (
        <>
          {/* Stats Grid */}
          <div className="profile-section">
            <h3>Activity Summary</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <h4>Notebooks Created</h4>
                <p className="stat-value">{profileData.stats.notebooks_created}</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📝</div>
                <h4>Notes Added</h4>
                <p className="stat-value">{profileData.stats.notes_created}</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon">↗️</div>
                <h4>Shared By You</h4>
                <p className="stat-value">{profileData.stats.notebooks_shared_by_user}</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon">↙️</div>
                <h4>Shared With You</h4>
                <p className="stat-value">{profileData.stats.notebooks_shared_with_user}</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon">❤️</div>
                <h4>Total Likes Received</h4>
                <p className="stat-value">{profileData.stats.total_likes_received}</p>
              </div>
            </div>
          </div>

          {/* Notebooks Shared BY You */}
          <div className="profile-section">
            <div className="section-header">
              <h3>Notebooks You've Shared ({profileData.notebooks_shared_by_user.length})</h3>
            </div>
            {profileData.notebooks_shared_by_user.length > 0 ? (
              <div className="notebooks-grid">
                {profileData.notebooks_shared_by_user.map(nb => (
                  <div key={nb._id} className="profile-notebook-card shared-by">
                    <div className="notebook-header">
                      <Link to={`/notebook/${nb._id}`} className="notebook-link">{nb.name}</Link>
                    </div>
                    <div className="notebook-details">
                      <div className="shared-with-details">
                        <span className="detail-label">Shared with:</span>
                        {nb.shared_with && nb.shared_with.length > 0
                          ? nb.shared_with.map(s => (
                              <span key={s.user_email} className="shared-user">
                                {s.user_email} <span className="permission-badge">{s.permission}</span>
                              </span>
                            ))
                          : <span className="no-sharing">No one currently</span>
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🤝</div>
                <p>You haven't shared any notebooks yet.</p>
                <p className="empty-subtitle">Share notebooks from your dashboard to collaborate with others.</p>
              </div>
            )}
          </div>

          {/* Notebooks Shared WITH You */}
          <div className="profile-section">
            <div className="section-header">
              <h3>Notebooks Shared With You ({profileData.notebooks_shared_with_user.length})</h3>
            </div>
            {profileData.notebooks_shared_with_user.length > 0 ? (
              <div className="notebooks-grid">
                {profileData.notebooks_shared_with_user.map(nb => (
                  <div key={nb._id} className="profile-notebook-card shared-with">
                    <div className="notebook-header">
                      <Link to={`/notebook/${nb._id}`} className="notebook-link">{nb.name}</Link>
                    </div>
                    <div className="notebook-details">
                      <div className="shared-by-details">
                        <span className="detail-label">From:</span>
                        <span className="owner-email">{nb.owner_email}</span>
                        <span className={`permission-badge ${nb.permission}`}>
                          {nb.permission === 'edit' ? '✏️ Can Edit' : '👁️ View Only'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <p>No notebooks have been shared with you.</p>
                <p className="empty-subtitle">Ask your colleagues to share their notebooks with you!</p>
              </div>
            )}
          </div>

          {/* Public Notebooks & Likes */}
          <div className="profile-section">
            <div className="section-header">
              <h3>Your Public Notebooks ({profileData.public_notebooks_likes.length})</h3>
            </div>
            {profileData.public_notebooks_likes.length > 0 ? (
              <div className="notebooks-grid">
                {profileData.public_notebooks_likes.map(nb => (
                  <div key={nb._id} className="profile-notebook-card public">
                    <div className="notebook-header">
                      <Link to={`/notebook/${nb._id}`} className="notebook-link">{nb.name}</Link>
                      <div className="like-count">
                        <span className="heart">❤️</span>
                        <span className="count">{nb.like_count}</span>
                      </div>
                    </div>
                    <div className="notebook-details">
                      <div className="public-badge">🌐 Public</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🌐</div>
                <p>You don't have any public notebooks yet.</p>
                <p className="empty-subtitle">Make notebooks public from your dashboard to get likes!</p>
              </div>
            )}
          </div>
        </>
      ) : (
        !message.startsWith('Error') && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your profile...</p>
          </div>
        )
      )}
    </div>
  );
}

export default ProfilePage;
