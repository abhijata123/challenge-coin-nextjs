import React, { useState, useEffect } from 'react';
import { MessageCircleQuestion, Send, Loader2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  question: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  user_id: string;
  answered_by: string | null;
  user: {
    Username: string;
    'piture link': string | null;
  } | null;
  answered_by_user: {
    Username: string;
    'piture link': string | null;
  } | null;
}

interface QuestionAnswerListProps {
  coinId: number;
  isOwner: boolean;
}

export const QuestionAnswerList: React.FC<QuestionAnswerListProps> = ({ coinId, isOwner }) => {
  const { user } = useAuthStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchQuestions();

    // Subscribe to changes in the coin_questions table
    const subscription = supabase
      .channel('coin-questions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'coin_questions',
        filter: `coin_id=eq.${coinId}`
      }, () => {
        console.log('Coin questions changed, refreshing...');
        fetchQuestions();
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [coinId]);

  const fetchQuestions = async () => {
    try {
      console.log('Fetching questions for coin:', coinId);
      
      // Fetch questions without using the automatic embedding
      const { data, error } = await supabase
        .from('coin_questions')
        .select(`
          id,
          question,
          answer,
          created_at,
          answered_at,
          user_id,
          answered_by
        `)
        .eq('coin_id', coinId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching questions:', error);
        throw error;
      }
      
      console.log('Questions fetched:', data);
      
      // Now fetch user data for each question
      const processedData = await Promise.all((data || []).map(async (question) => {
        // Get user who asked the question
        const { data: userData, error: userError } = await supabase
          .from('User Dps')
          .select('Username, "piture link"')
          .eq('email', question.user_id)
          .single();
          
        // Get user who answered the question (if any)
        let answeredByUserData = null;
        if (question.answered_by) {
          const { data: answerUserData, error: answerUserError } = await supabase
            .from('User Dps')
            .select('Username, "piture link"')
            .eq('email', question.answered_by)
            .single();
            
          if (!answerUserError) {
            answeredByUserData = answerUserData;
          }
        }
        
        return {
          ...question,
          user: userError ? null : userData,
          answered_by_user: answeredByUserData
        };
      }));
      
      setQuestions(processedData);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const submitAnswer = async (questionId: string) => {
    const answer = answers[questionId];
    if (!answer?.trim()) {
      toast.error('Please enter an answer');
      return;
    }

    if (!user?.email) {
      toast.error('You must be logged in to answer a question');
      return;
    }

    setSubmitting(prev => ({ ...prev, [questionId]: true }));
    try {
      const { error } = await supabase
        .from('coin_questions')
        .update({
          answer: answer.trim(),
          answered_at: new Date().toISOString(),
          answered_by: user.email
        })
        .eq('id', questionId);

      if (error) throw error;
      
      toast.success('Answer submitted successfully');
      
      // Update the local state
      setQuestions(questions.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              answer: answer.trim(), 
              answered_at: new Date().toISOString(),
              answered_by: user.email,
              answered_by_user: {
                Username: user.user_metadata?.name || user.email?.split('@')[0] || 'You',
                'piture link': null
              }
            } 
          : q
      ));
      
      // Clear the answer input
      setAnswers(prev => {
        const newAnswers = { ...prev };
        delete newAnswers[questionId];
        return newAnswers;
      });
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(prev => {
        const newSubmitting = { ...prev };
        delete newSubmitting[questionId];
        return newSubmitting;
      });
    }
  };

  // Helper function to get a username safely
  const getUsernameDisplay = (userObj: { Username: string; 'piture link': string | null; } | null | undefined): string => {
    if (!userObj) return 'Anonymous User';
    return userObj.Username || 'Anonymous User';
  };

  // Helper function to get a profile image safely
  const getProfileImage = (userObj: { Username: string; 'piture link': string | null; } | null | undefined): string => {
    if (!userObj) return `https://api.dicebear.com/7.x/initials/svg?seed=Anonymous`;
    return userObj['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${userObj.Username}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <MessageCircleQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No questions yet</p>
        <p className="text-sm mt-1">Be the first to ask a question about this coin!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <div key={question.id} className="bg-white/5 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={getProfileImage(question.user)}
                alt={getUsernameDisplay(question.user)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-white">{getUsernameDisplay(question.user)}</h3>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={12} />
                  {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-gray-300 mt-1">{question.question}</p>
            </div>
          </div>

          {question.answer ? (
            <div className="mt-4 ml-12 border-l-2 border-blue-500 pl-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                  <img
                    src={getProfileImage(question.answered_by_user)}
                    alt={getUsernameDisplay(question.answered_by_user)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white">{getUsernameDisplay(question.answered_by_user)}</h3>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={12} />
                      {question.answered_at ? formatDistanceToNow(new Date(question.answered_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  <p className="text-gray-300 mt-1">{question.answer}</p>
                </div>
              </div>
            </div>
          ) : isOwner ? (
            <div className="mt-4 ml-12">
              <div className="flex items-start gap-3">
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Write your answer..."
                  className="flex-1 bg-gray-800 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
                <button
                  onClick={() => submitAnswer(question.id)}
                  disabled={submitting[question.id] || !answers[question.id]?.trim()}
                  className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting[question.id] ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};