import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { Logo } from '../components/Logo';
import { processImage } from '../utils/imageProcessing';

// Email normalization utility function
const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const Signup: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: searchParams.get('email') || '',
    username: '',
    bio: ''
  });
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    // Show message if redirected from login with message
    const message = searchParams.get('message');
    if (message) {
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB');
        return;
      }
      setProcessing(true);
      try {
        const processedFile = await processImage(file);
        setProfilePic(processedFile);
        setPreview(URL.createObjectURL(processedFile));
      } catch (error) {
        toast.error('Failed to process image');
      } finally {
        setProcessing(false);
      }
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': []
    },
    maxFiles: 1,
    multiple: false
  });

  const validateFullName = (name: string): boolean => {
    // Remove extra spaces and check if name contains exactly two words
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length !== 2) return false;

    // Check if each part starts with a capital letter followed by lowercase letters
    return nameParts.every(part => 
      part.length > 0 && 
      /^[A-Z][a-z]*$/.test(part)
    );
  };

  const validateForm = async () => {
    // Trim the username to remove any trailing spaces
    const trimmedUsername = formData.username.trim();
    setFormData(prev => ({ ...prev, username: trimmedUsername }));

    if (!formData.email) {
      toast.error('Email is required');
      return false;
    }
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    if (!trimmedUsername) {
      toast.error('Username is required');
      return false;
    }
    if (!/^[a-zA-Z\s]*$/.test(trimmedUsername)) {
      toast.error('Username can only contain letters and spaces');
      return false;
    }
    if (!validateFullName(trimmedUsername)) {
      toast.error('Please enter your full name (e.g., "John Smith") with proper capitalization');
      return false;
    }

    // Normalize email for validation
    const normalizedEmail = normalizeEmail(formData.email);

    // Check if username already exists
    try {
      const { data: existingUser, error } = await supabase
        .from('User Dps')
        .select('Username')
        .eq('Username', trimmedUsername)
        .maybeSingle();

      if (error) throw error;
      if (existingUser) {
        toast.error('This username is already taken');
        return false;
      }
    } catch (error) {
      console.error('Error checking username:', error);
      toast.error('Failed to validate username');
      return false;
    }

    // Check if email already exists in User Dps (using normalized email)
    try {
      const { data: existingEmail, error } = await supabase
        .from('User Dps')
        .select('email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error) throw error;
      if (existingEmail) {
        toast.error('This email is already registered');
        return false;
      }
    } catch (error) {
      console.error('Error checking email:', error);
      toast.error('Failed to validate email');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!await validateForm() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      let profileImageUrl = '';

      if (profilePic) {
        const { error: uploadError } = await supabase.storage
          .from('User Images')
          .upload(normalizeEmail(formData.email), profilePic, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('User Images')
          .getPublicUrl(normalizeEmail(formData.email));

        profileImageUrl = urlData.publicUrl;
      } else {
        // Use the new default profile picture
        profileImageUrl = 'https://credhwdecybwcrkmhtrn.supabase.co/storage/v1/object/public/User%20Images//roman-manshin-ktWVTQ6PhN4-unsplash.jpg';
      }

      // Use default password for all users
      const defaultPassword = '12345678@';

      // Navigate to loader page with all necessary data (using normalized email)
      const params = new URLSearchParams({
        email: normalizeEmail(formData.email),
        password: defaultPassword,
        username: formData.username.trim(),
        bio: formData.bio,
        profileImage: profileImageUrl
      });
      router.push(`/loading?${params.toString()}`);

    } catch (error) {
      console.error('Error during signup:', error);
      setIsSubmitting(false);
      toast.error('Failed to process signup. Please try again.');
    }
  };

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      router.push('/login');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-[#0d182a] flex flex-col">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-700">
        <div 
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center justify-center">
            <div className="flex justify-center w-full">
              <Logo showText={false} />
            </div>
            <p className="mt-2 text-sm text-gray-400">Join the Challenge Coins community</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              {/* Profile Picture Upload (Optional) */}
              <div {...getRootProps()} className="cursor-pointer">
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors">
                  {preview ? (
                    <div className="relative">
                      <img
                        src={preview}
                        alt="Profile preview"
                        className="w-32 h-32 rounded-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfilePic(null);
                          setPreview('');
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {processing ? (
                        <div className="text-center">
                          <Loader2 className="h-12 w-12 text-gray-400 animate-spin mb-2" />
                          <p className="text-sm text-gray-400">Processing image...</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-400">Upload profile picture (optional)</p>
                          <p className="text-xs text-gray-500 mt-1">JPG or PNG (max 2MB)</p>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Email Input */}
              <div>
                <input
                  type="email"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {/* Username Input */}
              <div>
                <input
                  type="text"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Full Name (e.g., John Smith)"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              {/* Bio Input */}
              <div>
                <textarea
                  className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Bio (optional)"
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  'Create account'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};