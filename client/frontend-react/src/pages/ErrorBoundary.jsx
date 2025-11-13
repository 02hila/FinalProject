import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console or external service
    console.error('🔴 Error Boundary caught an error:', error, errorInfo);
    
    // You can also log to an error reporting service here
    // logErrorToService(error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ 
      hasError: false,
      error: null,
      errorInfo: null
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.errorContainer}>
          <div style={styles.errorCard}>
            <div style={styles.errorIcon}>⚠️</div>
            <h1 style={styles.errorTitle}>אופס! משהו השתבש</h1>
            <p style={styles.errorMessage}>
              אירעה שגיאה בלתי צפויה. אנחנו מצטערים על אי הנוחות.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.errorDetails}>
                <summary style={styles.errorSummary}>פרטי השגיאה (Development Mode)</summary>
                <pre style={styles.errorPre}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={styles.buttonGroup}>
              <button 
                onClick={this.handleReset}
                style={styles.primaryButton}
              >
                חזרה לדף הבית
              </button>
              <button 
                onClick={() => window.location.reload()}
                style={styles.secondaryButton}
              >
                רענן את הדף
              </button>
            </div>

            <p style={styles.helpText}>
              אם הבעיה ממשיכה, אנא צור קשר עם התמיכה שלנו.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  errorCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
    direction: 'rtl',
  },
  errorIcon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  errorTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '15px',
  },
  errorMessage: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '30px',
    lineHeight: '1.6',
  },
  errorDetails: {
    marginTop: '20px',
    marginBottom: '20px',
    textAlign: 'right',
    background: '#f5f5f5',
    padding: '15px',
    borderRadius: '8px',
  },
  errorSummary: {
    cursor: 'pointer',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#667eea',
  },
  errorPre: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '12px',
    color: '#e74c3c',
    marginTop: '10px',
    textAlign: 'left',
    direction: 'ltr',
  },
  buttonGroup: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  secondaryButton: {
    background: 'white',
    color: '#667eea',
    border: '2px solid #667eea',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  helpText: {
    fontSize: '14px',
    color: '#999',
    marginTop: '20px',
  },
};

export default ErrorBoundary;