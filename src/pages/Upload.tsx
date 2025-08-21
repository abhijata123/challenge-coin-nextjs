import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload as UploadIcon, X, Loader2, User, Copyright } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';
import FormData from 'form-data';

interface UserOption {
  email: string;
  Username: string;
  'piture link': string | null;
}

export const Upload: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isAdmin } = useAdminStore();
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string>('');
  const [backPreview, setBackPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [processingFront, setProcessingFront] = useState(false);
  const [processingBack, setProcessingBack] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dateAcquired: '',
  });
  const [addCopyright, setAddCopyright] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
    if (user?.email) {
      fetchUsername();
    }
  }, [isAdmin, user]);

  const fetchUsername = async () => {
    if (!user?.email) return;
    
    const { data, error } = await supabase
      .from('User Dps')
      .select('Username')
      .eq('email', user.email)
      .single();

    if (!error && data) {
      setUsername(data.Username);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('User Dps')
        .select('email, Username, "piture link"')
        .order('Username');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    }
  };

  const onDropFront = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setFrontFile(file);
    setFrontPreview(URL.createObjectURL(file));
  }, []);

  const onDropBack = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setBackFile(file);
    setBackPreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps: getFrontRootProps, getInputProps: getFrontInputProps, isDragActive: isFrontDragActive } = useDropzone({
    onDrop: onDropFront,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    maxFiles: 1,
  });

  const { getRootProps: getBackRootProps, getInputProps: getBackInputProps, isDragActive: isBackDragActive } = useDropzone({
    onDrop: onDropBack,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    maxFiles: 1,
  });

  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = atob(base64);
    const length = binaryString.length;
    const buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < length; i++) {
      view[i] = binaryString.charCodeAt(i);
    }

    return buffer;
  };

  const processImage = async (file: File, setProcessing: (state: boolean) => void): Promise<File> => {
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('crop', '1');
      formData.append('get_base64', '1');

      const response = await fetch('https://api.removal.ai/3.0/remove', {
        method: 'POST',
        headers: {
          'Rm-Token': '852CC948-4008-A6D9-6AE3-56B22FBDA5B8',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process image');
      }

      const data = await response.json();
      
      if (!data.base64) {
        throw new Error('No base64 data received');
      }

      const base64Data = data.base64.replace(/^data:image\/png;base64,/, '');
      const arrayBuffer = base64ToArrayBuffer(base64Data);
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      
      const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '_processed.png', {
        type: 'image/png'
      });

      return processedFile;
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image. Using original image instead.');
      return file;
    } finally {
      setProcessing(false);
    }
  };

  const generateFileName = (originalName: string): string => {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    const fileExt = originalName.split('.').pop();
    return `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frontFile || !user) {
      toast.error('Please select at least the front image and ensure you are logged in');
      return;
    }

    const targetEmail = isAdmin && selectedUser ? selectedUser : user.email;
    if (!targetEmail) {
      toast.error('Please select a user');
      return;
    }

    setLoading(true);
    try {
      // Get user details first
      const { data: userData, error: userError } = await supabase
        .from('User Dps')
        .select('id, Username')
        .eq('email', targetEmail)
        .single();

      if (userError) throw new Error('Failed to get user details');

      // Process both images
      const processedFrontFile = await processImage(frontFile, setProcessingFront);
      const processedBackFile = backFile ? await processImage(backFile, setProcessingBack) : null;

      // Upload front image
      const frontFileName = generateFileName(processedFrontFile.name);
      const { error: frontUploadError } = await supabase.storage
        .from('Coin Images')
        .upload(frontFileName, processedFrontFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (frontUploadError) throw new Error(`Front upload error: ${frontUploadError.message}`);

      // Get front image URL
      const { data: frontUrlData } = supabase.storage
        .from('Coin Images')
        .getPublicUrl(frontFileName);

      if (!frontUrlData.publicUrl) {
        throw new Error('Failed to get public URL for front image');
      }

      // Upload back image if provided
      let backUrlData = null;
      if (processedBackFile) {
        const backFileName = generateFileName(processedBackFile.name);
        const { error: backUploadError } = await supabase.storage
          .from('Coin Images')
          .upload(backFileName, processedBackFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (backUploadError) throw new Error(`Back upload error: ${backUploadError.message}`);

        const { data: backUrl } = supabase.storage
          .from('Coin Images')
          .getPublicUrl(backFileName);

        backUrlData = backUrl;
      }

      // Save coin data to the database - FIXED: Use email as UserId
      const { error: dbError } = await supabase
        .from('Challenge Coin Table')
        .insert([
          {
            'Coin Name': formData.name || 'Untitled Coin',
            'Date Issued': formData.dateAcquired || new Date().toISOString().split('T')[0],
            'Coin Image': frontUrlData.publicUrl,
            'BacksideUrl': backUrlData?.publicUrl || null,
            'UserId': targetEmail, // FIXED: Use email instead of userData.id.toString()
            'Number Of Coins': 1,
            'Mode Of Acquiring': 'self added',
            'Notes': formData.description || '',
            'Priority': 0,
            'Featured': false,
            'Public Display': false,
            'Username': userData.Username,
            'available_quantity': 1,
            'Has Copyright': isAdmin && addCopyright
          }
        ]);

      if (dbError) {
        // Clean up uploaded files if database insert fails
        await supabase.storage
          .from('Coin Images')
          .remove([frontFileName]);
        
        if (backUrlData) {
          await supabase.storage
            .from('Coin Images')
            .remove([backUrlData.publicUrl.split('/').pop()!]);
        }
        throw new Error(`Database error: ${dbError.message}`);
      }

      toast.success('Coin added successfully!');
      router.push('/my-collection');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload coin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8">Add New Coin</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {isAdmin && (
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 sm:p-6">
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Upload For User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
              className="w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.email} value={user.email}>
                  {user.Username}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Front side upload */}
          <div className="bg-white/5 rounded-lg p-4 sm:p-6 backdrop-blur-sm">
            <h2 className="text-white text-lg font-semibold mb-4">Front Side (Required)</h2>
            <div {...getFrontRootProps()} className="cursor-pointer">
              <input {...getFrontInputProps()} />
              {frontPreview ? (
                <div className="relative">
                  <div 
                    className="relative"
                    onContextMenu={(e) => e.preventDefault()} // Prevent right-click
                  >
                    <img
                      src={frontPreview}
                      alt="Front Preview"
                      className="w-full h-48 sm:h-64 object-contain rounded-lg select-none"
                      draggable="false"
                    />
                    {addCopyright && isAdmin && username && (
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                        Made by {username}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFrontFile(null);
                      setFrontPreview('');
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                  >
                    <X size={20} />
                  </button>
                  {processingFront && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <div className="text-white text-center">
                        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" />
                        <p>Processing image...</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed ${
                    isFrontDragActive ? 'border-blue-500' : 'border-gray-600'
                  } rounded-lg p-8 sm:p-12 text-center`}
                >
                  <UploadIcon className="mx-auto h-8 sm:h-12 w-8 sm:w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-400">
                    Upload front side image
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    JPG, PNG, WEBP up to 5MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Back side upload */}
          <div className="bg-white/5 rounded-lg p-4 sm:p-6 backdrop-blur-sm">
            <h2 className="text-white text-lg font-semibold mb-4">Back Side (Optional)</h2>
            <div {...getBackRootProps()} className="cursor-pointer">
              <input {...getBackInputProps()} />
              {backPreview ? (
                <div className="relative">
                  <div 
                    className="relative"
                    onContextMenu={(e) => e.preventDefault()} // Prevent right-click
                  >
                    <img
                      src={backPreview}
                      alt="Back Preview"
                      className="w-full h-48 sm:h-64 object-contain rounded-lg select-none"
                      draggable="false"
                    />
                    {addCopyright && isAdmin && username && (
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                        Made by {username}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBackFile(null);
                      setBackPreview('');
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                  >
                    <X size={20} />
                  </button>
                  {processingBack && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <div className="text-white text-center">
                        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" />
                        <p>Processing image...</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed ${
                    isBackDragActive ? 'border-blue-500' : 'border-gray-600'
                  } rounded-lg p-8 sm:p-12 text-center`}
                >
                  <UploadIcon className="mx-auto h-8 sm:h-12 w-8 sm:w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-400">
                    Upload back side image
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    JPG, PNG, WEBP up to 5MB
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-200">
              Coin Name (Optional)
            </label>
            <input
              type="text"
              id="name"
              className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-200">
              Description (Optional)
            </label>
            <textarea
              id="description"
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="dateAcquired" className="block text-sm font-medium text-gray-200">
              Date Acquired (Optional)
            </label>
            <input
              type="date"
              id="dateAcquired"
              className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              value={formData.dateAcquired}
              onChange={(e) => setFormData({ ...formData, dateAcquired: e.target.value })}
            />
          </div>

          {isAdmin && (
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <Copyright className="h-5 w-5 text-gray-300" />
                <span className="text-gray-300">Add Copyright Tag</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={addCopyright}
                  onChange={(e) => setAddCopyright(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/my-collection')}
            className="w-full sm:w-auto px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !frontFile || processingFront || processingBack}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading || processingFront || processingBack ? 'Processing...' : 'Upload Coin'}
          </button>
        </div>
      </form>
    </div>
  );
};