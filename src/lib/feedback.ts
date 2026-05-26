import { supabase } from './supabase'
import type { Feedback } from './types'

export async function fetchFeedback(): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createFeedback(message: string, submittedBy: string | null): Promise<void> {
  const { error } = await supabase
    .from('feedback')
    .insert({ message, submitted_by: submittedBy })
  if (error) throw new Error(error.message)
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase
    .from('feedback')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
