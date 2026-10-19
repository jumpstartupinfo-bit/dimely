-- Direct seed for demo profiles
-- Run this in Supabase SQL Editor to populate Discover page

INSERT INTO users(id, email, password_hash, name, username, role, email_verified) VALUES
('demo_marcus-chen','marcus-chen@demo.dimely.com','__no_login__','Marcus Chen','marcus-chen','demo',true),
('demo_camila-torres','camila-torres@demo.dimely.com','__no_login__','Camila Torres','camila-torres','demo',true),
('demo_james-okonkwo','james-okonkwo@demo.dimely.com','__no_login__','James Okonkwo','james-okonkwo','demo',true),
('demo_priya-sharma','priya-sharma@demo.dimely.com','__no_login__','Priya Sharma','priya-sharma','demo',true),
('demo_aisha-kim','aisha-kim@demo.dimely.com','__no_login__','Aisha Kim','aisha-kim','demo',true),
('demo_luca-romano','luca-romano@demo.dimely.com','__no_login__','Luca Romano','luca-romano','demo',true),
('demo_yuna-park','yuna-park@demo.dimely.com','__no_login__','Yuna Park','yuna-park','demo',true),
('demo_alex-taylor','alex-taylor@demo.dimely.com','__no_login__','Alex Taylor','alex-taylor','demo',true),
('demo_naledi-dube','naledi-dube@demo.dimely.com','__no_login__','Naledi Dube','naledi-dube','demo',true),
('demo_tomás-herrera','tomás-herrera@demo.dimely.com','__no_login__','Tomás Herrera','tomás-herrera','demo',true),
('demo_mei-chen','mei-chen@demo.dimely.com','__no_login__','Mei Chen','mei-chen','demo',true),
('demo_sofia-reyes','sofia-reyes@demo.dimely.com','__no_login__','Sofia Reyes','sofia-reyes','demo',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO wallets(user_id) VALUES
('demo_marcus-chen'),('demo_camila-torres'),('demo_james-okonkwo'),('demo_priya-sharma'),
('demo_aisha-kim'),('demo_luca-romano'),('demo_yuna-park'),('demo_alex-taylor'),
('demo_naledi-dube'),('demo_tomás-herrera'),('demo_mei-chen'),('demo_sofia-reyes')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO profiles(id, user_id, username, name, headline, bio, location, category, tags, price_per_min, min_duration, max_duration, voice_available, video_available, avatar_color, avatar_initials, photo_url, social_twitter, social_linkedin, social_instagram, social_tiktok, social_youtube, verified, published, booking_count) VALUES
('profile_marcus-chen','demo_marcus-chen','marcus-chen','Marcus Chen','Founder & Investor','Serial entrepreneur with 3 exits. I talk startup strategy, fundraising, and scaling from 0 to 1.','San Francisco, USA','Business','["Startups","Fundraising","SaaS","VC"]',8,15,60,true,true,'#0F172A','MC','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face','marcuschen','marcuschen',null,null,null,true,true,342),
('profile_camila-torres','demo_camila-torres','camila-torres','Camila Torres','Skincare Influencer & Esthetician','Licensed esthetician and beauty creator with 2.1M followers.','São Paulo, Brazil','Health & Wellness','["Skincare","Beauty","Wellness"]',4,15,60,false,true,'#DB2777','CT','https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face',null,null,'camilatorres','camilatorres',null,true,true,201),
('profile_james-okonkwo','demo_james-okonkwo','james-okonkwo','James Okonkwo','Marketing Strategist','Growth marketer who has scaled 4 African startups to 7-figure revenues.','Lagos, Nigeria','Marketing','["Marketing","Growth","Branding","GTM"]',5,15,60,true,true,'#F59E0B','JO','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face','jamesokonkwo','jamesokonkwo',null,null,null,true,true,215),
('profile_priya-sharma','demo_priya-sharma','priya-sharma','Priya Sharma','Finance & Wealth Advisor','CFA charterholder and personal finance educator.','Mumbai, India','Finance','["Finance","Investing","Wealth","Tax"]',6,15,60,true,true,'#059669','PS','https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',null,'priyasharma','priyasharma',null,null,true,true,178),
('profile_aisha-kim','demo_aisha-kim','aisha-kim','Aisha Kim','Creator & Musician','Music producer and content creator. I help emerging artists navigate the music industry.','Nairobi, Kenya','Creators','["Music","Content","Creativity","Branding"]',4,15,60,true,true,'#7C3AED','AK','https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=face','aishakim',null,'aishakim','aishakim','aishakim',true,true,128),
('profile_luca-romano','demo_luca-romano','luca-romano','Luca Romano','Tech Lead & Engineering Manager','10 years building distributed systems at scale. I mentor engineers moving into leadership.','Milan, Italy','Technology','["Engineering","Leadership","Architecture","Mentorship"]',7,15,60,true,false,'#0891B2','LR','https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face','lucaromano','lucaromano',null,null,null,true,true,43),
('profile_yuna-park','demo_yuna-park','yuna-park','Yuna Park','UX Designer & Educator','Senior UX designer at a top-5 tech company. I help designers land their dream jobs.','Seoul, South Korea','Design','["Design","UX","Career","Portfolio"]',3,15,60,true,true,'#6366F1','YP','https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face',null,'yunapark','yunapark',null,null,true,true,64),
('profile_alex-taylor','demo_alex-taylor','alex-taylor','Alex Taylor','IP & Tech Lawyer','Technology attorney specializing in IP, contracts, and startup legal strategy.','New York, USA','Legal','["Legal","IP","Contracts","Startups"]',10,15,60,true,true,'#DC2626','AT','https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face',null,'alextaylor',null,null,null,true,true,58),
('profile_naledi-dube','demo_naledi-dube','naledi-dube','Naledi Dube','Entrepreneur & Startup Coach','Pan-African entrepreneur and startup coach. Helping African founders build globally.','Johannesburg, South Africa','Business','["Startups","Africa","Fintech","Entrepreneurship"]',6,15,60,true,true,'#F97316','ND','https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=face','naledidube','naledidube',null,null,null,true,true,72),
('profile_mei-chen','demo_mei-chen','mei-chen','Mei Chen','Product Manager','Product lead at a Series B SaaS company. I help PMs break into top tech companies.','Singapore','Technology','["Product","Career","SaaS","Management"]',5,15,60,true,true,'#EC4899','MC','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',null,'meichen',null,null,null,true,true,89),
('profile_sofia-reyes','demo_sofia-reyes','sofia-reyes','Sofia Reyes','Mindfulness & Productivity Coach','Certified mindfulness instructor. I help high-achievers manage stress and perform at their best.','Mexico City, Mexico','Health & Wellness','["Mindfulness","Productivity","Wellness","Coaching"]',3,15,60,true,true,'#EC4899','SR','https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face','sofiareyes',null,'sofiareyes',null,'sofiareyes',true,true,156)
ON CONFLICT (id) DO NOTHING;

INSERT INTO availability(id, profile_id, day_of_week, start_time, end_time) VALUES
('avail_marcus_1','profile_marcus-chen',1,'09:00','17:00'),('avail_marcus_2','profile_marcus-chen',2,'09:00','17:00'),('avail_marcus_3','profile_marcus-chen',3,'09:00','17:00'),('avail_marcus_4','profile_marcus-chen',4,'09:00','17:00'),('avail_marcus_5','profile_marcus-chen',5,'09:00','15:00'),
('avail_camila_1','profile_camila-torres',1,'10:00','18:00'),('avail_camila_2','profile_camila-torres',2,'10:00','18:00'),('avail_camila_3','profile_camila-torres',3,'10:00','18:00'),('avail_camila_6','profile_camila-torres',6,'10:00','14:00'),
('avail_james_1','profile_james-okonkwo',1,'08:00','16:00'),('avail_james_2','profile_james-okonkwo',2,'08:00','16:00'),('avail_james_3','profile_james-okonkwo',3,'08:00','16:00'),('avail_james_4','profile_james-okonkwo',4,'08:00','16:00'),('avail_james_5','profile_james-okonkwo',5,'08:00','12:00'),
('avail_priya_1','profile_priya-sharma',1,'09:00','17:00'),('avail_priya_2','profile_priya-sharma',2,'09:00','17:00'),('avail_priya_4','profile_priya-sharma',4,'09:00','17:00'),('avail_priya_5','profile_priya-sharma',5,'09:00','15:00'),
('avail_aisha_1','profile_aisha-kim',1,'12:00','20:00'),('avail_aisha_2','profile_aisha-kim',2,'12:00','20:00'),('avail_aisha_4','profile_aisha-kim',4,'12:00','20:00'),('avail_aisha_5','profile_aisha-kim',5,'12:00','20:00'),('avail_aisha_6','profile_aisha-kim',6,'10:00','16:00'),
('avail_luca_2','profile_luca-romano',2,'18:00','21:00'),('avail_luca_4','profile_luca-romano',4,'18:00','21:00'),('avail_luca_6','profile_luca-romano',6,'10:00','16:00'),
('avail_yuna_1','profile_yuna-park',1,'09:00','17:00'),('avail_yuna_2','profile_yuna-park',2,'09:00','17:00'),('avail_yuna_3','profile_yuna-park',3,'09:00','17:00'),('avail_yuna_5','profile_yuna-park',5,'09:00','13:00'),
('avail_alex_1','profile_alex-taylor',1,'10:00','17:00'),('avail_alex_2','profile_alex-taylor',2,'10:00','17:00'),('avail_alex_3','profile_alex-taylor',3,'10:00','17:00'),('avail_alex_4','profile_alex-taylor',4,'10:00','17:00'),
('avail_naledi_1','profile_naledi-dube',1,'08:00','16:00'),('avail_naledi_2','profile_naledi-dube',2,'08:00','16:00'),('avail_naledi_3','profile_naledi-dube',3,'08:00','16:00'),('avail_naledi_5','profile_naledi-dube',5,'08:00','12:00'),
('avail_mei_1','profile_mei-chen',1,'09:00','17:00'),('avail_mei_2','profile_mei-chen',2,'09:00','17:00'),('avail_mei_3','profile_mei-chen',3,'09:00','17:00'),('avail_mei_4','profile_mei-chen',4,'09:00','17:00'),
('avail_sofia_1','profile_sofia-reyes',1,'07:00','12:00'),('avail_sofia_2','profile_sofia-reyes',2,'07:00','12:00'),('avail_sofia_3','profile_sofia-reyes',3,'07:00','12:00'),('avail_sofia_4','profile_sofia-reyes',4,'07:00','12:00'),('avail_sofia_5','profile_sofia-reyes',5,'07:00','12:00')
ON CONFLICT (id) DO NOTHING;
