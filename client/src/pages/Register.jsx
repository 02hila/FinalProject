/**
 * Register.jsx
 *
 * New user registration page for the Ads-Maker platform.
 *
 * Route: /register
 * Access: Public (unauthenticated users).
 * API: Delegates to AuthContext.handleRegister which calls
 *      POST /api/auth/register on the backend.
 * Context: AuthContext -- provides handleRegister and loading state.
 *
 * Supports two user types: "agent" and "company". When "company" is
 * selected, additional fields (company name, industry) are shown.
 * After successful registration, AuthContext handles navigation.
 */

// client/frontend-react/src/pages/Register.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Register component.
 *
 * Renders a multi-section registration form:
 * 1. User type selector (agent or company) -- must be chosen first.
 * 2. Common fields: full name, email, password, confirm password.
 * 3. Company-specific fields shown conditionally.
 *
 * Validates password match and user type selection before submitting.
 *
 * @returns {JSX.Element} The registration form.
 */
const Register = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        userType: '',
        companyName: '',
        industry: '',
    });
    const [error, setError] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const { handleRegister, loading } = useAuth();

    /** Sets the selected user type and syncs it into formData. */
    const handleTypeSelect = (type) => {
        setSelectedType(type);
        setFormData({ ...formData, userType: type });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    /**
     * Validates the form and submits the registration data.
     * Strips confirmPassword before sending, and conditionally
     * includes company-specific fields only for company users.
     *
     * @param {React.FormEvent} e - The form submit event.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (!formData.userType) {
            setError('Please select a user type');
            return;
        }

        // Build the payload -- only include company fields when relevant
        const dataToSend = {
            fullName: formData.fullName,
            email: formData.email,
            password: formData.password,
            userType: formData.userType,
        };

        if (formData.userType === 'company') {
            dataToSend.companyName = formData.companyName;
            dataToSend.industry = formData.industry;
        }

        const result = await handleRegister(dataToSend);

        if (!result.success) {
            setError(result.message);
        }
    };

    return (
        <div style={styles.body}>
            <div style={styles.registerContainer}>
                <div style={styles.logo}>⚡</div>
                <h2 style={styles.h2}>הרשמה</h2>
                <p style={styles.subtitle}>הצטרף לAds Maker</p>

                {error && <div style={styles.error}>{error}</div>}

                {/* User type selection cards */}
                <div style={styles.userTypeSelector}>
                    <div
                        style={{
                            ...styles.userTypeCard,
                            ...(selectedType === 'agent' ? styles.userTypeCardSelected : {}),
                        }}
                        onClick={() => handleTypeSelect('agent')}
                    >
                        <div style={styles.userTypeIcon}>👔</div>
                        <div style={styles.userTypeTitle}>סוכן</div>
                        <div style={styles.userTypeDesc}>אני מנהל קמפיינים עבור לקוחות</div>
                    </div>
                    <div
                        style={{
                            ...styles.userTypeCard,
                            ...(selectedType === 'company' ? styles.userTypeCardSelected : {}),
                        }}
                        onClick={() => handleTypeSelect('company')}
                    >
                        <div style={styles.userTypeIcon}>🏢</div>
                        <div style={styles.userTypeTitle}>חברה</div>
                        <div style={styles.userTypeDesc}>אני מפרסם עבור העסק שלי</div>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>שם מלא</label>
                        <input
                            type="text"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            disabled={loading}
                            required
                            placeholder="גו'ן דו"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>אימייל</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={loading}
                            required
                            placeholder="your@email.com"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>סיסמה</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={loading}
                            required
                            minLength="6"
                            placeholder="••••••••"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>אימות סיסמה</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            disabled={loading}
                            required
                            placeholder="••••••••"
                            style={styles.input}
                        />
                    </div>

                    {/* Conditionally rendered company-specific fields */}
                    {selectedType === 'company' && (
                        <div id="companyFields">
                            <div style={styles.formGroup}>
                                <label style={styles.label}>שם החברה</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    disabled={loading}
                                    required
                                    placeholder="שם החברה שלך"
                                    style={styles.input}
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>תחום</label>
                                <input
                                    type="text"
                                    name="industry"
                                    value={formData.industry}
                                    onChange={handleChange}
                                    disabled={loading}
                                    required
                                    placeholder="טכנולויה, בריאות, חינוך וכו׳"
                                    style={styles.input}
                                />
                            </div>
                        </div>
                    )}

                    <button type="submit" style={styles.btn} disabled={!selectedType || loading}>
                        {loading ? 'נרשם...' : 'הרשמה'}
                    </button>
                </form>

                <div style={styles.link}>
                    כבר יש לך חשבון? <a href="/התחבר" style={styles.linkA}>התחבר</a>
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
        padding: '20px',
    },
    registerContainer: {
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '500px',
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
    userTypeSelector: {
        display: 'flex',
        gap: '15px',
        marginBottom: '30px',
    },
    userTypeCard: {
        flex: 1,
        padding: '20px',
        border: '3px solid #e0e0e0',
        borderRadius: '12px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s',
    },
    userTypeCardSelected: {
        borderColor: '#667eea',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
    },
    userTypeIcon: {
        fontSize: '40px',
        marginBottom: '10px',
    },
    userTypeTitle: {
        fontWeight: 'bold',
        color: '#333',
        marginBottom: '5px',
    },
    userTypeDesc: {
        fontSize: '12px',
        color: '#666',
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

export default Register;
