/**
 * Utility functions for interacting with Venly Connect
 */

// Get the Venly Connect instance
export const getVenlyConnect = () => {
  if (typeof window === 'undefined') {
    throw new Error('Venly Connect is only available in browser environments');
  }
  
  if (!window.venlyConnect) {
    throw new Error('Venly Connect is not initialized');
  }
  
  return window.venlyConnect;
};

// Example function to get Venly wallets
export const getVenlyWallets = async () => {
  try {
    const venlyConnect = getVenlyConnect();
    const walletClient = await venlyConnect.createWalletClient();
    const wallets = await walletClient.getWallets();
    return wallets;
  } catch (error) {
    console.error('Error getting Venly wallets:', error);
    throw error;
  }
};

// Example function to create a Venly wallet
export const createVenlyWallet = async (walletType: string, description: string) => {
  try {
    const venlyConnect = getVenlyConnect();
    const walletClient = await venlyConnect.createWalletClient();
    const wallet = await walletClient.createWallet(walletType, description);
    return wallet;
  } catch (error) {
    console.error('Error creating Venly wallet:', error);
    throw error;
  }
};

// Example function to view a Venly wallet
export const viewVenlyWallet = async (walletId: string) => {
  try {
    const venlyConnect = getVenlyConnect();
    const walletClient = await venlyConnect.createWalletClient();
    const wallet = await walletClient.getWallet(walletId);
    return wallet;
  } catch (error) {
    console.error('Error viewing Venly wallet:', error);
    throw error;
  }
};