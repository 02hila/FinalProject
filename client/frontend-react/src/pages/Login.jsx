import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    const { handleLogin, loading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        const result = await handleLogin(email, password); 

        if (!result.success) {
            setError(result.message);
        }
    };

    return (
        <div style={styles.body}>
            <div style={styles.loginContainer}>
                <div style={styles.logo}>⚡</div>
                <h2 style={styles.h2}>התחברות</h2>
                <p style={styles.subtitle}>ברוכים השבים ל-Ads Maker</p>

                {error && <div style={styles.error}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>אימייל</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="your@email.com"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>סיסמה</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="••••••••"
                            style={styles.input}
                        />
                    </div>

                    <button type="submit" style={styles.btn} disabled={loading}>
                        {loading ? 'מתחבר...' : 'התחבר'}
                    </button>
                </form>

                <div style={styles.divider}>או</div>

                <div style={styles.link}>
                    עדיין אין לך חשבון? <a href="/register" style={styles.linkA}>הירשם עכשיו</a>
                </div>
            </div>
        </div>
    );
};

const styles = {
    body: {
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        direction: 'rtl',
    },
    loginContainer: {
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '450px',
        animation: 'slideUp 0.5s ease-out',
    },
    logo: {
        textAlign: 'center',
        fontSize: '60px',
        marginBottom: '10px',
    },
    h2: {
        textAlign: 'center',
        color: '#667eea',
        marginBottom: '10px',
        fontSize: '32px',
    },
    subtitle: {
        textAlign: 'center',
        color: '#666',
        marginBottom: '30px',
        fontSize: '14px',
    },
    formGroup: {
        marginBottom: '20px',
    },
    label: {
        display: 'block',
        marginBottom: '8px',
        color: '#333',
        fontWeight: '500',
    },
    input: {
        width: '100%',
        padding: '12px 15px',
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        fontSize: '16px',
        transition: 'all 0.3s',
        outline: 'none',
    },
    btn: {
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.3s',
        marginTop: '10px',
    },
    divider: {
        textAlign: 'center',
        margin: '25px 0',
        color: '#999',
        position: 'relative',
    },
    link: {
        textAlign: 'center',
        marginTop: '20px',
        color: '#666',
    },
    linkA: {
        color: '#667eea',
        textDecoration: 'none',
        fontWeight: 'bold',
    },
    error: {
        background: '#fee',
        color: '#c33',
        padding: '10px',
        borderRadius: '8px',
        marginBottom: '15px',
        textAlign: 'center',
    },
};

export default Login;