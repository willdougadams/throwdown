import { connection, programIds, Deserializer } from './solana';
import { PublicKey } from '@solana/web3.js';
import { Response } from 'express';

// Events we can broadcast over SSE
export type BanyanEvent = 
    | { type: 'manager', data: any }
    | { type: 'tree', epoch: string, data: any, address: string }
    | { type: 'bud', address: string, data: any };

class SubscriptionManager {
    private isListening = false;
    private clients: Set<Response> = new Set();
    private subscriptionId: number | null = null;
    
    // Quick cache of discriminators from Deserializer context if possible, 
    // but easier to try deserializing and seeing what works based on data size or discriminator
    // Manager: 8 + 32 + 8 + 8 + 8 = 64 bytes minimum? actually looking at rust struct...
    
    public startListening() {
        if (this.isListening) return;
        
        console.log(`[SubscriptionManager] Starting Banyan program subscription on ${programIds.banyan.toBase58()}...`);
        this.subscriptionId = connection.onProgramAccountChange(
            programIds.banyan,
            (updatedAccountInfo, context) => {
                this.handleAccountUpdate(updatedAccountInfo.accountId, updatedAccountInfo.accountInfo.data);
            },
            'confirmed'
        );
        this.isListening = true;
    }

    public stopListening() {
        if (this.subscriptionId !== null) {
            connection.removeProgramAccountChangeListener(this.subscriptionId);
            this.subscriptionId = null;
        }
        this.isListening = false;
        
        // Close all clients
        for (const client of this.clients) {
            client.end();
        }
        this.clients.clear();
    }

    public addClient(res: Response) {
        this.clients.add(res);
        res.on('close', () => {
            this.clients.delete(res);
        });
    }

    public broadcast(event: BanyanEvent) {
        if (this.clients.size === 0) return;
        
        const message = `data: ${JSON.stringify(event)}\n\n`;
        for (const client of this.clients) {
            client.write(message);
        }
    }

    private handleAccountUpdate(accountId: PublicKey, data: Buffer) {
        try {
            // Let's try to determine what type of account it is based on length or anchor discriminator.
            // Anchor discriminators are the first 8 bytes.
            
            // Try Bud (8 + 32 + 32 + 8 + 1) = 81 bytes usually
            try {
                const bud = Deserializer.deserializeBud(data);
                if (bud) {
                    this.broadcast({
                        type: 'bud',
                        address: accountId.toBase58(),
                        data: bud
                    });
                    return;
                }
            } catch (e) {}

            // Try Tree
            try {
                const tree = Deserializer.deserializeTree(data);
                if (tree && tree.epoch) {
                    this.broadcast({
                        type: 'tree',
                        epoch: tree.epoch.toString(),
                        address: accountId.toBase58(),
                        data: tree
                    });
                    return;
                }
            } catch (e) {}

            // Try Manager
            try {
                const manager = Deserializer.deserializeGameManager(data);
                if (manager) {
                    this.broadcast({
                        type: 'manager',
                        data: manager
                    });
                    return;
                }
            } catch (e) {}
            
        } catch (error) {
            console.error(`[SubscriptionManager] Failed to process account update for ${accountId.toBase58()}`, error);
        }
    }
}

export const subscriptionManager = new SubscriptionManager();
