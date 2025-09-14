-- Fix missing message_templates table
-- This script creates the message_templates and user_template_preferences tables

-- ========================================
-- MESSAGE TEMPLATES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.message_templates (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_arabic TEXT NOT NULL,
  template_hebrew TEXT NOT NULL,
  template_english TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for message_templates
CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON public.message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_default ON public.message_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_favorite ON public.message_templates(is_favorite);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_global ON public.message_templates(is_global);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON public.message_templates(is_active);

-- Enable RLS on message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for message_templates
DROP POLICY IF EXISTS "Users can view global and own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can create own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Admins can manage global templates" ON public.message_templates;

CREATE POLICY "Users can view global and own templates" ON public.message_templates
  FOR SELECT USING (
    is_global = true OR user_id = auth.uid()
  );

CREATE POLICY "Users can create own templates" ON public.message_templates
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can update own templates" ON public.message_templates
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete own templates" ON public.message_templates
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- Create admin function if it doesn't exist
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin' 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Admins can manage global templates" ON public.message_templates
  FOR ALL USING (is_admin());

-- ========================================
-- USER TEMPLATE PREFERENCES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_template_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  default_template_id INTEGER REFERENCES public.message_templates(id) ON DELETE SET NULL,
  favorite_template_ids INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes for user_template_preferences
CREATE INDEX IF NOT EXISTS idx_user_template_preferences_user_id ON public.user_template_preferences(user_id);

-- Enable RLS on user_template_preferences
ALTER TABLE public.user_template_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for user_template_preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_template_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_template_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_template_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_template_preferences;

CREATE POLICY "Users can view own preferences" ON public.user_template_preferences
  FOR SELECT USING (
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert own preferences" ON public.user_template_preferences
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can update own preferences" ON public.user_template_preferences
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete own preferences" ON public.user_template_preferences
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ========================================
-- TRIGGERS AND FUNCTIONS
-- ========================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER update_message_templates_updated_at 
  BEFORE UPDATE ON public.message_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_template_preferences_updated_at ON public.user_template_preferences;
CREATE TRIGGER update_user_template_preferences_updated_at 
  BEFORE UPDATE ON public.user_template_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to ensure only one default template per user
CREATE OR REPLACE FUNCTION ensure_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  -- If this template is being set as default, unset other defaults for this user
  IF NEW.is_default = true AND (OLD.is_default = false OR OLD.is_default IS NULL) THEN
    UPDATE public.message_templates 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for single default template
DROP TRIGGER IF EXISTS ensure_single_default_template_trigger ON public.message_templates;
CREATE TRIGGER ensure_single_default_template_trigger
  BEFORE INSERT OR UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_template();

-- ========================================
-- VERIFICATION
-- ========================================

-- Test that the tables exist and can be queried
SELECT 
  'message_templates table created successfully!' as status,
  COUNT(*) as total_templates
FROM public.message_templates;

SELECT 
  'user_template_preferences table created successfully!' as status,
  COUNT(*) as total_preferences
FROM public.user_template_preferences;

-- Test RLS policies
SELECT 
  'Testing message_templates access...' as test,
  COUNT(*) as accessible_templates
FROM public.message_templates;
