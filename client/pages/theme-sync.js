// theme-sync.js
// ========================================
// Theme Management System with Cross-Tab Sync
// ========================================

// Apply theme immediately on page load to prevent flash
(function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        document.body.classList.add('dark-mode');
    }
})();

// Load preferences
function loadPreferences() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedLang = localStorage.getItem('language') || 'he';
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('themeToggle');
        const icon = document.querySelector('.theme-icon');
        if (toggle) toggle.classList.add('active');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
    
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = savedLang;
    }
    
    if (savedLang === 'ar') {
        document.documentElement.setAttribute('dir', 'rtl');
    } else if (savedLang !== 'he') {
        document.documentElement.setAttribute('dir', 'ltr');
    }
}

// Toggle theme function
function toggleTheme() {
    const body = document.body;
    const toggle = document.getElementById('themeToggle');
    const icon = document.querySelector('.theme-icon');
    
    body.classList.toggle('dark-mode');
    if (toggle) toggle.classList.toggle('active');
    
    const newTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
    
    if (newTheme === 'dark') {
        localStorage.setItem('theme', 'dark');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    } else {
        localStorage.setItem('theme', 'light');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
    
    // Broadcast to other tabs
    if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('theme-channel');
        channel.postMessage({ type: 'theme-change', theme: newTheme });
        channel.close();
    }
}

// Change language function
function changeLanguage(lang) {
    localStorage.setItem('language', lang);
    
    if (lang === 'he' || lang === 'ar') {
        document.documentElement.setAttribute('dir', 'rtl');
    } else {
        document.documentElement.setAttribute('dir', 'ltr');
    }
    
    location.reload();
}

// Listen for theme changes from other tabs (storage event)
window.addEventListener('storage', function(e) {
    if (e.key === 'theme' && e.newValue) {
        const body = document.body;
        const toggle = document.getElementById('themeToggle');
        const icon = document.querySelector('.theme-icon');
        
        if (e.newValue === 'dark') {
            body.classList.add('dark-mode');
            if (toggle) toggle.classList.add('active');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        } else {
            body.classList.remove('dark-mode');
            if (toggle) toggle.classList.remove('active');
            if (icon) {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        }
    }
});

// Listen for theme changes via BroadcastChannel
if ('BroadcastChannel' in window) {
    const themeChannel = new BroadcastChannel('theme-channel');
    themeChannel.addEventListener('message', function(e) {
        if (e.data.type === 'theme-change') {
            const body = document.body;
            const toggle = document.getElementById('themeToggle');
            const icon = document.querySelector('.theme-icon');
            
            if (e.data.theme === 'dark') {
                body.classList.add('dark-mode');
                if (toggle) toggle.classList.add('active');
                if (icon) {
                    icon.classList.remove('fa-moon');
                    icon.classList.add('fa-sun');
                }
            } else {
                body.classList.remove('dark-mode');
                if (toggle) toggle.classList.remove('active');
                if (icon) {
                    icon.classList.remove('fa-sun');
                    icon.classList.add('fa-moon');
                }
            }
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadPreferences);