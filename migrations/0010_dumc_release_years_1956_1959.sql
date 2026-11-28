-- DUMC release-year taxonomy completion: 1956–1959.
-- Additive and idempotent. Requires 0009_dumc_movie_library.sql.
INSERT OR IGNORE INTO dumc_folders
 (id,parent_id,name,description,kind,sort_order,is_system,owner_id,is_archived,created_at,updated_at)
VALUES
 ('YEAR_1956','YEAR_BEFORE_1960','1956','Movies released in 1956.','Folder',6,1,NULL,0,unixepoch(),unixepoch()),
 ('YEAR_1957','YEAR_BEFORE_1960','1957','Movies released in 1957.','Folder',7,1,NULL,0,unixepoch(),unixepoch()),
 ('YEAR_1958','YEAR_BEFORE_1960','1958','Movies released in 1958.','Folder',8,1,NULL,0,unixepoch(),unixepoch()),
 ('YEAR_1959','YEAR_BEFORE_1960','1959','Movies released in 1959.','Folder',9,1,NULL,0,unixepoch(),unixepoch());
