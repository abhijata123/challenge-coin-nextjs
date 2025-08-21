import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

interface AskQuestionModalProps {
  coinId: number;
  coinName: string;
  onClose: () => void;
}

export const AskQuestionModal: React.FC<AskQuestionModalProps> = ({
  coinId,
  coinName,
  onClose
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }
    
    if (!user?.email) {
      toast.error('You must be logged in to ask a question');
      return;
    }
    
    setLoading(true);
    try {
      console.log('Submitting question for coin:', coinId, 'Question:', question.trim(), 'User email:', user.email);
      
      // First, verify the coin is public
      const { data: coinData, error: coinError } = await supabase
        .from('Challenge Coin Table')
        .select('id, "Public Display"')
        .eq('id', coinId)
        .single();
        
      if (coinError) {
        console.error('Error checking coin:', coinError);
        throw new Error('Could not verify coin');
      }
      
      // Check if the coin is actually public (boolean check)
      const isPublic = coinData && coinData['Public Display'] === true;
      
      if (!isPublic) {
        console.error('Coin is not public:', coinData);
        throw new Error('This coin is not public');
      }
      
      // Then submit the question
      const { data, error } = await supabase
        .from('coin_questions')
        .insert({
          coin_id: coinId,
          user_id: user.email,
          question: question.trim()
        })
        .select();
        
      if (error) {
        console.error('Error submitting question:', error);
        throw error;
      }
      
      console.log('Question submitted successfully:', data);
      
      toast.success('Question submitted successfully');
      onClose();
    } catch (error) {
      console.error('Error submitting question:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0d182a] rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Ask a Question</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              About: {coinName}
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to know about this coin?"
              rows={4}
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1">
              {500 - question.length} characters remaining
            </p>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <Send size={16} />
              )}
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};