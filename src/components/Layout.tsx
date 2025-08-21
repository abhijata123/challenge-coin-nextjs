import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Menu, X, Globe, Trophy, Send, Search, MessageSquare, ChevronDown, Bell, MessageCircle, Coins, Wand2, Upload, Calendar, Shield, UserCheck, Wallet, Package, Image } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Logo } from './Logo';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';
import { UserBadges } from './UserBadges';
import { MessageNotification } from './MessageNotification';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const { isAdmin } = useAdminStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [isCometChatInitialized, setIsCometChatInitialized] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isVettingAdmin, setIsVettingAdmin] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationSoundRef = useRef<HTMLAudioElement>(null);
  const [notification, setNotification] = useState<{
    sender: { name: string; avatar?: string; uid: string };
    message: string;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Listen for the custom event from Notifications component
    const handleNotificationsRead = () => {
      setHasUnread(false);
    };

    window.addEventListener('notifications-read', handleNotificationsRead);
    
    return () => {
      window.removeEventListener('notifications-read', handleNotificationsRead);
    };
  }, []);

  useEffect(() => {
    if (user && !isCometChatInitialized) {
      let retryCount = 0;
      const maxRetries = 3;
      const retryInterval = 1000;

      const initChat = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const response = await fetch(`https://27191081cbac1c5c.api-us.cometchat.io/v3/users/${user.id}`, {
            method: 'GET',
            headers: {
              'apikey': '8beed8636a0f5e5496294ba8a66fb0826e912203',
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error('CometChat user not found');
          }

          await (window as any).CometChatWidget.init({
            "appID": "27191081cbac1c5c",
            "appRegion": "us",
            "authKey": "9060f5983cf2e4050738658b003b5b60573589b9"
          });

          await (window as any).CometChatWidget.login({
            "uid": user.id
          });

          await (window as any).CometChatWidget.launch({
            "widgetID": "15b02a26-ed76-4990-86b8-2868c0af2815",
            "docked": "true",
            "alignment": "left",
            "roundedCorners": "true",
            "height": "450px",
            "width": "400px",
            "defaultID": 'cometchat-uid-1',
            "defaultType": 'user'
          }).then(() => {
            // Add message listener
            (window as any).CometChatWidget.on("onMessageReceived", (message: any) => {
              console.log("CometChatWidget onMessageReceived", message);
              
              // Play notification sound
              if (notificationSoundRef.current) {
                notificationSoundRef.current.volume = 0.5; // Set volume to 50%
                notificationSoundRef.current.play().catch(err => {
                  console.error("Error playing notification sound:", err);
                });
              }
              
              // Show popup notification
              setNotification({
                sender: {
                  name: message.sender.name || message.sender.uid,
                  avatar: message.sender.avatar,
                  uid: message.sender.uid
                },
                message: message.text || "New message"
              });
            });
          });

          setIsCometChatInitialized(true);
        } catch (error) {
          console.error("CometChat initialization error:", error);
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(initChat, retryInterval);
          }
        }
      };

      initChat();
    }
  }, [user, isCometChatInitialized]);

  useEffect(() => {
    if (user) {
      fetchUsername();
      checkUnreadNotifications();
      subscribeToNotifications();
      checkVettingAdminStatus();
    }
  }, [user]);

  const fetchUsername = async () => {
    if (!user?.email) return;
    
    const { data, error } = await supabase
      .from('User Dps')
      .select('Username')
      .eq('email', user.email)
      .single();

    if (!error && data) {
      setUsername(data.Username);
      setProfile(data);
    }
  };

  const checkUnreadNotifications = async () => {
    if (!user?.email) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('recipient_id', user.email)
        .eq('read', false);

      if (error) throw error;
      setHasUnread(!!count && count > 0);
    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  };

  const checkVettingAdminStatus = () => {
    if (!user?.email) return;
    
    const vettingAdmins = [
      'anna+test@braav.co',
      'abhijatasen18+charlotte@gmail.com',
      'ashleyblewis@gmail.com'
    ];
    
    setIsVettingAdmin(vettingAdmins.includes(user.email));
  };

  const subscribeToNotifications = () => {
    if (!user) return;

    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${user.email}`
      }, () => {
        checkUnreadNotifications();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleLogout = async () => {
    try {
      if (isCometChatInitialized) {
        await (window as any).CometChatWidget.logout();
        setIsCometChatInitialized(false);
      }
      
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="animate-spin text-white">
          <Logo />
        </div>
      </div>
    );
  }

  const navigationItems = [
    { to: "/my-collection", icon: <Coins className="h-4 w-4 mr-1" />, label: "My Collection" },
    { to: "/profile", icon: <User className="h-4 w-4 mr-1" />, label: "My Profile" },
    ...(isAdmin ? [
      { to: "/create", icon: <Wand2 className="h-4 w-4 mr-1" />, label: "Create A Coin" },
    ] : []),
    { to: "/upload", icon: <Upload className="h-4 w-4 mr-1" />, label: "Upload Coin" },
    { to: "/send", icon: <Send className="h-4 w-4 mr-1" />, label: "Send Coins" },
  ];

  const exploreItems = [
    { to: "/forum", icon: <MessageSquare className="h-4 w-4" />, label: "Coin Forum" },
    { to: "/events", icon: <Calendar className="h-4 w-4" />, label: "Events" },
    { to: "/leaderboard", icon: <Trophy className="h-4 w-4" />, label: "Leaderboard" },
    { to: "/search", icon: <Search className="h-4 w-4" />, label: "Search Users" },
    { to: "/create-supply", icon: <Package className="h-4 w-4" />, label: "Create Supply" },
    { to: "/mint-nfts", icon: <Coins className="h-4 w-4" />, label: "Mint NFTs" },
    { to: "/display-nft", icon: <Image className="h-4 w-4" />, label: "Display NFT" },
    { to: "/display-restricted-nft", icon: <Shield className="h-4 w-4" />, label: "Display Restricted NFT" },
    { to: "/create-wallet", icon: <Wallet className="h-4 w-4" />, label: "Create Wallet" },
    { to: "/submit-vetting-requests", icon: <Shield className="h-4 w-4" />, label: "Become a Creator" },
  ];

  return (
    <div className="min-h-screen bg-[#0d182a]">
      {/* Hidden audio element for notification sound */}
      <audio ref={notificationSoundRef} preload="auto">
        <source src="/notification.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>

      {notification && (
        <MessageNotification 
          sender={notification.sender}
          message={notification.message}
          onClose={() => setNotification(null)}
          onClick={() => {
            (window as any).CometChatWidget.chatWithUser(notification.sender.uid);
            setNotification(null);
          }}
        />
      )}

      <nav className="bg-[#0d182a]/95 backdrop-blur-sm border-b border-white/10 fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <Logo showText={false} />
              </Link>
            </div>
            
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-300 hover:text-white p-2"
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>

            <div className="hidden sm:flex items-center space-x-4">
              {user ? (
                <>
                  {navigationItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium inline-flex items-center"
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}

                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium inline-flex items-center gap-1"
                    >
                      Explore
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-gray-900/95 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                        {exploreItems.map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                          >
                            {item.icon}
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {username && (
                    <Link
                      to={`/collection/${username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium inline-flex items-center"
                    >
                      <Globe className="h-4 w-4 mr-1" />
                      Public Page
                    </Link>
                  )}

                  <div className="flex items-center space-x-3 ml-4">
                    <Link
                      to="/notifications"
                      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium inline-flex items-center"
                    >
                      <div className="relative">
                        <Bell className="h-5 w-5" />
                        {hasUnread && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                    </Link>
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <img
                          src={profile?.['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.Username || 'User'}`}
                          alt={profile?.Username || 'Profile'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                        />
                      </div>
                      {profile && (
                        <div className="absolute -bottom-1 -right-1">
                          <UserBadges 
                            isAdmin={profile.is_admin} 
                            isFoundingMember={profile.is_founding_member}
                            size={12}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium inline-flex items-center"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link
                    to="/login"
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`sm:hidden ${isMenuOpen ? 'block' : 'hidden'}`}>
          <div className="px-2 pt-2 pb-3 space-y-1 bg-[#0d182a]/95 backdrop-blur-sm border-b border-white/10">
            {user ? (
              <>
                {navigationItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </div>
                  </Link>
                ))}

                {exploreItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </div>
                  </Link>
                ))}

                {isVettingAdmin && (
                  <Link
                    to="/admin/vetting-dashboard"
                    className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Vetting Dashboard
                    </div>
                  </Link>
                )}

                {username && (
                  <Link
                    href={`/collection/${username}`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Public Page
                    </div>
                  </Link>
                )}

                <Link
                  to="/notifications"
                  className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Bell className="h-4 w-4" />
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                    <span>Notifications</span>
                    {hasUnread && (
                      <span className="h-2 w-2 bg-red-500 rounded-full" />
                    )}
                  </div>
                </Link>

                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-300 hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium"
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </div>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="pt-20">
        {children}
      </main>
    </div>
  );
}