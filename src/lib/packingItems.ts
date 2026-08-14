import { supabase } from './supabase'
import type { PackingItem, PackingStatus } from './types'

export async function fetchPackingItems(): Promise<PackingItem[]> {
  const { data, error } = await supabase
    .from('packing_items')
    .select('*')
    .order('position')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function addPackingItem(input: {
  name: string
  quantity?: string | null
  category?: string | null
  status?: PackingStatus
  position: number
  created_by?: string | null
}): Promise<PackingItem> {
  const { data, error } = await supabase
    .from('packing_items')
    .insert({
      name: input.name,
      quantity: input.quantity ?? null,
      category: input.category ?? null,
      status: input.status ?? 'offen',
      position: input.position,
      created_by: input.created_by ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePackingItem(
  id: string,
  patch: Partial<Pick<PackingItem, 'name' | 'quantity' | 'category' | 'status' | 'note'>>,
): Promise<void> {
  const { error } = await supabase.from('packing_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePackingItem(id: string): Promise<void> {
  const { error } = await supabase.from('packing_items').delete().eq('id', id)
  if (error) throw error
}
