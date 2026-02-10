import React from 'react';
import Layout from '../components/Layout';
import { GreatBanyanGame } from '../components/great_banyan';
import { theme } from '../theme';

const GreatBanyanPage: React.FC = () => {
    return (
        <Layout>
            <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ color: theme.colors.text.primary, margin: '0 0 1rem 0' }}>The Great Banyan</h1>
                <div style={{ flex: 1, minHeight: 0 }}>
                    <GreatBanyanGame />
                </div>
            </div>
        </Layout>
    );
};

export default GreatBanyanPage;
