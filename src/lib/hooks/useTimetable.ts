import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { TimetableEntry } from '@/types/database';

const fetcher = async (key: string) => {
  const [_, wingId] = key.split(':');
  
  let query = supabase
    .from('timetable')
    .select('*')
    .order('day')
    .order('period_number');

  if (wingId && wingId !== 'all') {
    query = query.eq('wing_id', wingId);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return data as TimetableEntry[];
};

export function useTimetable(wingId?: string) {
  const { data, error, mutate, isLoading } = useSWR(
    `timetable:${wingId || 'all'}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return {
    timetable: data,
    isLoading,
    isError: error,
    mutate,
  };
}
