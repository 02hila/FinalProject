import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/**
 * ResetPassword Component
 * Allows users to set a new password using a token received via email.
 */
const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        if (tokenFromUrl) {
            setToken(tokenFromUrl);
        } else {
            setError('טוקן חסר או לא תקין');
        }
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return setError('הסיסמאות אינן תואמות');
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await fetch(`https://adsmaker.onrender.com/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await response.json();

            if (data.success) {
                setMessage('הסיסמה שונתה בהצלחה! מועבר לדף ההתחברות...');
                setTimeout(() => navigate('/login'), 3000);
            } else {
                setError(data.message || 'שגיאה בעדכון הסיסמה');
            }
        } catch (err) {
            setError('שגיאה בחיבור לשרת. נסו שוב מאוחר יותר.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.body}>
            <div style={styles.container}>
                <div style={styles.logo}>🔒</div>
                <h2 style={styles.h2}>יצירת סיסמה חדשה</h2>
                <p style={styles.subtitle}>הזינו את הסיסמה החדשה שלכם למטה</p>

                {error && <div style={styles.error}>{error}</div>}
                {message && <div style={styles.success}>{message}</div>}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>סיסמה חדשה</label>
                        <div style={styles.inputWrapper}>
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                style={styles.input}
                                placeholder="מינימום 6 תווים"
                            />
                            <span 
                                onClick={() => setShowNewPassword(!showNewPassword)} 
                                style={styles.eyeIcon}
                            >
                                {showNewPassword ? '👁️' : '🔒'}
                            </span>
                        </div>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>אימות סיסמה</label>
                        <div style={styles.inputWrapper}>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                style={styles.input}
                                placeholder="הזינו את הסיסמה שוב"
                            />
                            <span 
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                                style={styles.eyeIcon}
                            >
                                {showConfirmPassword ? '👁️' : '🔒'}
                            </span>
                        </div>
                    </div>

                    <button type="submit" style={styles.btn} disabled={loading || !token}>
                        {loading ? 'מעדכן...' : 'עדכן סיסמה'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// Styling Object 
const styles = {
    body: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        direction: 'rtl',
        fontFamily: 'Arial, sans-serif'
    },
    container: {
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    },
    logo: { fontSize: '40px', marginBottom: '10px' },
    h2: { color: '#667eea', marginBottom: '10px' },
    subtitle: { color: '#666', marginBottom: '20px', fontSize: '14px' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    formGroup: { textAlign: 'right' },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    },
    eyeIcon: {
        position: 'absolute',
        left: '12px', 
        cursor: 'pointer',
        fontSize: '18px',
        userSelect: 'none'
    },
    label: { display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' },
    input: {
        width: '100%',
        padding: '12px',
        paddingLeft: '40px', 
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxSizing: 'border-box',
        fontSize: '16px'
    },
    btn: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        marginTop: '10px'
    },
    error: { color: '#721c24', background: '#f8d7da', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' },
    success: { color: '#155724', background: '#d4edda', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }
};

export default ResetPassword;