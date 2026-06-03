import { createClient } from '@supabase/supabase-js';

export const db = createClient(
  'https://puogezenrdecnsaupult.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2dlemVucmRlY25zYXVwdWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzEzMzksImV4cCI6MjA5NTc0NzMzOX0.Ou2V8jGEqQqkO2a1SD5bIJEaevshvfXLTnnWIn6UztM'
);
