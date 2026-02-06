import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState(''); 
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            
            setTimeout(() => {
                setMessage('אם המייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה.');
                setLoading(false);
            }, 1500);
        } catch (err) {
            setError('אירעה שגיאה. נסה שוב מאוחר יותר.');
            setLoading(false);
        }
    };

    return (
        <div style={styles.body}>
            <div style={styles.container}>
                <div style={styles.logo}>🔒</div>
                <h2 style={styles.h2}>שכחת סיסמה?</h2>
                <p style={styles.subtitle}>אל דאגה, הכנס את האימייל שלך ונשלח לך הוראות לאיפוס.</p>

                {error && <div style={styles.errorBox}>{error}</div>}
                {message && <div style={styles.successBox}>{message}</div>}

                {!message && (
                    <form onSubmit={handleSubmit}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>אימייל</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="your@email.com"
                                style={styles.input}
                            />
                        </div>
                        <button type="submit" style={styles.btn} disabled={loading}>
                            {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
                        </button>
                    </form>
                )}

                <div style={styles.link}>
                    <a href="/login" style={styles.linkA}>חזרה להתחברות</a>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
    },
    successBox: {
        background: '#d4edda',
        color: '#155724',
        padding: '15px',
        borderRadius: '10px',
        marginBottom: '20px',
        fontSize: '14px',
    }
};

export default ForgotPassword;