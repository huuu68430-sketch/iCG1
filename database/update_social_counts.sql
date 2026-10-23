-- Update social media follower counts to correct values
-- Run this script to update the database with correct follower counts

UPDATE social_media_stats 
SET follower_count = CASE 
    WHEN platform_id = (SELECT id FROM social_platforms WHERE platform_key = 'instagram') THEN 21300
    WHEN platform_id = (SELECT id FROM social_platforms WHERE platform_key = 'tiktok') THEN 42300
    WHEN platform_id = (SELECT id FROM social_platforms WHERE platform_key = 'x') THEN 57200
    WHEN platform_id = (SELECT id FROM social_platforms WHERE platform_key = 'whatsapp') THEN 9100
    WHEN platform_id = (SELECT id FROM social_platforms WHERE platform_key = 'snapchat') THEN 1200000
    WHEN platform_id = (SELECT id FROM social_platforms WHERE platform_key = 'discord') THEN 9000
    WHEN platform_id = (SELECT id FROM social_platforms WHERE platform_key = 'youtube') THEN 37000
    WHEN platform_id = (SELECT id FROM social_platforms WHERE platform_key = 'kick') THEN 121100
    ELSE follower_count
END,
last_updated = CURRENT_TIMESTAMP,
updated_by = 'admin'
WHERE is_active = TRUE;

-- Log the updates
INSERT INTO update_history (platform_id, old_count, new_count, updated_by, update_source, notes)
SELECT 
    s.platform_id,
    s.follower_count as old_count,
    CASE 
        WHEN p.platform_key = 'instagram' THEN 21300
        WHEN p.platform_key = 'tiktok' THEN 42300
        WHEN p.platform_key = 'x' THEN 57200
        WHEN p.platform_key = 'whatsapp' THEN 9100
        WHEN p.platform_key = 'snapchat' THEN 1200000
        WHEN p.platform_key = 'discord' THEN 9000
        WHEN p.platform_key = 'youtube' THEN 37000
        WHEN p.platform_key = 'kick' THEN 121100
        ELSE s.follower_count
    END as new_count,
    'admin' as updated_by,
    'manual' as update_source,
    'Updated to correct follower counts' as notes
FROM social_media_stats s
JOIN social_platforms p ON s.platform_id = p.id
WHERE s.is_active = TRUE;
