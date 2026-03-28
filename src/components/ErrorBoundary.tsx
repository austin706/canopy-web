import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Unknown error';
      return (
        this.props.fallback || (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: '#f8f7f5',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '20px',
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
              textAlign: 'center',
              maxWidth: '420px',
              width: '100%',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: '#FFEBEE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 24,
              }}>!</div>
              <h1 style={{ color: '#d32f2f', marginBottom: '8px', fontSize: '20px' }}>
                Something went wrong
              </h1>
              <p style={{
                color: '#888',
                marginBottom: '20px',
                fontSize: '14px',
                lineHeight: '1.5',
              }}>
                {errorMsg.length > 150 ? errorMsg.slice(0, 150) + '...' : errorMsg}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={this.handleReset}
                  style={{
                    backgroundColor: '#B87333',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleGoHome}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#B87333',
                    border: '1px solid #B87333',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Go to Dashboard
                </button>
              </div>

              {this.state.error && (
                <div style={{ marginTop: '16px' }}>
                  <button
                    onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                    style={{
                      background: 'none', border: 'none', color: '#aaa',
                      fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >
                    {this.state.showDetails ? 'Hide details' : 'Show error details'}
                  </button>
                  {this.state.showDetails && (
                    <pre style={{
                      backgroundColor: '#f5f5f5',
                      padding: '12px',
                      borderRadius: '8px',
                      textAlign: 'left',
                      fontSize: '11px',
                      overflow: 'auto',
                      marginTop: '8px',
                      maxHeight: '160px',
                      color: '#666',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {this.state.error.toString()}
                      {this.state.error.stack && '\n\n' + this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
