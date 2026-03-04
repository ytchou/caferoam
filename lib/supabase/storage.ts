import { createClient } from '@/lib/supabase/client';

async function uploadToStorage(bucket: string, file: File): Promise<string> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadCheckInPhoto(file: File): Promise<string> {
  return uploadToStorage('checkin-photos', file);
}

export async function uploadMenuPhoto(file: File): Promise<string> {
  return uploadToStorage('menu-photos', file);
}
