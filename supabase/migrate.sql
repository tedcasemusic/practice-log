-- Migration script to update the database schema
-- Run this after updating the schema.sql file

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.weekly_plan_items CASCADE;
DROP TABLE IF EXISTS public.weekly_plans CASCADE;
DROP TABLE IF EXISTS public.practice_sessions CASCADE;

-- Create the new sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  session_date date NOT NULL,
  category text NOT NULL CHECK (category IN ('scales','review','new','technique')),
  minutes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ensure only one entry per user per category per day
  UNIQUE(user_id, session_date, category)
);

-- Create the new plan table
CREATE TABLE IF NOT EXISTS public.plan (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  daily_goal int NOT NULL DEFAULT 180,
  scales_minutes int NOT NULL DEFAULT 45,
  scales_note text DEFAULT '',
  review_minutes int NOT NULL DEFAULT 45,
  review_note text DEFAULT '',
  new_minutes int NOT NULL DEFAULT 45,
  new_note text DEFAULT '',
  technique_minutes int NOT NULL DEFAULT 45,
  technique_note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ensure only one plan per user
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS sessions_user_date_idx ON public.sessions (user_id, session_date);
CREATE INDEX IF NOT EXISTS sessions_user_category_idx ON public.sessions (user_id, category);

-- Create policies for sessions
CREATE POLICY "sessions owner select" ON public.sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sessions owner insert" ON public.sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions owner update" ON public.sessions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "sessions owner delete" ON public.sessions FOR DELETE USING (user_id = auth.uid());

-- Create policies for plan
CREATE POLICY "plan owner select" ON public.plan FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "plan owner insert" ON public.plan FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "plan owner update" ON public.plan FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "plan owner delete" ON public.plan FOR DELETE USING (user_id = auth.uid());

-- Create function to automatically create daily entries for all categories
CREATE OR REPLACE FUNCTION ensure_daily_entries(user_uuid uuid, target_date date)
RETURNS void AS $$
BEGIN
  -- Insert entries for all categories if they don't exist
  INSERT INTO public.sessions (user_id, session_date, category, minutes)
  SELECT user_uuid, target_date, cat.category, 0
  FROM (VALUES ('scales'), ('review'), ('new'), ('technique')) AS cat(category)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE user_id = user_uuid 
    AND session_date = target_date 
    AND category = cat.category
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create daily entries when a user is created
CREATE OR REPLACE FUNCTION create_initial_plan()
RETURNS trigger AS $$
BEGIN
  -- Create initial plan for new user
  INSERT INTO public.plan (user_id, daily_goal, scales_minutes, scales_note, review_minutes, review_note, new_minutes, new_note, technique_minutes, technique_note)
  VALUES (new.id, 180, 45, 'Tone & Intonation', 45, 'Review Rep', 45, 'New Rep', 45, 'Technique');
  
  -- Create entries for today and yesterday for all categories
  PERFORM ensure_daily_entries(new.id, current_date);
  PERFORM ensure_daily_entries(new.id, current_date - interval '1 day');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_plan();

-- For existing users, create initial plans and entries
-- You may need to run this manually for existing users
-- INSERT INTO public.plan (user_id, daily_goal, scales_minutes, scales_note, review_minutes, review_note, new_minutes, new_note, technique_minutes, technique_note)
-- SELECT id, 180, 45, 'Tone & Intonation', 45, 'Review Rep', 45, 'New Rep', 45, 'Technique'
-- FROM auth.users
-- WHERE id NOT IN (SELECT user_id FROM public.plan);
