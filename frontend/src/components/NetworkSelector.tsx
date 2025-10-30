import React from 'react';
import { useNetwork, Network } from '../contexts/NetworkContext';
import { theme } from '../theme';
import { Globe } from 'lucide-react';

const NetworkSelector: React.FC = () => {
  const { network, setNetwork } = useNetwork();

  const networks: { value: Network; label: string; color: string }[] = [
    { value: 'localnet', label: 'Localnet', color: '#9c27b0' },
    { value: 'devnet', label: 'Devnet', color: '#ff9800' },
    { value: 'mainnet-beta', label: 'Mainnet', color: '#4caf50' },
  ];

  return (
    <div style={{
      padding: '0.75rem',
      backgroundColor: theme.colors.card,
      borderRadius: '6px',
      border: `1px solid ${theme.colors.border}`,
      marginBottom: '0.75rem'
    }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: theme.colors.text.secondary,
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem'
      }}>
        <Globe size={12} />
        Network
      </div>

      <div style={{
        display: 'flex',
        gap: '0.25rem',
        width: '100%'
      }}>
        {networks.map((net) => (
          <button
            key={net.value}
            onClick={() => setNetwork(net.value)}
            style={{
              flex: 1,
              padding: '0.4rem 0.25rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              backgroundColor: network === net.value ? net.color : theme.colors.background,
              color: network === net.value ? 'white' : theme.colors.text.secondary,
              border: `1px solid ${network === net.value ? net.color : theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (network !== net.value) {
                e.currentTarget.style.backgroundColor = theme.colors.surface;
              }
            }}
            onMouseLeave={(e) => {
              if (network !== net.value) {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }
            }}
          >
            {net.label}
          </button>
        ))}
      </div>

      {network === 'localnet' && (
        <div style={{
          fontSize: '0.65rem',
          color: theme.colors.text.disabled,
          marginTop: '0.5rem',
          fontStyle: 'italic'
        }}>
          Local validator required
        </div>
      )}
    </div>
  );
};

export default NetworkSelector;
