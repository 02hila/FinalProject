/**
 * AuthContext.jsx -- Authentication State Management
 *
 * Purpose:
 *   Provides a React context that holds the current user object and exposes
 *   login, register, logout, and session-restore helpers to every component
 *   in the tree. All API calls related to authentication originate here.
 *
 * Key exports:
 *   - AuthContext        -- the raw React context (rarely consumed directly).
 *   - AuthProvider       -- context provider; wrap around <App /> in main.jsx.
 *   - useAuth()          -- convenience hook for consuming auth state.
 *   - API_URL            -- base URL for all backend requests.
 *
 * Connections:
 *   - Mounted in main.jsx, inside BrowserRouter (needs useNavigate).
 *   - Consumed by ProtectedRoute, page components, and service modules.
 *   - Uses localStorage for persisting token, userId, and userType across
 *     page reloads; a STORAGE_VERSION mechanism invalidates stale data
 *     when the schema changes between deployments.
 */

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

/** Base URL for all API requests; falls back to localhost during development. */
export const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// ---------------------------------------------------------------------------
// localStorage version guard
// Incrementing STORAGE_VERSION forces a full cache clear for all users,
// which is useful after breaking changes to the persisted data shape.
// ---------------------------------------------------------------------------
const STORAGE_VERSION = '2';
const STORAGE_VERSION_KEY = 'app_storage_version';

// Debug
console.log("🔧 Environment Mode:", import.meta.env.MODE);
console.log("📝 VITE_API_BASE_URL from .env:", import.meta.env.VITE_API_BASE_URL);
console.log('🌍 Running on:', window.location.hostname);
console.log('🔗 Using API:', API_URL);

/**
 * Removes all application-specific keys from localStorage.
 * Preserves the storage version key itself so the version check does not re-trigger.
 */
const clearAppStorage = () => {
    console.log('🧹 Clearing app localStorage data...');
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('userId');
    localStorage.removeItem('ad_generator_data');
    // Keep the version key
};

/**
 * Compares the persisted storage version with the expected version.
 * If they differ, all app data is cleared and the new version is stored.
 *
 * @returns {boolean} true if versions matched (data is still valid), false if cleared.
 */
const checkStorageVersion = () => {
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    if (storedVersion !== STORAGE_VERSION) {
        console.log(`🔄 Storage version mismatch (${storedVersion} → ${STORAGE_VERSION}), clearing old data...`);
        clearAppStorage();
        localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
        return false;
    }
    return true;
};

// Run version check once at module load time, before any component renders.
checkStorageVersion();

/**
 * AuthProvider -- wraps children with authentication state.
 *
 * On mount it attempts to restore the user session from a stored JWT token
 * by calling /api/auth/me. If the user is an agent or company, additional
 * stats are fetched and merged into the user object.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const navigate = useNavigate();

    /**
     * Restores the user session from a stored JWT.
     * Fetches /api/auth/me and, depending on user type, also fetches
     * agent stats or company ad-history stats.
     */
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

            const meResponse = await fetch(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!meResponse.ok) throw new Error('Failed to fetch user details');

            const meData = await meResponse.json();

            if (meData.success && meData.user) {
                let userObject = meData.user;

                // Attach the token to the user object so consumers can use it for API calls
                userObject.token = token;

                // Fetch supplementary agent stats when the user is an agent
                if (userId && userObject.userType === 'agent') {
                    try {
                        const statsResponse = await fetch(`${API_URL}/api/agents/${userId}/stats`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (statsResponse.ok) {
                            const statsData = await statsResponse.json();
                            if (statsData.success) {
                                userObject.stats = { ...userObject.stats, ...statsData.stats };
                            }
                        }
                    } catch (statsError) {
                        console.warn('⚠️ Failed to load agent stats:', statsError);
                    }
                }

                // Derive ad-status counts for company users from their ad history
                if (userId && userObject.userType === 'company' && userObject.company?._id) {
                    try {
                        const historyResponse = await fetch(`${API_URL}/api/companies/${userObject.company._id}/ads/history`, {
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
                // Invalid user data from server - clear storage
                clearAppStorage();
            }
        } catch (err) {
            console.error('❌ Error loading user:', err);
            // Clear corrupted/stale localStorage data
            clearAppStorage();
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    }, []);

    // Restore session once on initial mount
    useEffect(() => {
        if (!isInitialized) {
            loadUserFromToken();
        }
    }, [isInitialized, loadUserFromToken]);

    /**
     * Maps a userType string to its corresponding dashboard path.
     * @param {string} userType - "agent" | "company" | other
     * @returns {string} The dashboard route path.
     */
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

    /**
     * Authenticates the user with email and password.
     * On success, persists credentials in localStorage, sets user state,
     * and navigates to the appropriate dashboard.
     *
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{success: boolean, message: string}>}
     */
    const handleLogin = async (email, password) => {
        setLoading(true);
        try {
            console.log('🔐 Attempting login...', `${API_URL}/api/auth/login`);

            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            // Always parse JSON, even on error responses, to get the server message
            const data = await res.json();

            if (!res.ok) {
                console.error('❌ Login failed:', res.status, data.message);

                return {
                    success: false,
                    message: data.message || 'שגיאה בהתחברות. אנא נסה שנית.'
                };
            }

            if (!data.success) {
                return {
                    success: false,
                    message: data.message || 'שגיאה בהתחברות'
                };
            }

            // Persist session identifiers so loadUserFromToken can restore on reload
            const userId = data.user._id || data.user.id;
            localStorage.setItem('userId', userId);
            localStorage.setItem('token', data.token);
            localStorage.setItem('userType', data.user.userType);

            const userWithToken = { ...data.user, token: data.token };

            setUser(userWithToken);
            setIsInitialized(true);

            const targetPath = getDashboardPath(data.user.userType);
            console.log('🚀 Navigating to:', targetPath);
            navigate(targetPath, { replace: true });

            return { success: true, message: 'התחברת בהצלחה' };

        } catch (err) {
            console.error('❌ Login error:', err);

            return {
                success: false,
                message: 'בעיית תקשורת עם השרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.'
            };
        } finally {
            setLoading(false);
        }
    };

    /**
     * Registers a new user account.
     * On success, automatically logs the user in (stores token, sets state,
     * and redirects to the correct dashboard).
     *
     * @param {object} userData - Registration payload (email, password, userType, etc.)
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    const handleRegister = async (userData) => {
        setLoading(true);
        try {
            console.log('📝 Attempting registration...', `${API_URL}/api/auth/register`);
            console.log('📝 Registration data:', userData);

            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            //  Always parse JSON to access the server-provided message
            const data = await response.json();

            if (!response.ok) {
                console.error('❌ Registration failed:', response.status, data.message);
                return {
                    success: false,
                    message: data.message || 'שגיאה בהרשמה. אנא נסה שנית.'
                };
            }

            console.log('📝 Registration response:', data);

            if (data.success) {
                if (!data.user || !data.user._id) {
                    console.error('❌ Invalid user data from server:', data);
                    return { success: false, message: 'שגיאה בנתוני השרת - חסר מידע משתמש' };
                }

                const userId = data.user._id;
                localStorage.setItem('userId', userId);
                localStorage.setItem('token', data.token);
                localStorage.setItem('userType', data.user.userType);

                const userWithToken = { ...data.user, token: data.token };
                setUser(userWithToken);
                setIsInitialized(true);

                const targetPath = getDashboardPath(data.user.userType);
                console.log('🚀 Navigating to:', targetPath);
                navigate(targetPath, { replace: true });

                return { success: true };
            } else {
                return { success: false, message: data.message || 'שגיאה בהרשמה' };
            }
        } catch (error) {
            console.error('❌ Register error:', error);
            return {
                success: false,
                message: 'בעיית תקשורת עם השרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.'
            };
        } finally {
            setLoading(false);
        }
    };

    /**
     * Logs the current user out by clearing persisted data and redirecting to /login.
     */
    const handleLogout = useCallback(() => {
        console.log('👋 Logging out...');
        clearAppStorage();
        setUser(null);
        navigate('/login', { replace: true });
    }, [navigate]);

    /**
     * Nuclear option: clears all storage, resets React state, and hard-reloads
     * the page. Useful for recovering from corrupted client-side state.
     */
    const forceRefresh = useCallback(() => {
        console.log('🔄 Force refreshing app state...');
        clearAppStorage();
        setUser(null);
        setIsInitialized(false);
        setLoading(true);
        window.location.reload();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isInitialized,
                handleLogin,
                handleRegister,
                handleLogout,
                loadUserFromToken,
                forceRefresh,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

/**
 * Convenience hook for consuming AuthContext.
 * Throws if called outside of an AuthProvider.
 *
 * @returns {{ user: object|null, loading: boolean, isInitialized: boolean, handleLogin: Function, handleRegister: Function, handleLogout: Function, loadUserFromToken: Function, forceRefresh: Function }}
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
