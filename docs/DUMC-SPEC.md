# DUMC — DRM Universal Movie Section
Version: 1.0.0
Status: DUMC taxonomy, Owner/Admin APIs, Upload Studio folder/media relationships and public Movies browsing are implemented on `feature/full-admin-panel`; Preview deployment is active, while Production `main` remains unchanged.

## Purpose
DUMC provides one canonical classification model for the Movies section. It separates original audio language, film industry, dubbed audio, genre, production country, collections, release year, subtitle availability, artwork and metadata.

## Architecture
- Parent path: `Movies/DUMC`.
- Stable folder IDs are the identity; display labels can change.
- The taxonomy is a versioned JSON source at `assets/dumc/taxonomy.json`.
- Folder views are virtual classifications. A movie is stored once and can appear in multiple folders through metadata relationships.
- The taxonomy does not create duplicate media files or infer missing metadata.

## Top-level folders
- `00_SYSTEM`: README, TAXONOMY, SCHEMAS, CHANGELOG.
- `01_MOVIE_LIBRARY`: FEATURED, ALL_MOVIES, UNCLASSIFIED, ARCHIVED.
- `02_LANGUAGE`: Bangla, Hindi, English, Tamil, Telugu, Malayalam, Kannada, Marathi, Punjabi, Urdu, Korean, Japanese, Chinese, Spanish, French, Arabic, Turkish, Persian, German, Italian, Russian, Other_Languages.
- `03_FILM_INDUSTRY`: Dhallywood, Bengali_Cinema_India, Bollywood, Telugu_Cinema, Tamil_Cinema, Malayalam_Cinema, Kannada_Cinema, Hollywood, Marathi_Cinema, Punjabi_Cinema, Korean_Cinema, Japanese_Cinema, Chinese_Cinema, Other_Industries.
- `04_DUBBED_MOVIES`: Bangla_Dubbed, Hindi_Dubbed, English_Dubbed, Tamil_Dubbed, Telugu_Dubbed, Malayalam_Dubbed, Kannada_Dubbed, Urdu_Dubbed, Other_Dubbed.
- `05_GENRES`: Action, Adventure, Animation, Comedy, Crime, Drama, Documentary, Fantasy, Historical, Horror, Mystery, Romance, Science_Fiction, Thriller, War, Western, Musical, Family, Biography, Sports, Superhero, Psychological, Noir, Disaster, Music.
- `06_COUNTRIES`: Bangladesh, India, United_States, United_Kingdom, South_Korea, Japan, China, Hong_Kong, Taiwan, France, Germany, Italy, Spain, Turkey, Iran, Thailand, Indonesia, Malaysia, Australia, Canada, Other_Countries.
- `07_COLLECTIONS`: Movie_Franchises, Movie_Series, Cinematic_Universe, Sequels, Prequels, Standalone_Collections, Award_Winners, DRM_Editor_Picks.
- `08_RELEASE_YEARS`: individual public year folders from 1950 through 2026 (77 consecutive years), plus a separate Unknown_Year filter. The taxonomy retains 2027–2029 for future use, but the public Year selector hides them.
- `09_SUBTITLES`: Bangla, English, Hindi, Arabic, Spanish, French, Other_Subtitles.
- `10_ARTWORK`: Posters, Backdrops, Logos, Stills, Trailers_Thumbnails, Promotional_Artwork.
- `11_METADATA`: Movie_Records, People_Cast_Crew, Studios_Production, Ratings_Reviews, External_Identifiers, Metadata_Import_Queue, Missing_Metadata, Duplicate_Review_Queue.

## Classification rules
1. Original audio language is not the same as dubbed audio language.
2. Industry, country, language and genre are independent fields.
3. Multiple values are allowed for dubbed languages, genres, countries, subtitles and collections where evidence supports them.
4. Unknown values remain unknown; no automatic guessing.
5. One canonical movie record and media identity; virtual folders do not duplicate files.
6. Stable IDs are used for future API/database relationships.

## Implemented on `feature/full-admin-panel`

- Versioned taxonomy: `assets/dumc/taxonomy.json`, 12 top-level sections and 230 stable folder IDs (226 seeded by migration 0009 plus four 1956–1959 folders added by migration 0010).
- Additive D1 migrations: `migrations/0009_dumc_movie_library.sql` creates the DUMC tables and seeds the original 226 taxonomy nodes; `migrations/0010_dumc_release_years_1956_1959.sql` adds the four missing pre-1960 year folders. Migration 0009 also backfills one metadata row per existing video without guessing missing metadata.
- Authenticated Owner/Admin APIs: `GET/POST /api/admin/dumc/folders`, `PATCH/DELETE /api/admin/dumc/folders/:id`, `GET /api/admin/dumc/movies`, `GET/PUT /api/admin/dumc/movies/:videoId`, `PUT /api/admin/dumc/movies/:videoId/folders`, and audio/subtitle reference creation/deletion routes.
- Upload Studio includes a searchable folder explorer, custom-folder creation, movie metadata editor, multi-select Genre/Dubbed/Subtitle/Collection classification, audio/subtitle reference registration, and optional folder assignment when creating a video.
- The migration inventory is updated. A dedicated GitHub Actions workflow runs SQLite migration tests, migration-inventory validation and JavaScript syntax checks.

## Important execution boundary

Migration 0009 has been applied to the Preview D1 database `drmdatabase-preview`; its current verified contents after that migration were 226 folders and 3 movie metadata rows for 3 existing videos. Migration 0010 is committed but still needs to be applied to Preview to add `YEAR_1956`–`YEAR_1959` and bring the database taxonomy to 230 folders. Do not apply either migration to Production without a separate release decision. The repository manifest is documentation-only and does not record database migration history. Cloudflare Pages Preview is deployed from `feature/full-admin-panel`; Production `main` remains unchanged.

Audio/subtitle APIs accept HTTPS source URLs only; asset-key media registration is rejected. They do not upload media bytes and do not fetch external assets.


## Public homepage integration and media policy

- The homepage has a dedicated Movies tab and DUMC browsing section. The public directory is organized into seven independent columns: All Movies (Film Industry folders), Dubbed Movies, Country, Collections, Genre, Subtitles and Year. Each column uses the shared DUSB scrollbar component (blue thumb, right-side vertical scrolling); each category contains one flat folder list, while Year runs from 2026 down to 1950. The redundant Movies title, intro description and breadcrumb are omitted so the seven-column Movies directory starts immediately below the Universal Tab Bar. The live folder/movie count is aligned to the right of the Year heading. Selecting a category then a year applies both filters together.
- Public browsing uses `GET /api/dumc/browse`, which returns published movies only and supports recursive folder filtering, server-side search and pagination.
- **Media policy:** movie/video files are never uploaded to this website, regardless of whether they are 50 MB, 100 MB or another size. Movie playback uses external video links. Only cover/poster images may be uploaded. Audio and subtitle references are HTTPS links only; DUMC APIs reject asset-key based media registration.
- DUMC homepage integration is deployed to Cloudflare Pages Preview. Public year-folder navigation is served from the versioned static taxonomy; movie contents are returned by the read-only browse API using the Preview D1 binding.

## DULM Owner folder rename — 2026-11-27

- The floating Owner pencil on the homepage is repurposed as the Folder Editing Mode toggle; it no longer opens the legacy visual/site editor.
- While Owner editing mode is enabled, each public DUMC folder item displays a compact inline pencil. Non-Owner accounts cannot enable the mode, and the write API independently enforces Owner role.
- Rename uses a compact native dialog with one name field and Save/Cancel actions. Save validates the name, rejects duplicate sibling display names, writes a read-back-verified override, and refreshes the active list without changing the stable folder ID.
- Overrides are stored in the existing D1 settings table under the key prefix dumc_folder_name_override:. No new schema or migration is required. Public read-only endpoint: GET /api/dumc/folder-name-overrides. Owner write endpoint: PUT /api/admin/dumc/folder-name-overrides.
- DUMC public browsing, authenticated folder browsing, movie-assignment labels and the homepage read the override while retaining canonical taxonomy IDs. Internal override keys are excluded from the general public settings response.
- The static taxonomy remains the source of canonical folder identity. The special 1956–1959 taxonomy entries, documented as absent from Preview D1 until migration 0010 is applied, can still receive a display-name override without running that migration.
- Implemented only on feature/full-admin-panel. No D1 migration was executed, no live D1 write was made in this implementation session, and Production main was not changed.
- Source-level JavaScript syntax checks and a disposable SQLite settings/query smoke test passed. The DUMC GitHub Actions workflow currently reports failure with zero jobs created; it has not provided a failing step/log, so CI validation remains unresolved. Live Cloudflare Pages/browser and authenticated D1 save verification remain outstanding.