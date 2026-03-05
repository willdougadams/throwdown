import React from 'react';
import { useNetwork, Network } from '../contexts/NetworkContext';
import { theme } from '../theme';
import { Globe } from 'lucide-react';

const NetworkSelector: React.FC = () => {
  const { network, customRpcUrl, setNetwork, setCustomRpcUrl, applyCustomRpc } = useNetwork();

  const networks: { value: Network; label: string; color: string }[] = [
    { value: 'localnet', label: 'Localnet', color: '#9c27b0' },
    { value: 'devnet', label: 'Devnet', color: '#ff9800' },
    { value: 'mainnet-beta', label: 'Mainnet', color: '#4caf50' },
    { value: 'custom', label: 'Custom', color: '#3f51b5' },
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
        width: '100%',
        flexWrap: 'wrap'
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
              whiteSpace: 'nowrap',
              minWidth: '60px'
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

      {network === 'custom' && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              placeholder="Custom RPC URL"
              value={customRpcUrl}
              onChange={(e) => setCustomRpcUrl(e.target.value)}
              style={{
                flex: 1,
                padding: '0.4rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: theme.colors.background,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                outline: 'none'
              }}
            />
            <button
              onClick={() => applyCustomRpc()}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: theme.colors.primary.main,
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Apply
            </button>
          </div>
          <div style={{
            fontSize: '0.6rem',
            color: theme.colors.text.disabled,
            marginTop: '0.25rem'
          }}>
            Paste URL and click Apply to refresh
          </div>
        </div>
      )}

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
