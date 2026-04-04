import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#F5F0E8',
      padding: '24px',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: 500,
      }}>
        {/* 404 Heading */}
        <h1 style={{
          fontSize: 120,
          fontWeight: 700,
          color: '#8B9E7E',
          margin: '0 0 16px 0',
          lineHeight: 1,
        }}>
          404
        </h1>

        {/* Title */}
        <h2 style={{
          fontSize: 32,
          fontWeight: 600,
          color: '#2C2C2C',
          margin: '0 0 12px 0',
        }}>
          This page doesn't exist
        </h2>

        {/* Subtext */}
        <p style={{
          fontSize: 16,
          color: '#666',
          margin: '0 0 40px 0',
          lineHeight: 1.6,
        }}>
          The page you're looking for may have been moved or doesn't exist.
        </p>

        {/* Back to Home Button */}
        <button
          onClick={() => navigate('/')}
          style={{
            backgroundColor: '#C4844E',
            color: 'white',
            border: 'none',
            padding: '12px 32px',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#B0743F';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#C4844E';
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
