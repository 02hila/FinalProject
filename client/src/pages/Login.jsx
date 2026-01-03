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
        
        try {
            const result = await handleLogin(email, password); 

            if (!result.success) {
                // הצגת הודעת השגיאה מהסרבר
                setError(result.message || 'אירעה שגיאה בהתחברות');
            }
        } catch (error) {
            // טיפול בשגיאות רשת או שגיאות לא צפויות
            console.error('Login error:', error);
            setError('בעיית תקשורת עם השרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.');
        }
    };

    return (
        <div style={styles.body}>
            <div style={styles.loginContainer}>
                <div style={styles.logo}>⚡</div>
                <h2 style={styles.h2}>התחברות</h2>
                <p style={styles.subtitle}>ברוכים השבים ל-Ads Maker</p>

                {/* ✅ הודעת שגיאה משופרת */}
                {error && (
                    <div style={styles.errorBox}>
                        <div style={styles.errorIcon}>⚠️</div>
                        <div style={styles.errorText}>{error}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>אימייל</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setError(''); // ✅ איפוס שגיאה בעת הקלדה
                            }}
                            required
                            disabled={loading}
                            placeholder="your@email.com"
                            style={error ? {...styles.input, ...styles.inputError} : styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>סיסמה</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError(''); // ✅ איפוס שגיאה בעת הקלדה
                            }}
                            required
                            disabled={loading}
                            placeholder="••••••••"
                            style={error ? {...styles.input, ...styles.inputError} : styles.input}
                        />
                    </div>

                    <button 
                        type="submit" 
                        style={loading ? {...styles.btn, ...styles.btnDisabled} : styles.btn} 
                        disabled={loading}
                    >
                        {loading ? '⏳ מתחבר...' : 'התחבר'}
                    </button>
                </form>

                <div style={styles.divider}>
                    <span style={styles.dividerText}>או</span>
                </div>

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
        boxSizing: 'border-box',
    },
    inputError: {
        borderColor: '#ff4444',
        background: '#fff5f5',
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
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
    },
    btnDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    divider: {
        textAlign: 'center',
        margin: '25px 0',
        position: 'relative',
        height: '1px',
        background: '#e0e0e0',
    },
    dividerText: {
        position: 'relative',
        top: '-12px',
        background: 'white',
        padding: '0 15px',
        color: '#999',
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
        transition: 'all 0.3s',
    },
    errorBox: {
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
        color: 'white',
        padding: '15px',
        borderRadius: '10px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 15px rgba(255, 107, 107, 0.3)',
        animation: 'shake 0.5s ease-in-out',
    },
    errorIcon: {
        fontSize: '24px',
    },
    errorText: {
        flex: 1,
        fontWeight: '500',
        fontSize: '15px',
    },
};


const styleSheet = document.createElement("style");
styleSheet.innerText = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(styleSheet);

export default Login;