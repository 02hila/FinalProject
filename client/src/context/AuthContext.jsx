import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

// 💡 FIX 1: Use VITE_API_BASE_URL defined in Vercel for production.
// If it's undefined (e.g., in local development, but not set in .env), fall back to localhost.
// Note: import.meta.env is how Vite handles environment variables.
const VERCEL_API_URL = import.meta.env.VITE_API_BASE_URL;

// If VERCEL_API_URL is defined, use it. Otherwise, assume development environment.
// We also append /api here, assuming the VITE_API_BASE_URL in Vercel is just the domain.
// If you included /api in the Vercel variable, remove the concatenation here.
export const API_URL = import.meta.env.VITE_API_BASE_URL 
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : 'http://localhost:5000/api';



console.log('🌍 Running on:', window.location.hostname);
// 💡 We are now using the correct API URL based on the Vercel setting.
console.log('🔗 Using API:', API_URL); 

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const navigate = useNavigate();

    // Load user from token on app startup
    const loadUserFromToken = useCallback(async () => {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        
        if (!token) {
            setLoading(false);
            setIsInitialized(true);
            return;
        }

        try {
            console.log('🔍 Loading user from token...');
            
            // Use the globally defined API_URL
            const meResponse = await fetch(`${API_URL}/auth/me`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            if (!meResponse.ok) throw new Error('Failed to fetch user details');
            
            const meData = await meResponse.json();

            if (meData.success && meData.user) {
                const userObject = meData.user;

                // Fetch stats only if user is an agent
                if (userId && userObject.userType === 'agent') {
                    try {
                        const statsResponse = await fetch(`${API_URL}/agents/${userId}/stats`, { 
                            headers: { Authorization: `Bearer ${token}` } 
                        });

                        if (statsResponse.ok) {
                            const statsData = await statsResponse.json();
                            if (statsData.success) {
                                userObject.stats = { ...userObject.stats, ...statsData.stats };
                            }
                        }
                    } catch (statsError) {
                        console.warn('⚠️ Failed to load stats:', statsError);
                    }
                }

                // Fetch basic stats for company
                if (userId && userObject.userType === 'company' && userObject.company?._id) {
                    try {
                        const historyResponse = await fetch(`${API_URL}/companies/${userObject.company._id}/ads/history`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        if (historyResponse.ok) {
                            const historyData = await historyResponse.json();
                            if (historyData.success && historyData.ads) {
                                const ads = historyData.ads;
                                userObject.stats = {
                                    approved: ads.filter(ad => ad.status === 'approved').length,
                                    pending: ads.filter(ad => ad.status === 'pending').length,
                                    rejected: ads.filter(ad => ad.status === 'rejected').length,
                                    total: ads.length
                                };
                            }
                        }
                    } catch (statsError) {
                        console.warn('⚠️ Failed to load company stats:', statsError);
                    }
                }

                setUser(userObject);
                console.log('✅ User and stats loaded:', userObject.fullName);
            } else {
                // Token invalid, clear it
                console.warn('⚠️ Invalid token, clearing storage');
                localStorage.removeItem('token');
                localStorage.removeItem('userType');
                localStorage.removeItem('userId');
            }
        } catch (err) {
            console.error('❌ Error loading user:', err);
            localStorage.removeItem('token');
            localStorage.removeItem('userType');
            localStorage.removeItem('userId');
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    }, []); // Empty deps array

    useEffect(() => {
        if (!isInitialized) {
            loadUserFromToken();
        }
    }, [isInitialized, loadUserFromToken]);

    const getDashboardPath = (userType) => {
        switch (userType) {
            case 'agent':
                return '/agent-dashboard';
            case 'company':
                return '/company-dashboard';
            default:
                return '/dashboard';
        }
    };

    const handleLogin = async (email, password) => {
        try {
            console.log('🔐 Attempting login...');
            
            // Use the globally defined API_URL
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            
            if (!res.ok) {
                const errorText = await res.text();
                console.error('❌ Server error:', errorText);
                return { 
                    success: false, 
                    message: `שגיאת שרת: ${res.status}` 
                };
            }

            const data = await res.json();
            
            if (!data.success) {
                return { success: false, message: data.message || 'שגיאה בהתחברות' };
            }

            const userId = data.user._id || data.user.id;
            localStorage.setItem('userId', userId);
            localStorage.setItem('token', data.token);
            localStorage.setItem('userType', data.user.userType);
            
            setUser(data.user);
            setIsInitialized(true);

            const targetPath = getDashboardPath(data.user.userType);
            console.log('🚀 Navigating to:', targetPath);
            
            navigate(targetPath, { replace: true });

            return { success: true, message: 'התחברת בהצלחה' };
        } catch (err) {
            console.error('❌ Login error:', err);
            return { 
                success: false, 
                message: 'שגיאת רשת. אנא נסה שוב מאוחר יותר.' 
            };
        }
    };

    const handleLogout = useCallback(() => {
        console.log('👋 Logging out...');
        localStorage.removeItem('token');
        localStorage.removeItem('userType');
        localStorage.removeItem('userId');
        setUser(null);
        navigate('/login', { replace: true });
    }, [navigate]);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isInitialized,
                handleLogin,
                handleLogout,
                loadUserFromToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};