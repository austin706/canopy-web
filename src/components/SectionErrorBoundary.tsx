import React, { ErrorInfo, ReactNode } from 'react';
import logger from '@/utils/logger';

interface Props {
  children: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export default class SectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(`SectionErrorBoundary (${this.props.sectionName || 'Unknown'}) caught an error:`, error, errorInfo);
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An error occurred in this section';
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          margin: '16px 0',
        }}>
          <div style={{
            backgroundColor: '#FFF5F0',
            border: '1px solid #C4844E',
            borderRadius: '12px',
            padding: '16px',
            width: '100%',
            maxWidth: '500px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#C4844E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 20,
              color: 'white',
            }}>
              !
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                color: '#C4844E',
                fontSize: '14px',
                fontWeight: '600',
                margin: '0 0 4px 0',
              }}>
                {this.props.sectionName ? `${this.props.sectionName} Error` : 'Section Error'}
              </h3>
              <p style={{
                color: '#666',
                fontSize: '13px',
                margin: '0 0 12px 0',
                lineHeight: '1.4',
              }}>
                {errorMsg.length > 100 ? errorMsg.slice(0, 100) + '...' : errorMsg}
              </p>
              <button
                onClick={this.handleRetry}
                style={{
                  backgroundColor: '#C4844E',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
