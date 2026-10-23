-- Social Media Management Database Schema
-- Created for iABS Social Media Admin Dashboard
-- Compatible with PostgreSQL

-- Note: Create database manually: CREATE DATABASE iabs_social;
-- Then connect to iabs_social database before running this schema

-- Social Media Platforms Table
CREATE TABLE IF NOT EXISTS social_platforms (
    id SERIAL PRIMARY KEY,
    platform_name VARCHAR(50) NOT NULL UNIQUE,
    platform_key VARCHAR(20) NOT NULL UNIQUE,
    icon_name VARCHAR(50),
    color_hex VARCHAR(7),
    profile_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Social Media Stats Table
CREATE TABLE IF NOT EXISTS social_media_stats (
    id SERIAL PRIMARY KEY,
    platform_id INT NOT NULL UNIQUE,
    follower_count BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (platform_id) REFERENCES social_platforms(id) ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_platform_updated ON social_media_stats(platform_id, last_updated);

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'editor' CHECK (role IN ('super_admin', 'admin', 'editor')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fix for existing tables that might be missing username column
DO $$
BEGIN
    -- Check if username column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'username'
    ) THEN
        -- If table exists but username column doesn't, drop and recreate
        DROP TABLE IF EXISTS admin_users;
        CREATE TABLE admin_users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100),
            role VARCHAR(20) DEFAULT 'editor' CHECK (role IN ('super_admin', 'admin', 'editor')),
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Update History Log Table
CREATE TABLE IF NOT EXISTS update_history (
    id SERIAL PRIMARY KEY,
    platform_id INT NOT NULL,
    old_count BIGINT,
    new_count BIGINT NOT NULL,
    updated_by VARCHAR(100) NOT NULL,
    update_source VARCHAR(20) DEFAULT 'manual' CHECK (update_source IN ('manual', 'api', 'automatic')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (platform_id) REFERENCES social_platforms(id) ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_platform_date ON update_history(platform_id, created_at);

-- Insert default social media platforms (PostgreSQL syntax)
INSERT INTO social_platforms (platform_name, platform_key, icon_name, color_hex, profile_url) VALUES
('Instagram', 'instagram', 'InstagramIcon', '#E1306C', 'https://www.instagram.com/absq/'),
('TikTok', 'tiktok', 'TikTokIcon', '#FE2C55', 'https://www.tiktok.com/@iabsq'),
('X', 'x', 'XIcon', '#000000', 'https://x.com/iABSq'),
('WhatsApp', 'whatsapp', 'WhatsAppIcon', '#25D366', 'https://www.whatsapp.com/channel/0029VadbqYx5Ui2eInkr7v2E'),
('Snapchat', 'snapchat', 'SnapchatIcon', '#FFFC00', 'https://www.snapchat.com/@iabsq'),
('Discord', 'discord', 'DiscordIcon', '#5865F2', 'https://discord.com/invite/64aggJ9yRA'),
('YouTube', 'youtube', 'YoutubeIcon', '#FF0000', 'https://www.youtube.com/channel/UCdIM7MB-8G-FgE7ld3XAQ8w'),
('Kick', 'kick', 'KickIcon', '#53FC18', 'https://kick.com/icg1')
ON CONFLICT (platform_name) DO NOTHING;

-- Insert initial stats with current values (PostgreSQL syntax)
INSERT INTO social_media_stats (platform_id, follower_count, updated_by) VALUES
((SELECT id FROM social_platforms WHERE platform_key = 'instagram'), 21300, 'admin'),
((SELECT id FROM social_platforms WHERE platform_key = 'tiktok'), 42300, 'admin'),
((SELECT id FROM social_platforms WHERE platform_key = 'x'), 57200, 'admin'),
((SELECT id FROM social_platforms WHERE platform_key = 'whatsapp'), 9100, 'admin'),
((SELECT id FROM social_platforms WHERE platform_key = 'snapchat'), 1200000, 'admin'),
((SELECT id FROM social_platforms WHERE platform_key = 'discord'), 9000, 'admin'),
((SELECT id FROM social_platforms WHERE platform_key = 'youtube'), 37000, 'admin'),
((SELECT id FROM social_platforms WHERE platform_key = 'kick'), 121100, 'admin')
ON CONFLICT (platform_id) DO UPDATE SET follower_count = EXCLUDED.follower_count;

-- Create default admin user (password: admin123) - PostgreSQL syntax
INSERT INTO admin_users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@iabs.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super Admin', 'super_admin')
ON CONFLICT (username) DO NOTHING;

-- Note: Views can be created separately if needed
-- CREATE VIEW current_social_stats AS ...
-- CREATE VIEW update_history_view AS ...
