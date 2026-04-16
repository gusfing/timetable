import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Teacher } from '@/types/database';

const fetcher = async () => {
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data as Teacher[];
};

export function useTeachers() {
  const { data, error, mutate, isLoading } = useSWR(
    'teachers',
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  return {
    teachers: data,
    isLoading,
    isError: error,
    mutate,
  };
}
