import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
/**
 * ForgotPassword Component
 * This component handles the first step of the password recovery process.
 * It allows users to submit their email address to receive a reset link.
 */
const ForgotPassword = () => {
    // State for the user's email input
    const [email, setEmail] = useState('');
    // Loading state to disable the button during API calls
    const [loading, setLoading] = useState(false);
    // Success state to toggle between the form and the success message
    const [submitted, setSubmitted] = useState(false);
    // Error state to store and display feedback from the server
    const [error, setError] = useState(''); 
    const navigate = useNavigate();
    /**
     * Handles the form submission
     * @param {Event} e - Form event
     */
    const handleSubmit = async (e) => {
        e.preventDefault();// Prevent page refresh
        setLoading(true);// Start loading state
        setError(""); // Reset previous errors

        try {
            // Send a POST request to the backend forgot-password endpoint
            const response = await fetch(`https://adsmaker.onrender.com/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (data.success) {
                // If successful, show the success message UI
                setSubmitted(true);
            } else {
                // If the server returns an error (e.g., email not found)
                setError(data.message);
                alert(data.message); 
            }
        } catch (err) {
            // Handle network or server connection issues
            setError("שגיאה בחיבור לשרת");
            alert("שגיאה בחיבור לשרת");
        } finally {
            setLoading(false);// Stop loading state
        }
    };

    return (
        <div style={styles.body}>
            <div style={styles.container}>
                <div style={styles.logo}>⚡</div>
                <h2 style={styles.h2}>שחזור סיסמה</h2>
                <p style={styles.subtitle}>הכנס אימייל לשליחת קישור לשחזור</p>

                {/* הצגת הודעת שגיאה במידה וקיימת */}
                {error && <p style={{ color: 'red', fontSize: '14px' }}>{error}</p>}

                {!submitted ? (
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
                            {loading ? 'שולח...' : 'שלח קישור לשחזור'}
                        </button>
                    </form>
                ) : (
                    <div style={styles.successMessage}>
                        ✅ המייל נשלח בהצלחה! בדוק את תיבת הדואר שלך.
                    </div>
                )}

                <div style={styles.link}>
                    <button onClick={() => navigate('/login')} style={styles.backBtn}>
                        חזרה להתחברות
                    </button>
                </div>
            </div>
        </div>
    );
};
//Component Styles
const styles = {
    body: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        direction: 'rtl',
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
    formGroup: { textAlign: 'right', marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', fontWeight: '500' },
    input: {
        width: '100%',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxSizing: 'border-box'
    },
    btn: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    backBtn: {
        background: 'none',
        border: 'none',
        color: '#667eea',
        cursor: 'pointer',
        marginTop: '15px',
        textDecoration: 'underline'
    },
    successMessage: { color: '#28a745', padding: '20px', fontWeight: 'bold' }
};

export default ForgotPassword;