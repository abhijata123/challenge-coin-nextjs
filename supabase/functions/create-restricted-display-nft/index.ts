import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CoinData {
  id: number;
  name: string;
  image: string;
  description: string;
  publicLink: string;
  dateIssued: string;
  modeOfAcquiring: string;
}

interface WalletData {
  id: number;
  address: string;
  userId: string;
}

interface SupplyData {
  contractName: string;
  packageId: string;
  supplyCapId: string;
  lineageId: string;
  counterId: string;
}

interface RequestPayload {
  coinData: CoinData;
  walletData: WalletData;
  supplyData: SupplyData;
  displayKeys: string[];
  displayValues: string[];
}

// Mock createRestrictedDisplay function - replace with actual implementation
async function createRestrictedDisplay(params: {
  mnemonic: string;
  publisherId: string;
  packageId: string;
  suiNetwork: string;
  displayKeys: string[];
  displayValues: string[];
  braavVersion: string;
}): Promise<string> {
  // This is a placeholder implementation
  // Replace this with your actual Sui blockchain interaction code
  
  console.log('Creating restricted display with params:', {
    ...params,
    mnemonic: '[REDACTED]' // Don't log the actual mnemonic
  });
  
  // Simulate blockchain transaction
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Return a mock display ID
  return `0x${Math.random().toString(16).substring(2, 42)}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Verify this is a POST request
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header required" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication token" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Parse the request body
    const payload: RequestPayload = await req.json();
    
    if (!payload.coinData || !payload.walletData || !payload.supplyData) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required data" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Verify the user owns the selected wallet
    const { data: walletData, error: walletError } = await supabase
      .from("vetting_wallets")
      .select("id, wallet_address, mnemonic, user_id")
      .eq("id", payload.walletData.id)
      .eq("user_id", user.email)
      .single();

    if (walletError || !walletData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Wallet not found or you don't have permission to use this wallet" 
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Verify the user owns the selected coin
    const { data: coinData, error: coinError } = await supabase
      .from("Challenge Coin Table")
      .select("id, UserId")
      .eq("id", payload.coinData.id)
      .eq("UserId", user.email)
      .single();

    if (coinError || !coinData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Coin not found or you don't have permission to use this coin" 
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get environment variables for blockchain interaction
    const publisherId = Deno.env.get("PUBLISHER_ID");
    const packageId = Deno.env.get("PACKAGE_ID") || payload.supplyData.packageId;
    const suiNetwork = Deno.env.get("SUI_NETWORK") || "https://fullnode.testnet.sui.io";
    const braavVersion = Deno.env.get("BRAAV_VERSION") || "v1";

    if (!publisherId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server configuration error: PUBLISHER_ID not set" 
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Call the createRestrictedDisplay function
    const restrictedNftDisplayId = await createRestrictedDisplay({
      mnemonic: walletData.mnemonic,
      publisherId,
      packageId,
      suiNetwork,
      displayKeys: payload.displayKeys,
      displayValues: payload.displayValues,
      braavVersion
    });

    // Log the successful creation (without sensitive data)
    console.log(`Restricted NFT display created successfully for user ${user.email}:`, {
      coinId: payload.coinData.id,
      coinName: payload.coinData.name,
      walletAddress: walletData.wallet_address,
      displayId: restrictedNftDisplayId
    });

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        restrictedNftDisplayId,
        message: "Restricted NFT display created successfully"
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Error in create-restricted-display-nft function:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});