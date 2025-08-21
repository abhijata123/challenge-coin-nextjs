import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Check, Calendar, Heart, MessageCircle, Coins, Users, Loader2, ChevronDown, Globe, MessageCircleQuestion, CornerDownRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useInView } from 'react-intersection-observer';

interface Notification {
  id: string;
  type: 'new_event' | 'new_coin' | 'post_like' | 'post_comment' | 'new_post' | 'comment_like' | 'public_coin' | 'new_question' | 'answer_added';
  content: string;
  reference_id: string | null;
  reference_type: 'event' | 'coin' | 'post' | 'comment' | null;
  read: boolean;
  created_at: string;
  metadata: {
    username?: string;
    public_url?: string;
    is_public?: boolean;
    actor_username?: string;
    made_public_at?: string;
    question_id?: string;
    question?: string;
    answer?: string;
    [key: string]: any;
  };
}

interface NotificationSettings {
  events_enabled: boolean;
  coins_enabled: boolean;
  social_enabled: boolean;
  last_read_at: string | null;
}

const NOTIFICATIONS_PER_PAGE = 20;

export const Notifications: React.FC = () => {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [notifications, setNotifications] = useState<{
    events: Notification[];
    coins: Notification[];
    social: Notification[];
    questions: Notification[];
  }>({
    events: [],
    coins: [],
    social: [],
    questions: []
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const lastTimestamp = useRef<string | null>(null);
  const { ref: loadMoreRef, inView } = useInView();

  const fetchNotifications = async (timestamp?: string) => {
    if (!user?.email) return;

    const isInitialFetch = !timestamp;
    if (isInitialFetch) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // First, fetch notification settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('notification_settings')
        .select('events_enabled, coins_enabled, social_enabled, last_read_at')
        .eq('user_id', user.email)
        .single();

      if (settingsError) {
        console.error('Error fetching notification settings:', settingsError);
        // If settings don't exist, create default settings
        if (settingsError.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('notification_settings')
            .insert({
              user_id: user.email,
              events_enabled: true,
              coins_enabled: true,
              social_enabled: true
            });
          
          if (insertError) {
            console.error('Error creating notification settings:', insertError);
          } else {
            setSettings({
              events_enabled: true,
              coins_enabled: true,
              social_enabled: true,
              last_read_at: null
            });
          }
        }
      } else {
        setSettings(settingsData);
        console.log('Notification settings:', settingsData);
      }

      // Then fetch notifications
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.email)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATIONS_PER_PAGE);

      if (timestamp) {
        query = query.lt('created_at', timestamp);
      }

      const { data, error } = await query;

      if (error) throw error;

      const newNotifications = data || [];
      console.log('Fetched notifications:', newNotifications);
      
      // Update hasMore flag
      setHasMore(newNotifications.length === NOTIFICATIONS_PER_PAGE);

      // Store the timestamp of the last notification
      if (newNotifications.length > 0) {
        lastTimestamp.current = newNotifications[newNotifications.length - 1].created_at;
      }

      // Group notifications by type
      const grouped = newNotifications.reduce((acc, notification) => {
        if (notification.type === 'new_event') {
          acc.events = isInitialFetch ? 
            newNotifications.filter(n => n.type === 'new_event') : 
            [...acc.events, ...newNotifications.filter(n => n.type === 'new_event')];
        } else if (notification.type === 'new_coin' || notification.type === 'public_coin') {
          acc.coins = isInitialFetch ? 
            newNotifications.filter(n => n.type === 'new_coin' || n.type === 'public_coin') : 
            [...acc.coins, ...newNotifications.filter(n => n.type === 'new_coin' || n.type === 'public_coin')];
        } else if (notification.type === 'new_question' || notification.type === 'answer_added') {
          acc.questions = isInitialFetch ? 
            newNotifications.filter(n => n.type === 'new_question' || n.type === 'answer_added') : 
            [...acc.questions, ...newNotifications.filter(n => n.type === 'new_question' || n.type === 'answer_added')];
        } else {
          acc.social = isInitialFetch ? 
            newNotifications.filter(n => ['post_like', 'post_comment', 'new_post', 'comment_like'].includes(n.type)) : 
            [...acc.social, ...newNotifications.filter(n => ['post_like', 'post_comment', 'new_post', 'comment_like'].includes(n.type))];
        }
        return acc;
      }, isInitialFetch ? { events: [], coins: [], social: [], questions: [] } : { ...notifications });

      setNotifications(grouped);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (lastTimestamp.current && !loadingMore && hasMore) {
      fetchNotifications(lastTimestamp.current);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    if (inView) {
      loadMore();
    }
  }, [inView, loadMore]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      subscribeToNotifications();
    }
  }, [user]);

  const subscribeToNotifications = () => {
    if (!user) return;

    const subscription = supabase
      .channel('notifications-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${user.email}`
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => ({
        events: prev.events.map(n => n.id === notificationId ? { ...n, read: true } : n),
        coins: prev.coins.map(n => n.id === notificationId ? { ...n, read: true } : n),
        social: prev.social.map(n => n.id === notificationId ? { ...n, read: true } : n),
        questions: prev.questions.map(n => n.id === notificationId ? { ...n, read: true } : n)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to update notification');
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('mark_notifications_as_read', {
        p_user_id: user.email
      });

      if (error) throw error;

      // Update local state to mark all notifications as read
      setNotifications(prev => ({
        events: prev.events.map(n => ({ ...n, read: true })),
        coins: prev.coins.map(n => ({ ...n, read: true })),
        social: prev.social.map(n => ({ ...n, read: true })),
        questions: prev.questions.map(n => ({ ...n, read: true }))
      }));

      // Update the global unread state in Layout component
      const layoutUpdateEvent = new CustomEvent('notifications-read');
      window.dispatchEvent(layoutUpdateEvent);

      toast.success('All notifications marked as read');
      
      // Reload the page to ensure all UI elements are updated
      window.location.reload();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to update notifications');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_event':
        return <Calendar className="h-6 w-6 text-green-400" />;
      case 'new_coin':
        return <Coins className="h-6 w-6 text-yellow-400" />;
      case 'public_coin':
        return <Globe className="h-6 w-6 text-blue-400" />;
      case 'post_like':
      case 'comment_like':
        return <Heart className="h-6 w-6 text-red-400" />;
      case 'post_comment':
        return <MessageCircle className="h-6 w-6 text-blue-400" />;
      case 'new_post':
        return <Users className="h-6 w-6 text-purple-400" />;
      case 'new_question':
        return <MessageCircleQuestion className="h-6 w-6 text-orange-400" />;
      case 'answer_added':
        return <CornerDownRight className="h-6 w-6 text-green-400" />;
      default:
        return <Bell className="h-6 w-6 text-blue-400" />;
    }
  };

  const getNotificationLink = (notification: Notification) => {
    if (!notification.reference_id || !notification.reference_type) return '#';

    switch (notification.reference_type) {
      case 'event':
        return '/events';
      case 'coin':
        // Use the public URL from metadata if available and coin is public
        if (notification.metadata?.public_url && notification.metadata?.is_public) {
          return notification.metadata.public_url;
        }
        // Otherwise, link to the private coin view
        return `/coin/${notification.reference_id}`;
      case 'post':
      case 'comment':
        return '/';
      default:
        return '#';
    }
  };

  const renderNotificationSection = (title: string, notificationList: Notification[], icon: React.ReactNode) => (
    <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      {notificationList.length > 0 ? (
        <div className="space-y-3">
          {notificationList.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white/5 rounded-lg p-4 transition-colors ${
                notification.read ? 'opacity-75' : 'ring-1 ring-blue-500'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-white/10 rounded-lg">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div>
                    <p className="text-white">{notification.content}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {notification.type === 'public_coin' && notification.metadata?.made_public_at
                        ? `Made public ${formatDistanceToNow(new Date(notification.metadata.made_public_at), { addSuffix: true })}`
                        : formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                    {notification.reference_type && (
                      <Link
                        href={getNotificationLink(notification)}
                        className="text-blue-400 hover:text-blue-300 text-sm inline-block mt-2"
                      >
                        {notification.reference_type === 'coin' && notification.metadata?.is_public
                          ? 'View Public Coin'
                          : notification.reference_type === 'comment'
                          ? 'View Comment'
                          : 'View Details'}
                      </Link>
                    )}
                    {notification.metadata?.actor_username && (
                      <Link
                        href={`/collection/${notification.metadata.actor_username}`}
                        className="text-blue-400 hover:text-blue-300 text-sm inline-block mt-2 ml-4"
                      >
                        View Profile
                      </Link>
                    )}
                    {notification.metadata?.username && (
                      <Link
                        href={`/collection/${notification.metadata.username}`}
                        className="text-blue-400 hover:text-blue-300 text-sm inline-block mt-2 ml-4"
                      >
                        View Profile
                      </Link>
                    )}
                  </div>
                </div>
                {!notification.read && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-4">
          <p>No notifications</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  const hasUnreadNotifications = Object.values(notifications)
    .some(list => list.some(n => !n.read));

  return (
    <div 
      className="min-h-screen bg-[#0d182a] bg-opacity-95 py-8"
      style={{
        backgroundImage: `url('${getBackgroundImage(theme)}')`,
        backgroundBlendMode: 'overlay',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notifications
          </h1>
          {hasUnreadNotifications && (
            <button
              onClick={markAllAsRead}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Mark all as read
            </button>
          )}
        </div>

        {settings && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">Notification Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <span className="text-gray-300">Event Notifications</span>
                <span className={settings.events_enabled ? "text-green-400" : "text-red-400"}>
                  {settings.events_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <span className="text-gray-300">Coin Notifications</span>
                <span className={settings.coins_enabled ? "text-green-400" : "text-red-400"}>
                  {settings.coins_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <span className="text-gray-300">Social Notifications</span>
                <span className={settings.social_enabled ? "text-green-400" : "text-red-400"}>
                  {settings.social_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {renderNotificationSection(
            "Events",
            notifications.events,
            <Calendar className="h-6 w-6 text-green-400" />
          )}
          {renderNotificationSection(
            "New Coins",
            notifications.coins,
            <Coins className="h-6 w-6 text-yellow-400" />
          )}
          {renderNotificationSection(
            "Questions & Answers",
            notifications.questions,
            <MessageCircleQuestion className="h-6 w-6 text-orange-400" />
          )}
          {renderNotificationSection(
            "Social",
            notifications.social,
            <Heart className="h-6 w-6 text-red-400" />
          )}
        </div>

        {hasMore && (
          <div 
            ref={loadMoreRef}
            className="text-center mt-8"
          >
            {loadingMore ? (
              <Loader2 className="h-6 w-6 animate-spin text-white mx-auto" />
            ) : (
              <button
                onClick={loadMore}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mx-auto"
              >
                <ChevronDown className="h-4 w-4" />
                Load More
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};