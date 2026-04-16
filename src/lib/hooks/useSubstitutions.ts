import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

const fetcher = async (key: string) => {
  const [_, status] = key.split(':');
  
  let query = supabase
    .from('substitution_requests')
    .select(`
      *,
      original_teacher:teachers!original_teacher_id(name),
      assigned_teacher:teachers!assigned_teacher_id(name),
      period:periods(*)
    `)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return data;
};

export function useSubstitutions(status?: string) {
  const { data, error, mutate, isLoading } = useSWR(
    `substitutions:${status || 'all'}`,
    fetcher,
    {
      refreshInterval: 15000, // Refresh every 15 seconds
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return {
    substitutions: data,
    isLoading,
    isError: error,
    mutate,
  };
}
