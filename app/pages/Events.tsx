import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Users, Plus, Search, Filter, List, CalendarDays, ExternalLink, ArrowRight, AlertCircle, UserCircle, Coins, Trash2, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import { format, parseISO, isAfter, addHours } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import toast from 'react-hot-toast';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago', 
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Puerto_Rico',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland'
];

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  timezone: string;
  location: string;
  type: 'online' | 'in-person';
  max_attendees: number;
  current_attendees: number;
  host_id: string;
  requires_coin: boolean;
  coin_type: string | null;
  created_at: string;
  host: {
    Username: string;
    'piture link': string | null;
  };
}

interface Attendee {
  user_id: string;
  created_at: string;
  user: {
    Username: string;
    'piture link': string | null;
    Status: string | null;
  };
}

interface UserCoin {
  id: number;
  'Coin Name': string;
  'Coin Image': string;
  'Number Of Coins': number;
}

export const Events: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isAdmin } = useAdminStore();
  const { theme } = useThemeStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<'all' | 'online' | 'in-person'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [userCoins, setUserCoins] = useState<UserCoin[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<UserCoin | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [userOwnedCoins, setUserOwnedCoins] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: '',
    type: 'in-person' as 'online' | 'in-person',
    max_attendees: 10,
    requires_coin: false,
    coin_type: ''
  });

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchRegisteredEvents();
      fetchUserOwnedCoins();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUserCoins();
    }
  }, [user]);

  const fetchUserOwnedCoins = async () => {
    if (!user?.email) return;

    try {
      const { data, error } = await supabase
        .from('Challenge Coin Table')
        .select('Coin Name')
        .eq('UserId', user.email);

      if (error) throw error;
      setUserOwnedCoins(new Set(data?.map(coin => coin['Coin Name']) || []));
    } catch (error) {
      console.error('Error fetching user owned coins:', error);
    }
  };

  const fetchUserCoins = async () => {
    if (!user?.email) return;

    try {
      const { data, error } = await supabase
        .from('Challenge Coin Table')
        .select('id, "Coin Name", "Coin Image", "Number Of Coins"')
        .eq('UserId', user.email)
        .gt('Number Of Coins', 0);

      if (error) throw error;
      setUserCoins(data || []);
    } catch (error) {
      console.error('Error fetching user coins:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          host:host_id(
            Username,
            "piture link"
          )
        `)
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    setDeleting(eventId);
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      
      setEvents(events.filter(event => event.id !== eventId));
      toast.success('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    } finally {
      setDeleting(null);
    }
  };

  const fetchRegisteredEvents = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', user.email);

      if (error) throw error;
      setRegisteredEvents(new Set(data?.map(r => r.event_id)));
    } catch (error) {
      console.error('Error fetching registered events:', error);
    }
  };

  const fetchAttendees = async (eventId: string) => {
    setLoadingAttendees(true);
    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select(`
          user_id,
          created_at,
          user:user_id (
            Username,
            "piture link",
            Status
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAttendees(data || []);
    } catch (error) {
      console.error('Error fetching attendees:', error);
      toast.error('Failed to load attendees');
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleRegister = async (eventId: string) => {
    if (!user) {
      toast.error('Please log in to register for events');
      return;
    }

    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      if (event.current_attendees >= event.max_attendees) {
        toast.error('Event is full');
        return;
      }

      // Check if the event requires a coin and verify user has it
      if (event.requires_coin && event.coin_type) {
        const { data: userCoins, error: coinsError } = await supabase
          .from('Challenge Coin Table')
          .select('id')
          .eq('UserId', user.email)
          .eq('Coin Name', event.coin_type)
          .gt('Number Of Coins', 0);

        if (coinsError) throw coinsError;

        if (!userCoins?.length) {
          toast.error(`You need the "${event.coin_type}" coin to register for this event`);
          return;
        }
      }

      // Get user's full name
      const { data: userData, error: userError } = await supabase
        .from('User Dps')
        .select('Username')
        .eq('email', user.email)
        .single();

      if (userError) throw userError;

      // Register for the event
      const { error } = await supabase
        .from('event_attendees')
        .insert({
          event_id: eventId,
          user_id: user.email
        });

      if (error) throw error;

      // Send registration data to webhook
      await fetch('https://hook.us2.make.com/7jf1y2h7ea6ib2ua5ul89j3ftjo7a9ia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: userData.Username,
          userEmail: user.email,
          eventDetails: {
            organizerName: event.host.Username,
            eventDate: format(parseISO(event.date), 'MMMM d, yyyy'),
            eventTime: event.time,
            eventAddress: event.location,
            eventTitle: event.title,
            eventDescription: event.description,
            additionalDetails: event.type === 'online' ? 'Online Event' : 'In-Person Event'
          },
          registrationTimestamp: new Date().toISOString()
        }),
      });

      setRegisteredEvents(prev => new Set([...prev, eventId]));
      toast.success('Successfully registered for event');
      
      setEvents(events.map(e => 
        e.id === eventId 
          ? { ...e, current_attendees: e.current_attendees + 1 }
          : e
      ));
    } catch (error) {
      console.error('Error registering for event:', error);
      toast.error('Failed to register for event');
    }
  };

  const handleUnregister = async (eventId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.email);

      if (error) throw error;

      setRegisteredEvents(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      toast.success('Successfully unregistered from event');
      
      setEvents(events.map(e => 
        e.id === eventId 
          ? { ...e, current_attendees: e.current_attendees - 1 }
          : e
      ));
    } catch (error) {
      console.error('Error unregistering from event:', error);
      toast.error('Failed to unregister from event');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) {
      toast.error('Only administrators can create events');
      return;
    }

    if (formData.requires_coin && !selectedCoin) {
      toast.error('Please select a required coin');
      return;
    }

    try {
      const { error } = await supabase
        .from('events')
        .insert({
          ...formData,
          coin_type: selectedCoin?.['Coin Name'] || null,
          host_id: user.email
        });

      if (error) {
        if (error.code === '42501') {
          toast.error('You do not have permission to create events');
          return;
        }
        throw error;
      }

      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: '',
        type: 'in-person',
        max_attendees: 10,
        requires_coin: false,
        coin_type: ''
      });
      setSelectedCoin(null);
      toast.success('Event created successfully');
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  const generateGoogleCalendarUrl = (event: Event) => {
    // Parse the event date and time
    const eventDate = parseISO(event.date);
    const [hours, minutes] = event.time.split(':').map(Number);
    
    // Create start and end date (assuming 1 hour duration)
    const startDate = new Date(eventDate);
    startDate.setHours(hours, minutes);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1);
    
    // Format dates for Google Calendar
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };
    
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    // Build the URL
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${startDateStr}/${endDateStr}`,
      details: event.description,
      location: event.location,
      ctz: event.timezone
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Initialize filteredEvents before using it
  const filteredEvents = events.filter(event => {
    const matchesFilter = filter === 'all' || event.type === filter;
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Filter for upcoming events
  const upcomingEvents = filteredEvents.filter(event => 
    isAfter(parseISO(event.date), new Date())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading events...</div>
      </div>
    );
  }

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-white">Events Calendar</h1>
          {isAdmin ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Create Event
            </button>
          ) : (
            <div className="relative group">
              <button
                disabled
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg opacity-50 cursor-not-allowed"
              >
                <Plus className="h-5 w-5" />
                Create Event
              </button>
              <div className="absolute bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-400" />
                  <span>Admin access required</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded-lg ${
                  view === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <List className="h-5 w-5" />
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`p-2 rounded-lg ${
                  view === 'calendar' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <CalendarDays className="h-5 w-5" />
              </button>
              <div className="h-6 w-px bg-gray-700" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="bg-gray-800 text-white border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Events</option>
                <option value="in-person">In-Person</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search events..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            </div>
          </div>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No upcoming events found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-white/10 transition-colors"
              >
                <div className="p-6 space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl font-semibold text-white">{event.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      event.type === 'online' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {event.type === 'online' ? 'Online' : 'In-Person'}
                    </span>
                  </div>

                  <p className="text-gray-400 line-clamp-2">{event.description}</p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Calendar className="h-4 w-4 text-blue-400" />
                      <span>{format(parseISO(event.date), 'MMMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock className="h-4 w-4 text-blue-400" />
                      <span>{event.time} {event.timezone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin className="h-4 w-4 text-blue-400" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span>{event.current_attendees} / {event.max_attendees} attendees</span>
                    </div>
                    {event.requires_coin && event.coin_type && (
                      <div className="flex items-center gap-2 text-gray-300 bg-yellow-500/10 p-2 rounded-lg">
                        <Coins className="h-4 w-4 text-yellow-400" />
                        <span>Requires "{event.coin_type}" coin</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <img
                        src={event.host['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${event.host.Username}`}
                        alt={event.host.Username}
                        className="w-8 h-8 rounded-full"
                      />
                      <span className="text-gray-300">Hosted by {event.host.Username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedEvent(event.id);
                          fetchAttendees(event.id);
                        }}
                        className="px-3 py-2 text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Users className="h-5 w-5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={deleting === event.id}
                          className="px-3 py-2 text-red-400 hover:text-red-300 transition-colors"
                        >
                          {deleting === event.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Trash2 className="h-5 w-5" />
                          )}
                        </button>
                      )}
                      {registeredEvents.has(event.id) ? (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleUnregister(event.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Unregister
                          </button>
                          <a
                            href={generateGoogleCalendarUrl(event)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-lg hover:from-blue-600 hover:to-green-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                          >
                            <CalendarIcon size={16} className="text-white" />
                            <span>Add to Calendar</span>
                          </a>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRegister(event.id)}
                          disabled={event.current_attendees >= event.max_attendees}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {event.current_attendees >= event.max_attendees ? 'Full' : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d182a] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Event</h2>
            <form onSubmit={handleCreateEvent} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Time
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      required
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'white'
                      }}
                    >
                      {TIMEZONES.map(tz => (
                        <option 
                          key={tz} 
                          value={tz}
                          style={{
                            backgroundColor: '#1a2234',
                            color: 'white'
                          }}
                        >
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Event Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'online' | 'in-person' })}
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="in-person">In-Person</option>
                    <option value="online">Online</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Attendees
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.max_attendees}
                    onChange={(e) => setFormData({ ...formData, max_attendees: parseInt(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requires_coin}
                    onChange={(e) => {
                      setFormData({ ...formData, requires_coin: e.target.checked });
                      if (!e.target.checked) {
                        setSelectedCoin(null);
                      }
                    }}
                    className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-700 bg-gray-800 focus:ring-blue-500"
                  />
                  <span className="text-gray-300">Require specific coin for entry</span>
                </label>
              </div>

              {formData.requires_coin && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Required Coin
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCoin?.id || ''}
                      onChange={(e) => {
                        const coin = userCoins.find(c => c.id === parseInt(e.target.value));
                        setSelectedCoin(coin || null);
                      }}
                      className="w-full bg-gray-800 text-white border border-white/10 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                      required={formData.requires_coin}
                    >
                      <option value="">Select a coin</option>
                      {userCoins.map(coin => (
                        <option key={coin.id} value={coin.id}>
                          {coin['Coin Name']} ({coin['Number Of Coins']} available)
                        </option>
                      ))}
                    </select>
                    <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  </div>
                  {selectedCoin && (
                    <div className="mt-4 p-4 bg-white/5 rounded-lg flex items-center gap-4">
                      <img
                        src={selectedCoin['Coin Image']}
                        alt={selectedCoin['Coin Name']}
                        className="w-16 h-16 object-contain rounded bg-white/10 p-2"
                      />
                      <div>
                        <p className="text-white font-medium">{selectedCoin['Coin Name']}</p>
                        <p className="text-sm text-gray-400">
                          {selectedCoin['Number Of Coins']} coins available
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendees Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d182a] rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Event Attendees</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            {loadingAttendees ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Loading attendees...</div>
              </div>
            ) : attendees.length === 0 ? (
              <div className="text-center py-8">
                <UserCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">No attendees yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {attendees.map((attendee) => (
                  <Link
                    key={attendee.user_id}
                    href={`/collection/${attendee.user.Username}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <img
                      src={attendee.user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${attendee.user.Username}`}
                      alt={attendee.user.Username}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-white font-medium">{attendee.user.Username}</p>
                      {attendee.user.Status && (
                        <p className="text-sm text-gray-400">{attendee.user.Status}</p>
                      )}
                    </div>
                    <div className="ml-auto text-sm text-gray-400">
                      {format(parseISO(attendee.created_at), 'MMM d, yyyy')}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};