/*
  # Create Oracle Collections System

  1. New Tables
    - `divine_words`
      - `id` (uuid, primary key)
      - `word` (text, unique) - The sacred word
      - `rarity` (text) - 'SSR' or 'SR'
      - `last_found_at` (timestamp) - When it was last obtained
    
    - `user_collections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `divine_word_id` (uuid, references divine_words)
      - `found_count` (integer) - How many times obtained
      - `first_found_at` (timestamp) - First discovery time
      - `updated_at` (timestamp) - Last update time

    - `user_statistics`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, unique)
      - `total_spins` (integer) - Total number of spins
      - `total_points` (integer) - Accumulated points
      - `divine_count` (integer) - Number of SSR obtained
      - `reality_count` (integer) - Number of SR obtained
      - `collection_completion` (integer) - Completion percentage
      - `highest_score` (integer) - Best purity score
      - `last_spin_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Users can only view their own statistics and collections
    - Add policies for data isolation

  3. Indexes
    - Index on user_id for fast queries
    - Index on word for searching divine words
    - Index on created_at for chronological queries

  4. Initial Data
    - Seed divine_words table with all SSR/SR words
*/

-- Create divine_words table
CREATE TABLE IF NOT EXISTS divine_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text UNIQUE NOT NULL,
  rarity text NOT NULL CHECK (rarity IN ('SSR', 'SR')),
  last_found_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create user_collections table
CREATE TABLE IF NOT EXISTS user_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  divine_word_id uuid NOT NULL REFERENCES divine_words(id) ON DELETE CASCADE,
  found_count integer DEFAULT 1 CHECK (found_count > 0),
  first_found_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, divine_word_id)
);

-- Create user_statistics table
CREATE TABLE IF NOT EXISTS user_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_spins integer DEFAULT 0,
  total_points integer DEFAULT 0,
  divine_count integer DEFAULT 0,
  reality_count integer DEFAULT 0,
  collection_completion integer DEFAULT 0,
  highest_score integer DEFAULT 0,
  last_spin_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE divine_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;

-- Policies for divine_words (public read-only)
CREATE POLICY "Anyone can read divine words"
  ON divine_words FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policies for user_collections
CREATE POLICY "Users can view own collections"
  ON user_collections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collections"
  ON user_collections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections"
  ON user_collections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for user_statistics
CREATE POLICY "Users can view own statistics"
  ON user_statistics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own statistics"
  ON user_statistics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own statistics"
  ON user_statistics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_word_id ON user_collections(divine_word_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_user_id ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_divine_words_rarity ON divine_words(rarity);

-- Seed divine_words with SSR and SR words
INSERT INTO divine_words (word, rarity) VALUES
  -- SSR
  ('うんこ', 'SSR'),
  ('ちんこ', 'SSR'),
  ('まんこ', 'SSR'),
  ('ぱんこ', 'SSR'),
  ('あんこ', 'SSR'),
  ('さんこ', 'SSR'),
  ('きんこ', 'SSR'),
  ('わんこ', 'SSR'),
  ('げんこ', 'SSR'),
  -- SR
  ('てんき', 'SR'),
  ('げんき', 'SR'),
  ('りんご', 'SR'),
  ('だんご', 'SR'),
  ('きんご', 'SR'),
  ('ぶんこ', 'SR'),
  ('はんこ', 'SR'),
  ('さんご', 'SR')
ON CONFLICT (word) DO NOTHING;
