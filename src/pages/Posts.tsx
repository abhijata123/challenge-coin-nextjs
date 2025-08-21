import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Send, Smile, Gift, Loader2, X, Heart, MessageCircle, Trash2, Search, Edit2, Save, Users } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import { IGif } from '@giphy/js-types';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';
import { UserBadges } from '../components/UserBadges';
import toast from 'react-hot-toast';
import { renderContent } from '../utils/linkify';

const gf = new GiphyFetch('pLURtkhVrUXr3KG25Gy5IvzziV5OrZGa');

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likes: number;
  comments: number;
  user: {
    Username: string;
    'piture link': string | null;
    is_admin: boolean;
    is_founding_member: boolean;
  };
  liked_by_user?: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  likes: number;
  liked_by_user?: boolean;
  user: {
    Username: string;
    'piture link': string | null;
    is_admin: boolean;
    is_founding_member: boolean;
  };
}

interface Like {
  user: {
    Username: string;
    'piture link': string | null;
    is_admin: boolean;
    is_founding_member: boolean;
  };
  created_at: string;
}

export const Posts: React.FC = () => {
  const { user } = useAuthStore();
  const { isAdmin } = useAdminStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [likes, setLikes] = useState<Record<string, Like[]>>({});
  const [commentLikes, setCommentLikes] = useState<Record<string, Like[]>>({});
  const [showLikes, setShowLikes] = useState<string | null>(null);
  const [showCommentLikes, setShowCommentLikes] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteCommentLoading, setDeleteCommentLoading] = useState<string | null>(null);
  const [gifSearchTerm, setGifSearchTerm] = useState('');
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCommentContent, setEditCommentContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editCommentLoading, setEditCommentLoading] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const gifPickerRef = useRef<HTMLDivElement>(null);
  const likesModalRef = useRef<HTMLDivElement>(null);
  const commentLikesModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (gifPickerRef.current && !gifPickerRef.current.contains(event.target as Node)) {
        setShowGifPicker(false);
      }
      if (likesModalRef.current && !likesModalRef.current.contains(event.target as Node)) {
        setShowLikes(null);
      }
      if (commentLikesModalRef.current && !commentLikesModalRef.current.contains(event.target as Node)) {
        setShowCommentLikes(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user) {
      fetchPosts();
      const subscription = subscribeToChanges();
      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [user]);

  const subscribeToChanges = () => {
    if (!user) return;

    return supabase
      .channel('posts-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts'
      }, () => {
        fetchPosts();
      })
      .subscribe();
  };

  const fetchLikes = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('post_likes')
        .select(`
          created_at,
          user:user_id (
            Username,
            "piture link",
            is_admin,
            is_founding_member
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLikes(prev => ({ ...prev, [postId]: data || [] }));
    } catch (error) {
      console.error('Error fetching likes:', error);
      toast.error('Failed to load likes');
    }
  };

  const fetchCommentLikes = async (commentId: string) => {
    try {
      const { data, error } = await supabase
        .from('comment_likes')
        .select(`
          created_at,
          user:user_id (
            Username,
            "piture link",
            is_admin,
            is_founding_member
          )
        `)
        .eq('comment_id', commentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommentLikes(prev => ({ ...prev, [commentId]: data || [] }));
    } catch (error) {
      console.error('Error fetching comment likes:', error);
      toast.error('Failed to load comment likes');
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File must be less than 5MB');
        return;
      }
      setFile(file);
      setPreview(URL.createObjectURL(file));
      setShowGifPicker(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  const fetchPosts = async () => {
    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          user:"User Dps"(
            Username,
            "piture link",
            is_admin,
            is_founding_member
          )
        `)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Get likes for current user
      if (user) {
        const { data: likesData } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.email);

        const likedPostIds = new Set(likesData?.map(like => like.post_id));
        
        setPosts(postsData?.map(post => ({
          ...post,
          liked_by_user: likedPostIds.has(post.id)
        })) || []);
      } else {
        setPosts(postsData || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          user:"User Dps"(
            Username,
            "piture link",
            is_admin,
            is_founding_member
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Get comment likes for current user
      if (user && data) {
        const commentIds = data.map(comment => comment.id);
        
        if (commentIds.length > 0) {
          const { data: commentLikesData } = await supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', user.email)
            .in('comment_id', commentIds);

          const likedCommentIds = new Set(commentLikesData?.map(like => like.comment_id));
          
          const commentsWithLikeStatus = data.map(comment => ({
            ...comment,
            liked_by_user: likedCommentIds.has(comment.id)
          }));
          
          setComments(prev => ({ ...prev, [postId]: commentsWithLikeStatus }));
        } else {
          setComments(prev => ({ ...prev, [postId]: data }));
        }
      } else {
        setComments(prev => ({ ...prev, [postId]: data || [] }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    }
  };

  const handleDelete = async (postId: string, postUserId: string) => {
    if (!user?.email) {
      toast.error('Please log in to delete posts');
      return;
    }

    // Check if user is post owner or admin
    if (user.email !== postUserId && !isAdmin) {
      toast.error('You do not have permission to delete this post');
      return;
    }

    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    setDeleteLoading(postId);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setPosts(posts.filter(p => p.id !== postId));
      toast.success('Post deleted successfully');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleDeleteComment = async (commentId: string, commentUserId: string, postId: string) => {
    if (!user?.email) {
      toast.error('Please log in to delete comments');
      return;
    }

    // Check if user is comment owner or admin
    if (user.email !== commentUserId && !isAdmin) {
      toast.error('You do not have permission to delete this comment');
      return;
    }

    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    setDeleteCommentLoading(commentId);
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Update comments state
      setComments(prev => ({
        ...prev,
        [postId]: prev[postId].filter(c => c.id !== commentId)
      }));

      // Update post comments count
      setPosts(posts.map(p => 
        p.id === postId 
          ? { ...p, comments: p.comments - 1 }
          : p
      ));

      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    } finally {
      setDeleteCommentLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file && !preview) {
      toast.error('Please add some content or media');
      return;
    }

    if (!user?.email) {
      toast.error('Please log in to post');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = preview;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.email,
          content: content.trim(),
          image_url: imageUrl
        });

      if (postError) throw postError;

      setContent('');
      setFile(null);
      setPreview('');
      toast.success('Post created successfully');
      
      await fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (postId: string) => {
    if (!user?.email) {
      toast.error('Please log in to edit posts');
      return;
    }

    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editContent.trim() })
        .eq('id', postId)
        .eq('user_id', user.email);

      if (error) throw error;

      setPosts(posts.map(p => 
        p.id === postId 
          ? { ...p, content: editContent.trim() }
          : p
      ));
      setEditingPost(null);
      setEditContent('');
      toast.success('Post updated successfully');
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditComment = async (commentId: string, postId: string) => {
    if (!user?.email) {
      toast.error('Please log in to edit comments');
      return;
    }

    setEditCommentLoading(true);
    try {
      const { error } = await supabase
        .from('post_comments')
        .update({ content: editCommentContent.trim() })
        .eq('id', commentId)
        .eq('user_id', user.email);

      if (error) throw error;

      setComments(prev => ({
        ...prev,
        [postId]: prev[postId].map(c => 
          c.id === commentId 
            ? { ...c, content: editCommentContent.trim() }
            : c
        )
      }));
      
      setEditingComment(null);
      setEditCommentContent('');
      toast.success('Comment updated successfully');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    } finally {
      setEditCommentLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user?.email) {
      toast.error('Please log in to like posts');
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.liked_by_user) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.email);

        if (error) throw error;

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, likes: p.likes - 1, liked_by_user: false }
            : p
        ));
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.email
          });

        if (error) throw error;

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, likes: p.likes + 1, liked_by_user: true }
            : p
        ));
      }
    } catch (error) {
      console.error('Error updating like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleCommentLike = async (commentId: string, postId: string) => {
    if (!user?.email) {
      toast.error('Please log in to like comments');
      return;
    }

    try {
      const comment = comments[postId]?.find(c => c.id === commentId);
      if (!comment) return;

      if (comment.liked_by_user) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.email);

        if (error) throw error;

        setComments(prev => ({
          ...prev,
          [postId]: prev[postId].map(c => 
            c.id === commentId 
              ? { ...c, likes: c.likes - 1, liked_by_user: false }
              : c
          )
        }));
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: user.email
          });

        if (error) throw error;

        setComments(prev => ({
          ...prev,
          [postId]: prev[postId].map(c => 
            c.id === commentId 
              ? { ...c, likes: c.likes + 1, liked_by_user: true }
              : c
          )
        }));
      }
    } catch (error) {
      console.error('Error updating comment like:', error);
      toast.error('Failed to update comment like');
    }
  };

  const handleComment = async (postId: string) => {
    if (!user?.email) {
      toast.error('Please log in to comment');
      return;
    }

    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setCommentLoading(true);
    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.email,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment('');
      await fetchComments(postId);
      
      setPosts(posts.map(p => 
        p.id === postId 
          ? { ...p, comments: p.comments + 1 }
          : p
      ));
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setContent(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const onGifSelect = (gif: IGif) => {
    setPreview(gif.images.original.url);
    setShowGifPicker(false);
    setFile(null);
  };

  const fetchGifs = (offset: number) => {
    return gifSearchTerm
      ? gf.search(gifSearchTerm, { offset, limit: 10 })
      : gf.trending({ offset, limit: 10 });
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d182a] py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full h-32 bg-white/5 text-white placeholder-gray-400 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {preview && (
              <div className="relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreview('');
                  }}
                  className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white hover:bg-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div {...getRootProps()} className="cursor-pointer">
                  <input {...getInputProps()} />
                  <button
                    type="button"
                    className="p-3 text-gray-400 hover:text-white rounded-full hover:bg-white/10"
                  >
                    <ImageIcon size={20} />
                  </button>
                </div>

                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker(!showEmojiPicker);
                      setShowGifPicker(false);
                    }}
                    className="p-3 text-gray-400 hover:text-white rounded-full hover:bg-white/10"
                  >
                    <Smile size={20} />
                  </button>
                  {showEmojiPicker && (
                    <div className="fixed z-[9999] transform -translate-x-1/2 left-1/2 top-1/2 -translate-y-1/2">
                      <div className="bg-gray-900/95 backdrop-blur-sm p-4 rounded-lg shadow-xl border border-white/10">
                        <EmojiPicker onEmojiClick={onEmojiClick} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={gifPickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGifPicker(!showGifPicker);
                      setShowEmojiPicker(false);
                    }}
                    className="p-3 text-gray-400 hover:text-white rounded-full hover:bg-white/10"
                  >
                    <Gift size={20} />
                  </button>
                  {showGifPicker && (
                    <div className="fixed z-[9999] transform -translate-x-1/2 left-1/2 top-1/2 -translate-y-1/2">
                      <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg p-4 w-[320px] h-[400px] shadow-xl border border-white/10">
                        <div className="mb-4">
                          <div className="relative">
                            <input
                              type="text"
                              value={gifSearchTerm}
                              onChange={(e) => setGifSearchTerm(e.target.value)}
                              placeholder="Search GIFs..."
                              className="w-full bg-gray-800 text-white rounded-lg pl-10 pr-4 py-2"
                            />
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                          </div>
                        </div>
                        <div className="overflow-auto h-[calc(100%-60px)]">
                          <Grid
                            width={280}
                            columns={2}
                            fetchGifs={fetchGifs}
                            onGifClick={onGifSelect}
                            key={gifSearchTerm}
                            noLink={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (!content.trim() && !file && !preview)}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    <Send size={18} />
                    Post
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-8">
          {posts.map((post) => (
            <div key={post.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <Link
                  href={`/collection/${post.user.Username}`}
                  className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-lg transition-colors"
                >
                  <div className="relative">
                    <img
                      src={post.user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${post.user.Username}`}
                      alt={post.user.Username}
                      className="w-12 h-12 rounded-full"
                      loading="lazy"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      <UserBadges 
                        isAdmin={post.user.is_admin} 
                        isFoundingMember={post.user.is_founding_member}
                        size={14}
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-medium hover:text-blue-400 transition-colors">
                      {post.user.Username}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Link>
                {(user?.email === post.user_id || isAdmin) && (
                  <div className="flex items-center gap-2">
                    {user?.email === post.user_id && (
                      <button
                        onClick={() => {
                          setEditingPost(post.id);
                          setEditContent(post.content);
                        }}
                        className="text-blue-500 hover:text-blue-600 p-2"
                        disabled={editingPost === post.id}
                      >
                        <Edit2 size={20} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(post.id, post.user_id)}
                      disabled={deleteLoading === post.id}
                      className="text-red-500 hover:text-red-600 p-2"
                    >
                      {deleteLoading === post.id ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : (
                        <Trash2 size={20} />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {editingPost === post.id ? (
                <div className="mb-6">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-white/5 text-white rounded-lg p-4 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingPost(null);
                        setEditContent('');
                      }}
                      className="px-4 py-2 text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleEdit(post.id)}
                      disabled={editLoading || !editContent.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {editLoading ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : (
                        <>
                          <Save size={16} />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {post.content && (
                    <p className="text-white mb-6 whitespace-pre-wrap text-lg break-words">
                      {renderContent(post.content)}
                    </p>
                  )}

                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post media"
                      className="w-full rounded-lg mb-6"
                      loading="lazy"
                    />
                  )}
                </>
              )}

              <div className="flex items-center gap-6 text-gray-400">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-2 hover:text-white transition-colors ${
                    post.liked_by_user ? 'text-red-500 hover:text-red-600' : ''
                  }`}
                >
                  <Heart
                    size={20}
                    className={post.liked_by_user ? 'fill-current' : ''}
                  />
                  <span>{post.likes}</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPost(selectedPost === post.id ? null : post.id);
                    if (selectedPost !== post.id) {
                      fetchComments(post.id);
                    }
                  }}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <MessageCircle size={20} />
                  <span>{post.comments}</span>
                </button>

                {post.likes > 0 && (
                  <button
                    onClick={() => {
                      if (showLikes === post.id) {
                        setShowLikes(null);
                      } else {
                        setShowLikes(post.id);
                        fetchLikes(post.id);
                      }
                    }}
                    className="flex items-center gap-2 hover:text-white transition-colors"
                  >
                    <Users size={20} />
                    <span>View Likes</span>
                  </button>
                )}
              </div>

              {/* Likes Modal */}
              {showLikes === post.id && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div 
                    ref={likesModalRef} 
                    className="bg-gray-900/95 backdrop-blur-sm rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white text-lg font-medium">Liked by</h3>
                      <button
                        onClick={() => setShowLikes(null)}
                        className="text-gray-400 hover:text-white p-2"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {likes[post.id]?.map((like) => (
                        <Link
                          key={like.user.Username}
                          href={`/collection/${like.user.Username}`}
                          className="flex items-center gap-3 hover:bg-white/5 p-2 rounded-lg transition-colors"
                        >
                          <div className="relative">
                            <img
                              src={like.user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${like.user.Username}`}
                              alt={like.user.Username}
                              className="w-10 h-10 rounded-full"
                              loading="lazy"
                            />
                            <div className="absolute -bottom-1 -right-1">
                              <UserBadges 
                                isAdmin={like.user.is_admin} 
                                isFoundingMember={like.user.is_founding_member}
                                size={12}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-white font-medium">{like.user.Username}</p>
                            <p className="text-sm text-gray-400">
                              {formatDistanceToNow(new Date(like.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Comment Likes Modal */}
              {showCommentLikes && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div 
                    ref={commentLikesModalRef} 
                    className="bg-gray-900/95 backdrop-blur-sm rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white text-lg font-medium">Liked by</h3>
                      <button
                        onClick={() => setShowCommentLikes(null)}
                        className="text-gray-400 hover:text-white p-2"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {commentLikes[showCommentLikes]?.map((like) => (
                        <Link
                          key={like.user.Username}
                          href={`/collection/${like.user.Username}`}
                          className="flex items-center gap-3 hover:bg-white/5 p-2 rounded-lg transition-colors"
                        >
                          <div className="relative">
                            <img
                              src={like.user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${like.user.Username}`}
                              alt={like.user.Username}
                              className="w-10 h-10 rounded-full"
                              loading="lazy"
                            />
                            <div className="absolute -bottom-1 -right-1">
                              <UserBadges 
                                isAdmin={like.user.is_admin} 
                                isFoundingMember={like.user.is_founding_member}
                                size={12}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-white font-medium">{like.user.Username}</p>
                            <p className="text-sm text-gray-400">
                              {formatDistanceToNow(new Date(like.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedPost === post.id && (
                <div className="mt-6 space-y-6">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 bg-white/5 text-white placeholder-gray-400 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleComment(post.id)}
                      disabled={commentLoading || !newComment.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {commentLoading ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : (
                        'Comment'
                      )}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {comments[post.id]?.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-4 bg-white/5 rounded-lg p-4">
                        <div className="relative">
                          <img
                            src={comment.user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.user.Username}`}
                            alt={comment.user.Username}
                            className="w-10 h-10 rounded-full"
                            loading="lazy"
                          />
                          <div className="absolute -bottom-1 -right-1">
                            <UserBadges 
                              isAdmin={comment.user.is_admin} 
                              isFoundingMember={comment.user.is_founding_member}
                              size={12}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/collection/${comment.user.Username}`}
                                className="text-white font-medium hover:text-blue-400 transition-colors"
                              >
                                {comment.user.Username}
                              </Link>
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            
                            {(user?.email === comment.user.user_id || isAdmin) && (
                              <div className="flex items-center gap-2">
                                {user?.email === comment.user.user_id && (
                                  <button
                                    onClick={() => {
                                      setEditingComment(comment.id);
                                      setEditCommentContent(comment.content);
                                    }}
                                    className="text-blue-500 hover:text-blue-600 p-1"
                                    disabled={editingComment === comment.id}
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteComment(comment.id, comment.user.user_id, post.id)}
                                  disabled={deleteCommentLoading === comment.id}
                                  className="text-red-500 hover:text-red-600 p-1"
                                >
                                  {deleteCommentLoading === comment.id ? (
                                    <Loader2 className="animate-spin h-4 w-4" />
                                  ) : (
                                    <Trash2 size={16} />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {editingComment === comment.id ? (
                            <div className="mt-2">
                              <textarea
                                value={editCommentContent}
                                onChange={(e) => setEditCommentContent(e.target.value)}
                                className="w-full bg-white/5 text-white rounded-lg p-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingComment(null);
                                    setEditCommentContent('');
                                  }}
                                  className="px-3 py-1 text-gray-400 hover:text-white text-sm"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleEditComment(comment.id, post.id)}
                                  disabled={editCommentLoading || !editCommentContent.trim()}
                                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                                >
                                  {editCommentLoading ? (
                                    <Loader2 className="animate-spin h-3 w-3" />
                                  ) : (
                                    <>
                                      <Save size={14} />
                                      Save
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-300 mt-1 break-words">{comment.content}</p>
                          )}
                          
                          <div className="flex items-center gap-4 mt-2">
                            <button
                              onClick={() => handleCommentLike(comment.id, post.id)}
                              className={`flex items-center gap-1 text-sm ${
                                comment.liked_by_user ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-white'
                              } transition-colors`}
                            >
                              <Heart
                                size={16}
                                className={comment.liked_by_user ? 'fill-current' : ''}
                              />
                              <span>{comment.likes}</span>
                            </button>
                            
                            {comment.likes > 0 && (
                              <button
                                onClick={() => {
                                  if (showCommentLikes === comment.id) {
                                    setShowCommentLikes(null);
                                  } else {
                                    setShowCommentLikes(comment.id);
                                    fetchCommentLikes(comment.id);
                                  }
                                }}
                                className="text-sm text-gray-400 hover:text-white transition-colors"
                              >
                                View likes
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {posts.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              <p className="text-lg">No posts yet. Be the first to post!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};