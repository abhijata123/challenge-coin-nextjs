import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { getVenlyConnect } from '../utils/venly';

interface VenlyWalletButtonProps {
  className?: string;
}

export const VenlyWalletButton: React.FC<VenlyWalletButtonProps> = ({ className = '' }) => {
  const [loading, setLoading] = useState(false);

  const handleOpenWallet = async () => {
    try {
      setLoading(true);
      const venlyConnect = getVenlyConnect();
      
      // Get the wallet client
      const walletClient = await venlyConnect.createWalletClient();
      
      // Get user's wallets
      const wallets = await walletClient.getWallets();
      
      if (wallets.length === 0) {
        // If no wallets, create one
        const result = await walletClient.createWallet('MATIC', 'My Challenge Coin Wallet');
        toast.success('Wallet created successfully!');
        console.log('Wallet created:', result);
      } else {
        // If wallets exist, open the wallet management
        await venlyConnect.manageWallets();
      }
    } catch (error) {
      console.error('Error opening Venly wallet:', error);
      toast.error('Failed to open wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleOpenWallet}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors ${className}`}
    >
      <Wallet size={18} />
      {loading ? 'Loading...' : 'Manage Wallet'}
    </button>
  );
};