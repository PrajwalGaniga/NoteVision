// AuthPage.jsx
import React, { useState } from 'react';
import './AuthPage.css';

function AuthPage({ onLogin, darkMode }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage({ text: 'Loading...', type: 'loading' });

    let url = '';
    let options = {};

    if (isLogin) {
      url = 'http://127.0.0.1:8000/login';
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      };
    } else {
      if (!name.trim()) {
        setMessage({ text: "Please enter your name.", type: 'error' });
        return;
      }

      url = 'http://127.0.0.1:8000/register';
      options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim(), email, password }),
      };
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      if (isLogin) {
        setMessage({ text: 'Login successful! Loading app...', type: 'success' });
        onLogin(data.access_token);
      } else {
        setMessage({ text: 'Registration successful! Please log in.', type: 'success' });
        setIsLogin(true);
        setName('');
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      console.error(`${isLogin ? 'Login' : 'Register'} failed:`, error);
      setMessage({ text: `Error: ${error.message || 'An unknown error occurred'}`, type: 'error' });
    }
  };

  return (
    <div className={`auth-container ${darkMode ? 'dark-theme' : ''}`} data-theme={darkMode ? 'dark' : 'light'}>
      <div className="auth-box">
        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="input-group">
              <label>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button type="submit" className="auth-button">
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {message.text && (
          <div className={`auth-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <button 
          onClick={() => {
            setIsLogin(!isLogin);
            setMessage({ text: '', type: '' });
            setName('');
            setEmail('');
            setPassword('');
          }} 
          className="toggle-button"
        >
          {isLogin
            ? "Don't have an account? Sign Up"
            : 'Already have an account? Sign In'}
        </button>
      </div>
    </div>
  );
}

export default AuthPage;