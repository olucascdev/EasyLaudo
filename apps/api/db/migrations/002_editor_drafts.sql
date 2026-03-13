CREATE TABLE IF NOT EXISTS editor_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mapping_id UUID REFERENCES mappings(id) ON DELETE CASCADE,
  patients JSONB NOT NULL DEFAULT '[]',
  selected_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, mapping_id)
);

CREATE INDEX IF NOT EXISTS idx_editor_drafts_user_mapping ON editor_drafts(user_id, mapping_id);
