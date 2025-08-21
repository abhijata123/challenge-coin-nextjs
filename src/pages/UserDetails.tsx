import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Upload, X, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { processImage } from '../utils/imageProcessing';

const STATUS_OPTIONS = [
  'Civilian',
  'Veteran',
  'Active Duty Army',
  'Active Duty Navy',
  'Active Duty Air Force',
  'Firefighting / First Responder'
];

interface UserProfile {
  email: string;
  Username: string;
  Bio: string;
  'piture link': string;
  'Number Of Coins': number;
  Status: string;
  Location: string;
  Share_Dates: boolean;
  Share_Notes: boolean;
}

export const UserDetails: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const [originalUsername, setOriginalUsername] = useState<string>('');
  const [newProfilePic, setNewProfilePic] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingImage, setProcessingImage] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      
      try {
        setProcessingImage(true);
        // Create a preview immediately for better UX
        const tempPreview = URL.createObjectURL(file);
        setPreview(tempPreview);
        
        // Process the image in the background
        const processedFile = await processImage(file);
        setNewProfilePic(processedFile);
        
        // Update preview with processed image
        URL.revokeObjectURL(tempPreview);
        setPreview(URL.createObjectURL(processedFile));
        
        toast.success('Image processed successfully');
      } catch (error) {
        console.error('Error processing image:', error);
        toast.error('Failed to process image');
        // Still keep the original file if processing fails
        setNewProfilePic(file);
      } finally {
        setProcessingImage(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    maxFiles: 1,
    disabled: processingImage,
  });

  useEffect(() => {
    // Check for slow connection
    setIsSlowConnection(checkSlowConnection());
  }, []);

  useEffect(() => {
    if (profile?.Username) {
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}/collection/${profile.Username}`);
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    fetchUserProfile();
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user?.email) {
      router.push('/login');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('User Dps')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      if (!data) {
        setLoading(false);
        return;
      }

      setProfile(data);
      setEditedProfile(data);
      setOriginalUsername(data.Username);
      if (data['piture link']) {
        setPreview(data['piture link']);
      }

    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const uploadProfilePicture = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user!.email}.${fileExt}`; // Use email as filename
    
    try {
      // Set up upload with progress tracking
      const { error: uploadError, data } = await supabase.storage
        .from('User Images')
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true, // Update if file exists
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percent);
          }
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('User Images')
        .getPublicUrl(fileName);

      // Add a cache-busting parameter to the URL to prevent browser caching
      const cacheBuster = `?t=${Date.now()}`;
      const publicUrl = `${urlData.publicUrl}${cacheBuster}`;
      
      return publicUrl;
    } catch (error) {
      console.error('Error during upload:', error);
      throw error;
    } finally {
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    if (!profile || !user) return;

    setSaving(true);
    setUploadProgress(0);
    
    try {
      let profileImageUrl = profile['piture link'];

      if (newProfilePic) {
        toast.loading('Uploading profile picture...', { id: 'upload-toast' });
        
        try {
          profileImageUrl = await uploadProfilePicture(newProfilePic);
          toast.success('Profile picture uploaded', { id: 'upload-toast' });
        } catch (error) {
          console.error('Profile picture upload error:', error);
          toast.error(
            error instanceof Error 
              ? error.message 
              : 'Failed to upload profile picture. Using previous image.', 
            { id: 'upload-toast' }
          );
          // Continue with the previous image
        }
      }
      
      toast.loading('Updating profile...', { id: 'profile-toast' });
      
      // Only update the profile picture, not the username or other fields
      const { error: updateError } = await supabase
        .from('User Dps')
        .update({ 'piture link': profileImageUrl })
        .eq('email', user.email);

      if (updateError) throw updateError;
      
      // Update the local state
      setProfile({ ...profile, 'piture link': profileImageUrl });
      setNewProfilePic(null);

      toast.success('Profile updated successfully', { id: 'profile-toast' });
      
      // Reload the profile to ensure all UI elements are updated
      await fetchUserProfile();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile', { id: 'profile-toast' });
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const handleFullProfileUpdate = async () => {
    if (!editedProfile || !user) return;

    // Check if username has changed
    const usernameChanged = originalUsername !== editedProfile.Username;

    setSaving(true);
    
    try {
      toast.loading('Updating profile...', { id: 'profile-toast' });
      
      if (usernameChanged) {
        // Call the update_username function to update username across all tables
        const { data, error } = await supabase.rpc(
          'update_username',
          {
            old_username: originalUsername,
            new_username: editedProfile.Username,
            user_email: user.email,
            new_bio: editedProfile.Bio,
            new_status: editedProfile.Status,
            new_location: editedProfile.Location,
            new_picture: '', // Don't update picture here
            new_share_dates: editedProfile.Share_Dates,
            new_share_notes: editedProfile.Share_Notes
          }
        );

        if (error) throw error;
        if (data !== 'success') throw new Error(data);
        
        // Update original username for future reference
        setOriginalUsername(editedProfile.Username);
      } else {
        // Update only the non-critical fields that don't require the complex function
        const { error: updateError } = await supabase
          .from('User Dps')
          .update({
            Bio: editedProfile.Bio,
            Status: editedProfile.Status,
            Location: editedProfile.Location,
            Share_Dates: editedProfile.Share_Dates,
            Share_Notes: editedProfile.Share_Notes
          })
          .eq('email', user.email);

        if (updateError) throw updateError;
      }
      
      setProfile({
        ...profile!,
        Username: editedProfile.Username,
        Bio: editedProfile.Bio,
        Status: editedProfile.Status,
        Location: editedProfile.Location,
        Share_Dates: editedProfile.Share_Dates,
        Share_Notes: editedProfile.Share_Notes
      });

      toast.success('Profile updated successfully', { id: 'profile-toast' });
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile', { id: 'profile-toast' });
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const checkSlowConnection = (): boolean => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        // Check for slow connection types
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          return true;
        }
        // Check for low bandwidth (less than 1 Mbps)
        if (connection.downlink && connection.downlink < 1) {
          return true;
        }
      }
    }
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!profile || !editedProfile) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Profile not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d182a] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <Share2 className="h-5 w-5" />
                Share Collection
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Profile Picture</label>
              <div {...getRootProps()} className={`cursor-pointer ${processingImage ? 'opacity-70' : ''}`}>
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors">
                  {preview ? (
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full overflow-hidden">
                        <img
                          src={preview}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewProfilePic(null);
                          setPreview(profile['piture link'] || '');
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                        disabled={processingImage}
                      >
                        <X size={16} />
                      </button>
                      
                      {processingImage && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {processingImage ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="h-12 w-12 text-gray-400 animate-spin mb-2" />
                          <p className="text-sm text-gray-400">Processing image...</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-400">Upload new profile picture</p>
                          <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP (max 5MB)</p>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {isSlowConnection && (
                <p className="text-xs text-yellow-500 mt-2">
                  Slow network detected. Upload may take longer than usual.
                </p>
              )}
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">{uploadProgress}% uploaded</p>
                </div>
              )}
              
              <div className="mt-4">
                <button
                  onClick={handleSave}
                  disabled={saving || processingImage || !newProfilePic}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : null}
                  {saving ? 'Saving...' : 'Update Profile Picture'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200">Email</label>
              <input
                type="email"
                value={editedProfile.email}
                disabled
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-not-allowed opacity-75"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200">Username</label>
              <input
                type="text"
                value={editedProfile.Username}
                onChange={(e) => setEditedProfile({ ...editedProfile, Username: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200">Bio</label>
              <textarea
                value={editedProfile.Bio}
                onChange={(e) => setEditedProfile({ ...editedProfile, Bio: e.target.value })}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200">Status</label>
              <select
                value={editedProfile.Status || ''}
                onChange={(e) => setEditedProfile({ ...editedProfile, Status: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select Status</option>
                {STATUS_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200">Location</label>
              <input
                type="text"
                value={editedProfile.Location || ''}
                onChange={(e) => setEditedProfile({ ...editedProfile, Location: e.target.value })}
                placeholder="City, State/Province, Country"
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-medium text-white">Sharing Preferences</h2>
              
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div>
                  <h3 className="text-white font-medium">Share Issue Dates</h3>
                  <p className="text-sm text-gray-400">Show the issue dates of your coins to public viewers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editedProfile.Share_Dates}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, Share_Dates: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div>
                  <h3 className="text-white font-medium">Share Coin Stories</h3>
                  <p className="text-sm text-gray-400">Display your coin stories to public viewers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editedProfile.Share_Notes}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, Share_Notes: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={handleFullProfileUpdate}
                disabled={saving || processingImage}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : null}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};